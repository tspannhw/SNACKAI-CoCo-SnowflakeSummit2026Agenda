import { chromium } from 'playwright';
import fs from 'fs';

const CATALOG_URL = 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog?tab.sessioncatalogtab=1714168666431001NNiH';

const DAY_TABS = [
  { label: 'Mon, Jun 01', day: 'Monday June 1' },
  { label: 'Tue, Jun 02', day: 'Tuesday June 2' },
  { label: 'Wed, Jun 03', day: 'Wednesday June 3' },
  { label: 'Thu, Jun 04', day: 'Thursday June 4' },
];

async function scrollToBottom(page, maxScrolls = 120) {
  let prevHeight = 0;
  let sameCount = 0;
  for (let i = 0; i < maxScrolls; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
    const height = await page.evaluate(() => document.body.scrollHeight);
    if (height === prevHeight) {
      sameCount++;
      if (sameCount >= 5) break;  // Height hasn't changed in 5 scrolls
    } else {
      sameCount = 0;
    }
    prevHeight = height;
  }
}

async function extractSessionsFromPage(page) {
  const text = await page.evaluate(() => document.body.innerText);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const sessions = [];
  for (let i = 0; i < lines.length; i++) {
    // Match "TITLE, CODE" pattern
    const codeMatch = lines[i].match(/^(.+),\s*([A-Z]{1,5}\d+[A-Z\-]*)\s*$/);
    if (!codeMatch) continue;

    const title = codeMatch[1].trim();
    const code = codeMatch[2].trim();

    // Next line should be date/time
    const timeLine = lines[i + 1] || '';
    const timeMatch = timeLine.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/);

    // Description - line after time
    let desc = '';
    if (i + 2 < lines.length) {
      const candidate = lines[i + 2];
      if (candidate && !candidate.match(/^(ADD TO|Add to|EXPAND|Expand|FILTER|Filter)/) && candidate.length > 20) {
        desc = candidate;
      }
    }

    sessions.push({
      code,
      title,
      description: desc,
      speakers: '',
      time: timeMatch ? `${timeMatch[1]} - ${timeMatch[2]}` : '',
      startTime: timeMatch ? timeMatch[1] : '',
      endTime: timeMatch ? timeMatch[2] : '',
      href: '',
    });
  }

  return sessions;
}

async function extractSpeakers(page) {
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

async function extractLinks(page) {
  return await page.evaluate(() => {
    const map = {};
    document.querySelectorAll('a').forEach(a => {
      const text = (a.textContent || '').trim();
      const m = text.match(/^(.+),\s*([A-Z]{1,5}\d+[A-Z\-]*)\s*$/);
      if (m) {
        map[m[2].trim()] = a.href;
      }
    });
    return map;
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Use a longer viewport to help load more items
  await page.setViewportSize({ width: 1920, height: 4000 });
  
  const allSessions = [];
  const speakerMap = {};
  const linkMap = {};

  for (const dayTab of DAY_TABS) {
    console.log(`\n=== Scraping ${dayTab.day} ===`);
    
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

    // Aggressively scroll to load all lazy content
    console.log('  Scrolling to load all sessions...');
    await scrollToBottom(page, 150);

    // Extract sessions
    const daySessions = await extractSessionsFromPage(page);
    console.log(`  Found ${daySessions.length} sessions`);

    // Extract speakers for this day view
    const daySpeakers = await extractSpeakers(page);
    for (const [code, names] of Object.entries(daySpeakers)) {
      if (!speakerMap[code]) speakerMap[code] = [];
      names.forEach(n => { if (!speakerMap[code].includes(n)) speakerMap[code].push(n); });
    }
    console.log(`  Found speakers for ${Object.keys(daySpeakers).length} sessions on this day`);

    // Extract links
    const dayLinks = await extractLinks(page);
    Object.assign(linkMap, dayLinks);

    daySessions.forEach(s => {
      s.day = dayTab.day;
      allSessions.push(s);
    });
  }

  // Deduplicate by code
  const seen = new Set();
  const unique = [];
  for (const s of allSessions) {
    if (!seen.has(s.code)) {
      seen.add(s.code);
      // Enrich with speakers and links
      if (speakerMap[s.code]) s.speakers = speakerMap[s.code].join('; ');
      if (linkMap[s.code]) s.href = linkMap[s.code];
      unique.push(s);
    }
  }

  console.log(`\n=== Total unique sessions: ${unique.length} ===`);
  const byDay = {};
  unique.forEach(s => { byDay[s.day] = (byDay[s.day] || 0) + 1; });
  console.log('By day:', byDay);

  const withSpeakers = unique.filter(s => s.speakers).length;
  console.log(`With speakers: ${withSpeakers}/${unique.length}`);

  fs.writeFileSync('scraped_sessions.json', JSON.stringify(unique, null, 2));
  console.log(`\nSaved ${unique.length} sessions to scraped_sessions.json`);

  await browser.close();
})();
