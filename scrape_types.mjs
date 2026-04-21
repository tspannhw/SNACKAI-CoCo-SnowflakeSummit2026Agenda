import { chromium } from 'playwright';
import fs from 'fs';

const CATALOG_BASE = 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const sessionTypes = ['Breakout Session', 'Theater Session', 'Hands-on Lab'];
  const typeResults = {};

  for (const sessionType of sessionTypes) {
    console.log(`\n=== Filtering by: ${sessionType} ===`);
    await page.goto(CATALOG_BASE + '?tab.sessioncatalogtab=1714168666431001NNiH', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);

    // Click "Session Type" filter
    const expandBtn = await page.$('button:has-text("Session Type")');
    if (expandBtn) {
      await expandBtn.click();
      await page.waitForTimeout(1500);
    }

    // Click the specific type checkbox
    const typeBtn = await page.evaluate((type) => {
      // Look for checkbox or button containing the type text
      const elements = document.querySelectorAll('button, input, label, [role="checkbox"]');
      for (const el of elements) {
        const text = el.textContent?.trim() || el.getAttribute('aria-label') || '';
        if (text === type || text.includes(type)) {
          el.click();
          return true;
        }
      }
      // Try clicking a span/div with the text
      const spans = document.querySelectorAll('span, div, p');
      for (const el of spans) {
        if (el.textContent?.trim() === type) {
          el.click();
          return true;
        }
      }
      return false;
    }, sessionType);

    console.log(`  Clicked filter: ${typeBtn}`);
    await page.waitForTimeout(3000);

    // Scroll to load all filtered results
    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(600);
    }

    // Get session codes from the filtered list
    const text = await page.evaluate(() => document.body.innerText);
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    const codes = [];
    lines.forEach(l => {
      const codeMatch = l.match(/,\s*([A-Z]{1,5}\d+[A-Z\-]*)\s*$/);
      if (codeMatch) codes.push(codeMatch[1]);
    });
    
    typeResults[sessionType] = codes;
    console.log(`  Found ${codes.length} sessions: ${codes.join(', ')}`);
  }

  // Now parse the actual time ranges properly
  // Go back to full catalog
  console.log('\n=== Getting time ranges from full catalog ===');
  await page.goto(CATALOG_BASE + '?tab.sessioncatalogtab=1714168666431001NNiH', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(600);
  }

  const fullText = await page.evaluate(() => document.body.innerText);
  const fullLines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Parse time ranges more carefully
  // The format is: "Day, Jun DTIME_START - TIME_END PDT"
  // where D is the day number (1-4) and it merges with the start time
  // e.g. "Monday, Jun 12:30 PM - 2:50 PM PDT" means day 1, 2:30 PM - 2:50 PM
  // e.g. "Monday, Jun 11:00 PM - 1:45 PM PDT" means day 1, 1:00 PM - 1:45 PM
  
  const sessionTimeRanges = {};
  for (let i = 0; i < fullLines.length; i++) {
    const line = fullLines[i];
    const codeMatch = line.match(/,\s*([A-Z]{1,5}\d+[A-Z\-]*)\s*$/);
    if (!codeMatch) continue;
    
    const code = codeMatch[1];
    const nextLine = fullLines[i + 1] || '';
    
    // Extract time range
    // Pattern: "Weekday, Jun D H:MM AM/PM - H:MM AM/PM PDT"
    // The D and H merge, so "Jun 12:30 PM" = day 1, 2:30 PM 
    // and "Jun 19:00 AM" = day 1, 9:00 AM
    
    const trMatch = nextLine.match(/Jun\s+(\d)(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/);
    if (trMatch) {
      const dayNum = trMatch[1];
      const startTime = trMatch[2];
      const endTime = trMatch[3];
      
      const parseMinutes = (t) => {
        const parts = t.trim().match(/(\d{1,2}):(\d{2})\s*([AP]M)/);
        if (!parts) return 0;
        let h = parseInt(parts[1]);
        const m = parseInt(parts[2]);
        const ampm = parts[3];
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return h * 60 + m;
      };
      
      const duration = parseMinutes(endTime) - parseMinutes(startTime);
      sessionTimeRanges[code] = { dayNum, startTime, endTime, duration };
    }
  }

  console.log(`Parsed ${Object.keys(sessionTimeRanges).length} time ranges`);

  // Combine everything
  const combined = {};
  const allCodes = new Set([
    ...Object.keys(sessionTimeRanges),
    ...typeResults['Breakout Session'] || [],
    ...typeResults['Theater Session'] || [],
    ...typeResults['Hands-on Lab'] || [],
  ]);

  for (const code of allCodes) {
    let sessionType = 'Breakout Session'; // default
    if (typeResults['Theater Session']?.includes(code)) sessionType = 'Theater Session';
    else if (typeResults['Hands-on Lab']?.includes(code)) sessionType = 'Hands-on Lab';
    else if (typeResults['Breakout Session']?.includes(code)) sessionType = 'Breakout Session';
    else if (code.startsWith('K')) sessionType = 'Keynote';
    else if (code.startsWith('TC')) sessionType = 'Training';
    
    const tr = sessionTimeRanges[code] || {};
    
    // Infer duration from session type if time parsing failed
    let duration = tr.duration;
    if (!duration || duration <= 0) {
      if (sessionType === 'Theater Session') duration = 20;
      else if (sessionType === 'Breakout Session') duration = 45;
      else if (sessionType === 'Hands-on Lab') duration = 90;
      else if (sessionType === 'Keynote') duration = 90;
      else if (sessionType === 'Training') duration = 420;
    }
    
    combined[code] = { sessionType, duration, startTime: tr.startTime || '', endTime: tr.endTime || '' };
  }

  // Print summary
  console.log('\n=== Combined results ===');
  const byType = {};
  Object.entries(combined).forEach(([code, info]) => {
    byType[info.sessionType] = byType[info.sessionType] || [];
    byType[info.sessionType].push(`${code}(${info.duration}m)`);
  });
  Object.entries(byType).forEach(([type, items]) => {
    console.log(`\n${type} (${items.length}):`);
    console.log(`  ${items.join(', ')}`);
  });

  fs.writeFileSync('session_types.json', JSON.stringify(combined, null, 2));
  console.log(`\nSaved session_types.json with ${Object.keys(combined).length} entries`);

  await browser.close();
})();
