import { chromium } from 'playwright';
import fs from 'fs';

const CATALOG_URL = 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog?tab.sessioncatalogtab=1714168666431001NNiH';

const DAY_TABS = [
  { label: 'Mon, Jun 01', day: 'Monday June 1' },
  { label: 'Tue, Jun 02', day: 'Tuesday June 2' },
  { label: 'Wed, Jun 03', day: 'Wednesday June 3' },
  { label: 'Thu, Jun 04', day: 'Thursday June 4' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });

  // Collect all API session items
  const allApiItems = [];

  page.on('response', async res => {
    if (res.url() === 'https://events.summit.snowflake.com/api/sessions') {
      try {
        const body = await res.text();
        const data = JSON.parse(body);
        const items = data.sectionList?.[0]?.items || [];
        items.forEach(item => allApiItems.push(item));
        console.log(`    [API] Captured ${items.length} items (total so far: ${allApiItems.length})`);
      } catch (e) {}
    }
  });

  for (const dayTab of DAY_TABS) {
    console.log(`\n=== ${dayTab.day} ===`);
    
    await page.goto(CATALOG_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(6000);

    // Click day tab
    await page.evaluate((label) => {
      const tabs = document.querySelectorAll('[role="tab"], button');
      for (const tab of tabs) {
        if (tab.textContent.trim().startsWith(label.substring(0, 10))) {
          tab.click();
          return;
        }
      }
    }, dayTab.label);
    console.log(`  Clicked ${dayTab.label} tab`);
    await page.waitForTimeout(4000);

    // Click "Show more" repeatedly
    for (let attempt = 0; attempt < 10; attempt++) {
      const btn = await page.$('button.show-more-btn');
      if (!btn) break;
      const visible = await btn.isVisible();
      if (!visible) break;
      await btn.click();
      console.log(`  Clicked "Show more"`);
      await page.waitForTimeout(3000);
    }
  }

  // Deduplicate by sessionID
  const seen = new Set();
  const unique = [];
  for (const item of allApiItems) {
    if (!seen.has(item.sessionID)) {
      seen.add(item.sessionID);
      unique.push(item);
    }
  }

  console.log(`\n=== Total unique API sessions: ${unique.length} ===`);

  // Stats
  const byDay = {};
  const byType = {};
  unique.forEach(item => {
    const day = item.times?.[0]?.dayName || 'Unknown';
    byDay[day] = (byDay[day] || 0) + 1;
    const type = item.type || 'Unknown';
    byType[type] = (byType[type] || 0) + 1;
  });
  console.log('By day:', byDay);
  console.log('By type:', byType);

  fs.writeFileSync('api_sessions_all.json', JSON.stringify(unique, null, 2));
  console.log(`Saved ${unique.length} sessions to api_sessions_all.json`);

  await browser.close();
})();
