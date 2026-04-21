import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog';
const URL = `${BASE}?tab.sessioncatalogtab=1714168666431001NNiH`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Collect network requests to find session IDs
  const sessionIdMap = {};
  page.on('request', req => {
    const url = req.url();
    if (url.includes('session/')) {
      const match = url.match(/session\/(\w+)/);
      if (match) sessionIdMap[match[1]] = url;
    }
  });

  console.log('Opening catalog...');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Extract Monday sessions (already loaded)
  let allSessions = await extractSessions(page);
  console.log(`Monday: ${allSessions.length} sessions`);

  // Try to find day filter buttons
  const dayButtons = await page.evaluate(() => {
    const buttons = [];
    document.querySelectorAll('button, [role="tab"], [role="button"]').forEach(b => {
      const text = b.textContent.trim();
      if (text.match(/tuesday|wednesday|thursday|june\s*[234]|day\s*[234]|jun\s*[234]/i)) {
        buttons.push({ text, tag: b.tagName, classes: b.className });
      }
    });
    // Also look for filter/dropdown with day options
    document.querySelectorAll('select option, [role="option"], [role="listbox"] li').forEach(o => {
      const text = o.textContent.trim();
      if (text.match(/tuesday|wednesday|thursday|june\s*[234]/i)) {
        buttons.push({ text, tag: 'option', classes: '' });
      }
    });
    return buttons;
  });
  console.log('Day navigation elements:', JSON.stringify(dayButtons, null, 2));

  // Try clicking day filters if found
  for (const dayLabel of ['Tuesday', 'Wednesday', 'Thursday']) {
    const dayShort = dayLabel.substring(0, 3);
    try {
      const clicked = await page.evaluate((label) => {
        const elements = document.querySelectorAll('button, [role="tab"], [role="button"], a');
        for (const el of elements) {
          if (el.textContent.trim().toLowerCase().includes(label.toLowerCase())) {
            el.click();
            return el.textContent.trim();
          }
        }
        return null;
      }, dayLabel);
      
      if (clicked) {
        console.log(`Clicked: ${clicked}`);
        await page.waitForTimeout(3000);
        const daySessions = await extractSessions(page);
        console.log(`${dayLabel}: ${daySessions.length} new sessions`);
        // Add only new sessions
        const existingCodes = new Set(allSessions.map(s => s.code));
        for (const s of daySessions) {
          if (s.code && !existingCodes.has(s.code)) {
            allSessions.push(s);
            existingCodes.add(s.code);
          } else if (!s.code && !allSessions.find(e => e.title === s.title)) {
            allSessions.push(s);
          }
        }
      }
    } catch (e) {
      console.log(`Could not navigate to ${dayLabel}: ${e.message}`);
    }
  }

  // Now try to get session URLs by clicking on a session title
  // The user provided: session/1766080156205001FeHz
  // Let's click on first session title to see URL pattern
  console.log('\n--- Trying to get session URLs ---');
  
  // Go back to full catalog
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Try clicking on the Opening Keynote title
  const titleClicked = await page.evaluate(() => {
    const h4s = document.querySelectorAll('h4');
    for (const h4 of h4s) {
      const clickable = h4.querySelector('[style*="cursor"]') || h4.querySelector('span') || h4;
      if (h4.textContent.includes('Opening Keynote')) {
        clickable.click();
        return h4.textContent.trim();
      }
    }
    return null;
  });
  
  if (titleClicked) {
    console.log(`Clicked title: ${titleClicked}`);
    await page.waitForTimeout(3000);
    const newUrl = page.url();
    console.log(`URL after click: ${newUrl}`);
    
    // Check if URL contains session ID
    const sessionMatch = newUrl.match(/session\/(\w+)/);
    if (sessionMatch) {
      console.log(`Session ID found: ${sessionMatch[1]}`);
    }
  }

  // Print collected session ID URLs from network
  console.log('\nSession IDs from network:', Object.keys(sessionIdMap).length);
  for (const [id, url] of Object.entries(sessionIdMap)) {
    console.log(`  ${id}: ${url}`);
  }

  console.log(`\nTotal sessions: ${allSessions.length}`);
  fs.writeFileSync('scraped_all_sessions.json', JSON.stringify(allSessions, null, 2));
  console.log('Saved to scraped_all_sessions.json');

  await browser.close();
})();

async function extractSessions(page) {
  return page.evaluate(() => {
    const results = [];
    const seen = new Set();
    
    document.querySelectorAll('h4').forEach(h4 => {
      const title = h4.textContent.trim();
      if (!title || title === 'Your Privacy' || title.includes('Cookies')) return;
      if (seen.has(title)) return;
      seen.add(title);

      const container = h4.closest('li') || h4.parentElement?.parentElement?.parentElement;
      
      const codeMatch = title.match(/,\s*([A-Z]{2,3}\d{1,3}(?:-[A-Z])?)?\s*$/);
      const code = codeMatch && codeMatch[1] ? codeMatch[1] : '';
      const cleanTitle = code ? title.replace(/,\s*[A-Z]{2,3}\d{1,3}(?:-[A-Z])?\s*$/, '').trim() : title;

      const descEl = container?.querySelector('p p') || container?.querySelector('p');
      const description = descEl?.textContent?.trim()?.substring(0, 500) || '';

      const speakers = [];
      if (container) {
        container.querySelectorAll('button[aria-label*="speaker"]').forEach(b => {
          const label = b.getAttribute('aria-label') || '';
          const match = label.match(/^(.+?)\s+speaker for/);
          if (match) speakers.push(match[1]);
        });
      }

      let day = '', time = '';
      if (container) {
        const schedBtn = container.querySelector('button[aria-label*="schedule"]');
        if (schedBtn) {
          const label = schedBtn.getAttribute('aria-label') || '';
          const dayMatch = label.match(/on\s+(Monday|Tuesday|Wednesday|Thursday),\s+Jun\s+(\d)/);
          if (dayMatch) day = `${dayMatch[1]} June ${dayMatch[2]}`;
          const timeMatch = label.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s+PDT/);
          if (timeMatch) time = timeMatch[1];
        }
      }

      results.push({ code, title: cleanTitle, description, speakers: speakers.join('; '), day, time, href: '' });
    });
    
    return results.filter(s => s.day || s.code);
  });
}
