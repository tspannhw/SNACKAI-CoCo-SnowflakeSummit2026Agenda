import { chromium } from 'playwright';

const BASE = 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog';
const URL = `${BASE}?tab.sessioncatalogtab=1714168666431001NNiH`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Opening catalog...');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Get snapshot of page content
  const html = await page.content();
  console.log('Page HTML length:', html.length);

  // Try to find session elements
  const data = await page.evaluate(() => {
    const results = [];

    // Look for all heading level 4 (session titles in RainFocus)
    document.querySelectorAll('h4').forEach(h => {
      const parent = h.closest('li') || h.closest('[class*="item"]') || h.parentElement?.parentElement;
      const link = h.querySelector('a') || h.closest('a') || parent?.querySelector('a[href*="session"]');
      const desc = parent?.querySelector('p')?.textContent?.trim() || '';
      const buttons = parent?.querySelectorAll('button') || [];
      let schedule = '';
      buttons.forEach(b => {
        const label = b.getAttribute('aria-label') || b.textContent || '';
        if (label.includes('schedule') || label.includes('Add')) schedule = label;
      });
      results.push({
        title: h.textContent.trim(),
        href: link?.href || '',
        description: desc.substring(0, 200),
        schedule: schedule
      });
    });

    // Also try looking for any anchor links with session in URL
    const sessionLinks = [];
    document.querySelectorAll('a[href*="session/"]').forEach(a => {
      sessionLinks.push({ text: a.textContent.trim().substring(0, 100), href: a.href });
    });

    // Get all buttons with session scheduling info
    const scheduleButtons = [];
    document.querySelectorAll('button[aria-label*="session"]').forEach(b => {
      scheduleButtons.push(b.getAttribute('aria-label'));
    });

    return { h4Results: results, sessionLinks, scheduleButtons };
  });

  console.log('\n=== H4 Results ===');
  console.log(JSON.stringify(data.h4Results, null, 2));

  console.log('\n=== Session Links ===');
  console.log(JSON.stringify(data.sessionLinks, null, 2));

  console.log('\n=== Schedule Buttons ===');
  console.log(JSON.stringify(data.scheduleButtons, null, 2));

  // Now try to find the search/filter area and look for a "show all" or load more button
  const allText = await page.evaluate(() => document.body.innerText);
  // Extract lines that look like session info
  const lines = allText.split('\n').filter(l => l.trim().length > 10);
  console.log('\n=== Page Text Lines (first 100) ===');
  lines.slice(0, 100).forEach(l => console.log(l));

  // Check for search input
  const searchInput = await page.$('input[type="search"], input[placeholder*="earch"], input[placeholder*="filter"]');
  if (searchInput) {
    console.log('\n=== Found search input, searching for Tim Spann ===');
    await searchInput.fill('Tim Spann');
    await page.waitForTimeout(3000);
    
    const afterSearch = await page.evaluate(() => document.body.innerText);
    const searchLines = afterSearch.split('\n').filter(l => l.trim().length > 10);
    console.log('\n=== Search results for Tim Spann ===');
    searchLines.slice(0, 50).forEach(l => console.log(l));
  }

  await browser.close();
})();
