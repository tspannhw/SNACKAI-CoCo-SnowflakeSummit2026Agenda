import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog';
const URL = `${BASE}?tab.sessioncatalogtab=1714168666431001NNiH`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 1. Check what session the user's example URL points to
  console.log('=== Checking example session URL ===');
  await page.goto(`${BASE}/session/1766080156205001FeHz`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);
  const exampleSession = await page.evaluate(() => {
    const h4s = document.querySelectorAll('h4');
    const results = [];
    h4s.forEach(h => results.push(h.textContent.trim()));
    const ps = document.querySelectorAll('p');
    const descs = [];
    ps.forEach(p => { if (p.textContent.trim().length > 50) descs.push(p.textContent.trim().substring(0, 200)); });
    return { titles: results, descriptions: descs.slice(0, 5), bodyText: document.body.innerText.substring(0, 2000) };
  });
  console.log('Session from URL:', JSON.stringify(exampleSession, null, 2));

  // 2. Open the main catalog and try infinite scroll to get ALL sessions
  console.log('\n=== Loading full catalog with aggressive scroll ===');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  let prevCount = 0;
  let stableCount = 0;
  for (let i = 0; i < 100; i++) {
    const count = await page.evaluate(() => document.querySelectorAll('h4').length);
    if (count === prevCount) {
      stableCount++;
      if (stableCount > 5) {
        console.log(`Scroll done at iteration ${i}: ${count} total h4 elements`);
        break;
      }
    } else {
      stableCount = 0;
    }
    prevCount = count;
    if (i % 10 === 0) console.log(`  Scroll ${i}: ${count} h4s`);
    
    // Scroll aggressively
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
    
    // Also try clicking "Load more" or "Show more" if it exists
    if (i % 5 === 0) {
      await page.evaluate(() => {
        const btns = document.querySelectorAll('button, a');
        for (const b of btns) {
          const t = b.textContent.trim().toLowerCase();
          if (t.includes('load more') || t.includes('show more') || t.includes('view more') || t.includes('next')) {
            b.click();
            return true;
          }
        }
        return false;
      });
    }
  }

  // 3. Extract ALL sessions from the fully loaded page
  const allSessions = await page.evaluate(() => {
    const results = [];
    const seen = new Set();
    
    document.querySelectorAll('h4').forEach(h4 => {
      const title = h4.textContent.trim();
      if (!title || title === 'Your Privacy' || title.includes('Cookies') || title.includes('Strictly Necessary') || title.includes('Performance Cookies') || title.includes('Functional Cookies') || title.includes('Targeting Cookies')) return;
      if (seen.has(title)) return;
      seen.add(title);

      const container = h4.closest('li') || h4.parentElement?.parentElement?.parentElement;
      
      const codeMatch = title.match(/,\s*([A-Z]{2,3}\d{1,3}(?:-[A-Z])?)$/);
      const code = codeMatch ? codeMatch[1] : '';
      const cleanTitle = code ? title.replace(/,\s*[A-Z]{2,3}\d{1,3}(?:-[A-Z])?$/, '').trim() : title;

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

      let day = '', time = '', format = '', track = '';
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

      // Try to determine format from session code prefix or container classes
      if (code.startsWith('K')) format = 'Keynote';
      else if (code.match(/^TC/)) format = 'Training';
      else if (title.includes('Hands-on') || title.includes('hands-on') || code.match(/\d{3}$/)) format = '';

      results.push({ code, title: cleanTitle, description, speakers: speakers.join('; '), day, time, href: '' });
    });
    
    return results.filter(s => s.day || s.code);
  });

  console.log(`\nTotal extracted: ${allSessions.length} sessions`);
  
  // Count by day
  const dayCounts = {};
  allSessions.forEach(s => { dayCounts[s.day || 'Unknown'] = (dayCounts[s.day || 'Unknown'] || 0) + 1; });
  console.log('By day:', JSON.stringify(dayCounts, null, 2));

  fs.writeFileSync('scraped_all_sessions.json', JSON.stringify(allSessions, null, 2));
  console.log('Saved to scraped_all_sessions.json');

  // Print Tim's session
  const tim = allSessions.find(s => s.speakers.includes('Tim Spann') || s.code === 'DE242');
  if (tim) {
    console.log('\n=== TIM SPANN ===');
    console.log(JSON.stringify(tim, null, 2));
  }

  await browser.close();
})();
