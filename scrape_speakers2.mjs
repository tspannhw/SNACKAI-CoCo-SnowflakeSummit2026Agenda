import { chromium } from 'playwright';
import fs from 'fs';

const URL = 'https://reg.snowflake.com/flow/snowflake/summit26/speakers/page/catalog';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Opening speakers catalog...');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(10000);

  // Get full page text to understand structure
  const bodyText = await page.evaluate(() => document.body.innerText);
  const lines = bodyText.split('\n').filter(l => l.trim().length > 2);
  console.log(`\n=== Page text (${lines.length} lines) ===`);
  lines.slice(0, 150).forEach(l => console.log(l));

  // Also check all elements with text content
  const elements = await page.evaluate(() => {
    const results = [];
    const tags = ['h1','h2','h3','h4','h5','h6','p','span','a','button','li','div'];
    for (const tag of tags) {
      const els = document.querySelectorAll(tag);
      let count = 0;
      els.forEach(el => {
        const text = el.textContent.trim();
        if (text.length > 3 && text.length < 100) count++;
      });
      if (count > 0) results.push({ tag, count });
    }
    return results;
  });
  console.log('\n=== Element counts ===');
  elements.forEach(e => console.log(`  ${e.tag}: ${e.count}`));

  // Look specifically for speaker-related elements
  const speakerData = await page.evaluate(() => {
    const results = [];
    // Try various selector patterns for speaker cards
    const selectors = [
      '[class*="speaker"]',
      '[class*="Speaker"]',
      '[class*="card"]',
      '[class*="profile"]',
      '[class*="person"]',
      '[class*="item"]',
      'li',
      '[role="listitem"]'
    ];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        results.push({ selector: sel, count: els.length });
        // Get first few items' text
        const texts = [];
        els.forEach((el, i) => {
          if (i < 3) texts.push(el.textContent.trim().substring(0, 200));
        });
        results[results.length - 1].samples = texts;
      }
    }
    return results;
  });
  console.log('\n=== Speaker-related elements ===');
  speakerData.forEach(d => {
    console.log(`  ${d.selector}: ${d.count} elements`);
    d.samples?.forEach(s => console.log(`    Sample: ${s.substring(0, 100)}`));
  });

  await browser.close();
})();
