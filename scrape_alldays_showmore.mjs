import { chromium } from 'playwright';
import fs from 'fs';

const CATALOG_URL = 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog?tab.sessioncatalogtab=1714168666431001NNiH';

const DAY_TABS = [
  { label: 'Mon, Jun 01', day: 'Monday June 1', expected: 82 },
  { label: 'Tue, Jun 02', day: 'Tuesday June 2', expected: 113 },
  { label: 'Wed, Jun 03', day: 'Wednesday June 3', expected: 127 },
  { label: 'Thu, Jun 04', day: 'Thursday June 4', expected: 63 },
];

async function clickShowMoreUntilDone(page) {
  let clicks = 0;
  for (let attempt = 0; attempt < 20; attempt++) {
    // Look for "Show more" button
    const showMoreBtn = await page.$('button.show-more-btn');
    if (!showMoreBtn) {
      // Also try text content match
      const btn = await page.$('button:has-text("Show more")');
      if (!btn) break;
      await btn.click();
    } else {
      // Check if visible
      const isVisible = await showMoreBtn.isVisible();
      if (!isVisible) break;
      await showMoreBtn.click();
    }
    clicks++;
    console.log(`    Clicked "Show more" (${clicks})`);
    await page.waitForTimeout(3000);
  }
  return clicks;
}

async function extractSessionsFromDOM(page) {
  const text = await page.evaluate(() => document.body.innerText);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const sessions = [];
  for (let i = 0; i < lines.length; i++) {
    const codeMatch = lines[i].match(/^(.+),\s*([A-Z]{1,5}\d+[A-Z\-]*)\s*$/);
    if (!codeMatch) continue;

    const title = codeMatch[1].trim();
    const code = codeMatch[2].trim();
    const timeLine = lines[i + 1] || '';
    const timeMatch = timeLine.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/);

    let desc = '';
    if (i + 2 < lines.length) {
      const candidate = lines[i + 2];
      if (candidate && !candidate.match(/^(ADD TO|Add to)/) && candidate.length > 20) {
        desc = candidate;
      }
    }

    sessions.push({ code, title, description: desc, speakers: '', time: timeMatch ? `${timeMatch[1]} - ${timeMatch[2]}` : '' });
  }
  return sessions;
}

async function extractSpeakersFromDOM(page) {
  return await page.evaluate(() => {
    const map = {};
    document.querySelectorAll('button').forEach(btn => {
      const label = btn.getAttribute('aria-label') || '';
      const m = label.match(/^(.+?)\s+speaker\s+for\s+the\s+'(.+?),\s*([A-Z]{1,5}\d+[A-Z\-]*)'/);
      if (m) {
        const name = m[1].trim();
        const code = m[3].trim();
        if (!map[code]) map[code] = [];
        if (!map[code].includes(name)) map[code].push(name);
      }
    });
    return map;
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  
  const allSessions = [];
  const speakerMap = {};

  for (const dayTab of DAY_TABS) {
    console.log(`\n=== Scraping ${dayTab.day} (expected: ${dayTab.expected}) ===`);
    
    // Fresh page load for each day
    await page.goto(CATALOG_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(6000);

    // Click the day tab
    const clicked = await page.evaluate((label) => {
      const tabs = document.querySelectorAll('[role="tab"], button');
      for (const tab of tabs) {
        const text = tab.textContent.trim();
        if (text.startsWith(label.substring(0, 10))) {
          tab.click();
          return text;
        }
      }
      return null;
    }, dayTab.label);

    if (!clicked) {
      console.log(`  Could not find tab for ${dayTab.label}`);
      continue;
    }
    console.log(`  Clicked tab: "${clicked}"`);
    await page.waitForTimeout(4000);

    // Click "Show more" repeatedly until all sessions are loaded
    console.log('  Loading all sessions...');
    await clickShowMoreUntilDone(page);
    
    // Also scroll down to trigger any lazy loading
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
    }

    // Extract sessions
    const daySessions = await extractSessionsFromDOM(page);
    console.log(`  Found ${daySessions.length} sessions`);

    // Extract speakers
    const daySpeakers = await extractSpeakersFromDOM(page);
    for (const [code, names] of Object.entries(daySpeakers)) {
      if (!speakerMap[code]) speakerMap[code] = [];
      names.forEach(n => { if (!speakerMap[code].includes(n)) speakerMap[code].push(n); });
    }

    daySessions.forEach(s => {
      s.day = dayTab.day;
      allSessions.push(s);
    });
  }

  // Deduplicate
  const seen = new Set();
  const unique = [];
  for (const s of allSessions) {
    if (!seen.has(s.code)) {
      seen.add(s.code);
      if (speakerMap[s.code]) s.speakers = speakerMap[s.code].join('; ');
      unique.push(s);
    }
  }

  console.log(`\n=== Total unique sessions: ${unique.length} ===`);
  const byDay = {};
  unique.forEach(s => { byDay[s.day] = (byDay[s.day] || 0) + 1; });
  console.log('By day:', byDay);
  console.log(`With speakers: ${unique.filter(s => s.speakers).length}/${unique.length}`);

  fs.writeFileSync('scraped_sessions.json', JSON.stringify(unique, null, 2));
  console.log(`Saved ${unique.length} sessions to scraped_sessions.json`);

  await browser.close();
})();
