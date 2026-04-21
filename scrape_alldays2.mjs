import { chromium } from 'playwright';
import fs from 'fs';

const CATALOG_URL = 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog?tab.sessioncatalogtab=1714168666431001NNiH';

const DAY_TABS = [
  { label: 'Mon, Jun 01', day: 'Monday June 1' },
  { label: 'Tue, Jun 02', day: 'Tuesday June 2' },
  { label: 'Wed, Jun 03', day: 'Wednesday June 3' },
  { label: 'Thu, Jun 04', day: 'Thursday June 4' },
];

async function extractSessions(page) {
  // Scroll to load all sessions
  let prevLen = 0;
  for (let i = 0; i < 60; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(600);
    const len = await page.evaluate(() => document.body.innerText.length);
    if (len === prevLen) break;
    prevLen = len;
  }

  const text = await page.evaluate(() => document.body.innerText);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const sessions = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match title line with session code: "TITLE, CODE"
    const codeMatch = line.match(/^(.+),\s*([A-Z]{1,5}\d+[A-Z\-]*)\s*$/);
    if (!codeMatch) continue;

    const title = codeMatch[1].trim();
    const code = codeMatch[2].trim();

    // Next line has the time range
    const timeLine = lines[i + 1] || '';
    // Description follows
    const descLine = lines[i + 2] || '';

    // Extract time from the time line
    const timeMatch = timeLine.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/);
    const startTime = timeMatch ? timeMatch[1] : '';

    // Look backwards for speaker names (above the title in the DOM sometimes)
    // Actually speakers are in the previous card's content; we'll enrich later
    let speakers = '';
    // Check for speaker buttons near this session
    // We'll get speakers from the existing scraped data or from detail pages

    sessions.push({
      code,
      title,
      description: descLine.startsWith('ADD TO') ? '' : descLine,
      speakers: '',
      time: startTime,
      href: '',
    });
  }

  return sessions;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const allSessions = [];

  for (const dayTab of DAY_TABS) {
    console.log(`\n=== Scraping ${dayTab.day} ===`);
    
    await page.goto(CATALOG_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);

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
    await page.waitForTimeout(3000);

    // Extract sessions for this day
    const daySessions = await extractSessions(page);
    console.log(`  Found ${daySessions.length} sessions`);

    // Tag each with the day
    daySessions.forEach(s => {
      s.day = dayTab.day;
      allSessions.push(s);
    });
  }

  // Now also get speaker info per session by extracting from the full page
  // Go back to "All Days" and get speaker buttons
  console.log('\n=== Getting speaker info from All Days view ===');
  await page.goto(CATALOG_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Click "All Days" tab
  await page.evaluate(() => {
    const tabs = document.querySelectorAll('[role="tab"], button');
    for (const tab of tabs) {
      if (tab.textContent.trim().startsWith('All Days')) {
        tab.click();
        return;
      }
    }
  });
  await page.waitForTimeout(3000);

  // Scroll to load all
  for (let i = 0; i < 100; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const height = await page.evaluate(() => document.body.scrollHeight);
    if (i > 5) {
      const newHeight = await page.evaluate(() => document.body.scrollHeight);
      if (newHeight === height) break;
    }
  }

  // Extract speaker info from "Add to Schedule" button labels
  const speakerMap = await page.evaluate(() => {
    const map = {};
    // Speaker buttons have format: "Name speaker for the 'Session Title, CODE' session"
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
  console.log(`  Found speakers for ${Object.keys(speakerMap).length} sessions`);

  // Enrich sessions with speaker info
  allSessions.forEach(s => {
    if (speakerMap[s.code]) {
      s.speakers = speakerMap[s.code].join('; ');
    }
  });

  // Also extract speakers from each day tab view
  for (const dayTab of DAY_TABS) {
    console.log(`  Getting speakers for ${dayTab.day}...`);
    await page.evaluate((label) => {
      const tabs = document.querySelectorAll('[role="tab"], button');
      for (const tab of tabs) {
        if (tab.textContent.trim().startsWith(label.substring(0, 10))) {
          tab.click();
          return;
        }
      }
    }, dayTab.label);
    await page.waitForTimeout(2000);
    
    // Scroll
    for (let i = 0; i < 40; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);
    }

    const daySpeakers = await page.evaluate(() => {
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

    // Merge
    for (const [code, names] of Object.entries(daySpeakers)) {
      const session = allSessions.find(s => s.code === code);
      if (session && !session.speakers) {
        session.speakers = names.join('; ');
      }
    }
  }

  // Deduplicate by code
  const seen = new Set();
  const unique = [];
  for (const s of allSessions) {
    if (!seen.has(s.code)) {
      seen.add(s.code);
      unique.push(s);
    }
  }

  console.log(`\n=== Total unique sessions: ${unique.length} ===`);
  const byDay = {};
  unique.forEach(s => { byDay[s.day] = (byDay[s.day] || 0) + 1; });
  console.log('By day:', byDay);

  const withSpeakers = unique.filter(s => s.speakers).length;
  console.log(`With speakers: ${withSpeakers} / ${unique.length}`);

  fs.writeFileSync('scraped_sessions.json', JSON.stringify(unique, null, 2));
  console.log(`\nSaved ${unique.length} sessions to scraped_sessions.json`);

  await browser.close();
})();
