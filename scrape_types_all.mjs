import { chromium } from 'playwright';
import fs from 'fs';

const CATALOG_URL = 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog?tab.sessioncatalogtab=1714168666431001NNiH';

const SESSION_TYPES = ['Breakout Session', 'Theater Session', 'Hands-on Lab', 'Keynote', 'Executive Content', 'Dev Day Luminary Talk'];

async function clickShowMore(page) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const btn = await page.$('button.show-more-btn');
    if (!btn) break;
    const visible = await btn.isVisible();
    if (!visible) break;
    await btn.click();
    await page.waitForTimeout(3000);
  }
}

async function extractCodes(page) {
  const text = await page.evaluate(() => document.body.innerText);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const codes = [];
  lines.forEach(l => {
    const m = l.match(/,\s*([A-Z]{1,5}\d+[A-Z\-]*)\s*$/);
    if (m) codes.push(m[1]);
  });
  return codes;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const typeMap = {}; // code -> sessionType

  for (const sessionType of SESSION_TYPES) {
    console.log(`\n=== Filtering by: ${sessionType} ===`);
    await page.goto(CATALOG_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(6000);

    // Click "All Days" tab first to see all sessions
    await page.evaluate(() => {
      const tabs = document.querySelectorAll('[role="tab"], button');
      for (const tab of tabs) {
        if (tab.textContent.trim().startsWith('All Days')) { tab.click(); return; }
      }
    });
    await page.waitForTimeout(3000);

    // Click "Session Type" filter expand button
    const expandBtn = await page.$('button:has-text("Session Type")');
    if (expandBtn) {
      await expandBtn.click();
      await page.waitForTimeout(1500);
    }

    // Click the specific type checkbox/label
    const clicked = await page.evaluate((type) => {
      // Try checkbox inputs first
      const inputs = document.querySelectorAll('input[type="checkbox"]');
      for (const inp of inputs) {
        const label = inp.getAttribute('aria-label') || '';
        if (label === type || label.includes(type)) {
          inp.click();
          return `input: ${label}`;
        }
      }
      // Try labels and spans
      const elements = document.querySelectorAll('label, span, div, button');
      for (const el of elements) {
        const text = el.textContent?.trim();
        if (text === type) {
          el.click();
          return `element: ${text}`;
        }
      }
      return null;
    }, sessionType);

    if (!clicked) {
      console.log(`  Could not find filter for ${sessionType}`);
      continue;
    }
    console.log(`  Clicked: ${clicked}`);
    await page.waitForTimeout(4000);

    // Click show more to load all filtered results
    await clickShowMore(page);

    // Extract codes
    const codes = await extractCodes(page);
    console.log(`  Found ${codes.length} sessions`);
    codes.forEach(code => { typeMap[code] = sessionType; });
  }

  // Also handle Training type by code prefix
  const dom = JSON.parse(fs.readFileSync('scraped_sessions.json', 'utf8'));
  dom.forEach(s => {
    if (!typeMap[s.code]) {
      if (s.code.startsWith('TC')) typeMap[s.code] = 'Snowflake Training';
      else if (s.code.startsWith('K')) typeMap[s.code] = 'Keynote';
    }
  });

  // Also check for "Snowflake Training" filter
  console.log('\n=== Filtering by: Snowflake Training ===');
  await page.goto(CATALOG_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(6000);
  
  await page.evaluate(() => {
    const tabs = document.querySelectorAll('[role="tab"], button');
    for (const tab of tabs) {
      if (tab.textContent.trim().startsWith('All Days')) { tab.click(); return; }
    }
  });
  await page.waitForTimeout(3000);

  const expandBtn2 = await page.$('button:has-text("Session Type")');
  if (expandBtn2) {
    await expandBtn2.click();
    await page.waitForTimeout(1500);
  }
  
  const clickedTraining = await page.evaluate(() => {
    const elements = document.querySelectorAll('input[type="checkbox"], label, span');
    for (const el of elements) {
      const text = (el.textContent || el.getAttribute('aria-label') || '').trim();
      if (text === 'Snowflake Training' || text.includes('Training')) {
        el.click();
        return text;
      }
    }
    return null;
  });
  if (clickedTraining) {
    console.log(`  Clicked: ${clickedTraining}`);
    await page.waitForTimeout(4000);
    await clickShowMore(page);
    const codes = await extractCodes(page);
    console.log(`  Found ${codes.length} training sessions`);
    codes.forEach(code => { typeMap[code] = 'Snowflake Training'; });
  }

  console.log(`\n=== Total type mappings: ${Object.keys(typeMap).length} ===`);
  const typeCounts = {};
  Object.values(typeMap).forEach(t => { typeCounts[t] = (typeCounts[t] || 0) + 1; });
  console.log('By type:', typeCounts);

  // Check coverage against DOM data
  const unmapped = dom.filter(s => !typeMap[s.code]).map(s => s.code);
  console.log(`Unmapped: ${unmapped.length} - ${unmapped.join(', ')}`);

  fs.writeFileSync('session_types_all.json', JSON.stringify(typeMap, null, 2));
  console.log(`Saved session_types_all.json`);

  await browser.close();
})();
