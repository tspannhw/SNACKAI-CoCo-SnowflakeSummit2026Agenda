import { chromium } from 'playwright';
import fs from 'fs';

const CATALOG_BASE = 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Loading catalog page...');
  await page.goto(CATALOG_BASE + '?tab.sessioncatalogtab=1714168666431001NNiH', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);

  // Scroll to load all
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
  }

  const catText = await page.evaluate(() => document.body.innerText);
  const catLines = catText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Parse sessions with their time ranges
  // The pattern in the listing is:
  //   TITLE, CODE
  //   Monday, Jun 1[TIME_START] - [TIME_END] PDT  (day number merges with time)
  //   description...
  //   ADD TO SCHEDULE
  const sessionTimes = {};
  
  for (let i = 0; i < catLines.length; i++) {
    const line = catLines[i];
    
    // Match session title line with code
    const codeMatch = line.match(/,\s*([A-Z]{1,5}\d+[A-Z\-]*)\s*$/);
    if (codeMatch) {
      const code = codeMatch[1];
      // Next line should have the time range
      const nextLine = catLines[i + 1] || '';
      
      // Pattern: "Monday, Jun 1X:XX [A/P]M - X:XX [A/P]M PDT"
      // The day number (1, 2, 3, 4) merges with the hour
      // e.g., "Monday, Jun 11:00 PM - 1:45 PM PDT" means Jun 1, 1:00 PM
      // e.g., "Monday, Jun 12:30 PM - 2:50 PM PDT" means Jun 1, 2:30 PM
      
      // Extract the start and end times by looking for the " - " separator
      const dashIdx = nextLine.indexOf(' - ');
      if (dashIdx > 0) {
        const endPart = nextLine.substring(dashIdx + 3).replace(/\s*PDT.*/, '').trim();
        const endMatch = endPart.match(/(\d{1,2}:\d{2}\s*[AP]M)/);
        
        // For start time, find the actual start time
        // The text before " - " is like "Monday, Jun 12:30 PM" 
        // where "Jun 1" is the date and "2:30 PM" is the time
        // OR "Monday, Jun 19:00 AM" where "9:00 AM" is the time
        const beforeDash = nextLine.substring(0, dashIdx);
        // Extract the time part - last occurrence of time pattern
        const startMatch = beforeDash.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*$/);
        
        if (startMatch && endMatch) {
          const startTime = startMatch[1];
          const endTime = endMatch[1];
          
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
          sessionTimes[code] = { startTime, endTime, duration };
        }
      }
    }
  }

  console.log(`Parsed time ranges for ${Object.keys(sessionTimes).length} sessions:`);
  Object.entries(sessionTimes).sort((a,b) => a[1].duration - b[1].duration).forEach(([code, info]) => {
    console.log(`  ${code}: ${info.startTime} - ${info.endTime} (${info.duration} min)`);
  });

  // Group by duration
  const byDuration = {};
  Object.entries(sessionTimes).forEach(([code, info]) => {
    byDuration[info.duration] = (byDuration[info.duration] || []);
    byDuration[info.duration].push(code);
  });
  console.log('\nBy duration:');
  Object.entries(byDuration).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).forEach(([d, codes]) => {
    console.log(`  ${d} min: ${codes.length} sessions (${codes.join(', ')})`);
  });

  // Now click on sessions to get their RainFocus IDs and types
  console.log('\n=== Clicking sessions to get details ===');
  
  // Get list of session card titles we can click
  const sessionCards = await page.evaluate(() => {
    const cards = [];
    document.querySelectorAll('h5, h4, h3, [class*="title"]').forEach(el => {
      const text = el.textContent.trim();
      const codeMatch = text.match(/,\s*([A-Z]{1,5}\d+[A-Z\-]*)\s*$/);
      if (codeMatch) {
        cards.push({ code: codeMatch[1], text: text.substring(0, 80) });
      }
    });
    return cards;
  });
  console.log(`Found ${sessionCards.length} clickable session titles`);

  // Click each session to navigate to its detail page and grab type info
  const details = [];
  for (const card of sessionCards) {
    try {
      // Navigate back to catalog
      if (page.url().includes('/session/')) {
        await page.goto(CATALOG_BASE + '?tab.sessioncatalogtab=1714168666431001NNiH', { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(3000);
        // Re-scroll
        for (let i = 0; i < 20; i++) {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(500);
        }
      }

      // Click on the session title
      const clicked = await page.evaluate((code) => {
        const els = document.querySelectorAll('h5, h4, h3, [class*="title"]');
        for (const el of els) {
          if (el.textContent.includes(code)) {
            el.click();
            return true;
          }
        }
        // Try clicking parent or nearby button
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent.includes(code)) {
            btn.click();
            return true;
          }
        }
        return false;
      }, card.code);

      if (!clicked) {
        console.log(`  ${card.code}: Could not click`);
        continue;
      }

      await page.waitForTimeout(3000);

      // Check if we navigated to a session detail page
      const currentUrl = page.url();
      const rfIdMatch = currentUrl.match(/\/session\/(\w+)/);
      
      if (rfIdMatch) {
        const rfId = rfIdMatch[1];
        const text = await page.evaluate(() => document.body.innerText);
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        let sessionType = '', sessionLength = '', level = '', tracks = '', features = '';
        lines.forEach(l => {
          if (l.startsWith('Session Type:')) sessionType = l.replace('Session Type:', '').trim();
          if (l.startsWith('Session Length:')) sessionLength = l.replace('Session Length:', '').trim();
          if (l.startsWith('Technical Level:')) level = l.replace('Technical Level:', '').trim();
          if (l.startsWith('Session Tracks:')) tracks = l.replace('Session Tracks:', '').trim();
          if (l.startsWith('Covered Features:')) features = l.replace('Covered Features:', '').trim();
        });
        
        details.push({ code: card.code, rfId, sessionType, sessionLength, level, tracks, features });
        console.log(`  ${card.code}: ${rfId} | ${sessionType} | ${sessionLength} | ${level}`);
      } else {
        console.log(`  ${card.code}: Did not navigate to detail page (${currentUrl.substring(0, 80)})`);
      }
    } catch (e) {
      console.log(`  ${card.code}: Error - ${e.message.substring(0, 60)}`);
    }
  }

  fs.writeFileSync('scraped_session_details.json', JSON.stringify(details, null, 2));
  console.log(`\nSaved ${details.length} session details`);

  await browser.close();
})();
