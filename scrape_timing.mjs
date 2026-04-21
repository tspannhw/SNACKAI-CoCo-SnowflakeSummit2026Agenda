import { chromium } from 'playwright';
import fs from 'fs';

const TIM_URL = 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog/session/1766080156205001FeHz';
const CATALOG_URL = 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog?tab.sessioncatalogtab=1714168666431001NNiH';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // First check Tim Spann's individual session page for duration/type info
  console.log('=== Checking Tim Spann session page ===');
  await page.goto(TIM_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  const timText = await page.evaluate(() => document.body.innerText);
  const timLines = timText.split('\n').filter(l => l.trim().length > 0);
  console.log('Page lines:', timLines.length);
  timLines.forEach(l => console.log('  ' + l.substring(0, 120)));

  // Now check the catalog page for session cards - look for duration/type badges
  console.log('\n=== Checking catalog page for duration/type info ===');
  await page.goto(CATALOG_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);

  // Scroll to load content
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
  }

  // Get full text to see what metadata is shown per session
  const catText = await page.evaluate(() => document.body.innerText);
  const catLines = catText.split('\n').filter(l => l.trim().length > 0);
  
  // Find lines around "DE242" or "Tim Spann" or "Real-Time, Multimodal"
  console.log('\nLines containing session-related keywords:');
  catLines.forEach((l, i) => {
    if (l.includes('DE242') || l.includes('Tim Spann') || l.includes('Multimodal')) {
      // Show context: 3 lines before and after
      for (let j = Math.max(0, i-3); j <= Math.min(catLines.length-1, i+3); j++) {
        console.log(`  [${j}] ${catLines[j].substring(0, 150)}`);
      }
      console.log('  ---');
    }
  });

  // Also look for any duration/time patterns like "20 min", "45 min", "Breakout", "Lightning"
  console.log('\nLines with duration/format keywords:');
  catLines.forEach((l, i) => {
    if (l.match(/\d+\s*min|lightning|breakout|session type|duration|hands.on|lab|demo|deep.dive/i)) {
      console.log(`  [${i}] ${l.substring(0, 150)}`);
    }
  });

  // Check for filter/tag elements that might show session types
  const filterData = await page.evaluate(() => {
    const results = [];
    // Look for filter buttons, checkboxes, tags
    document.querySelectorAll('button, [role="checkbox"], [class*="filter"], [class*="tag"], [class*="badge"]').forEach(el => {
      const text = el.textContent.trim();
      if (text.length > 2 && text.length < 50 && text.match(/min|lightning|breakout|hands|lab|demo|deep|talk|type/i)) {
        results.push(text);
      }
    });
    return [...new Set(results)];
  });
  console.log('\nFilter/badge elements with type info:', filterData);

  await browser.close();
})();
