import { chromium } from 'playwright';
import fs from 'fs';

const CATALOG_URL = 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog?tab.sessioncatalogtab=1714168666431001NNiH';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture the sessions API response
  let sessionsData = null;
  let attributesData = null;

  page.on('response', async res => {
    const url = res.url();
    try {
      if (url === 'https://events.summit.snowflake.com/api/sessions') {
        const body = await res.text();
        sessionsData = JSON.parse(body);
        console.log(`Captured sessions API: ${body.length} bytes, ${sessionsData.totalSearchItems} items`);
      }
      if (url === 'https://events.summit.snowflake.com/api/attributes') {
        const body = await res.text();
        attributesData = JSON.parse(body);
        console.log(`Captured attributes API: ${body.length} bytes`);
      }
    } catch (e) {}
  });

  console.log('Loading catalog to capture API calls...');
  await page.goto(CATALOG_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(10000);

  if (!sessionsData) {
    console.log('ERROR: Did not capture sessions API response');
    await browser.close();
    process.exit(1);
  }

  // Save raw API responses
  fs.writeFileSync('api_sessions_raw.json', JSON.stringify(sessionsData, null, 2));
  console.log(`\nSaved raw sessions API to api_sessions_raw.json`);
  
  if (attributesData) {
    fs.writeFileSync('api_attributes_raw.json', JSON.stringify(attributesData, null, 2));
    console.log(`Saved raw attributes API to api_attributes_raw.json`);
  }

  // Extract session data
  const sections = sessionsData.sectionList || [];
  console.log(`\nSections: ${sections.length}`);
  
  let allItems = [];
  sections.forEach(section => {
    const items = section.items || [];
    allItems = allItems.concat(items);
    console.log(`  Section "${section.sectionTitle || 'default'}": ${items.length} items`);
  });

  console.log(`\nTotal items: ${allItems.length}`);

  // Examine the structure of the first item
  if (allItems.length > 0) {
    const first = allItems[0];
    console.log('\n=== First item keys ===');
    console.log(Object.keys(first).join(', '));
    console.log('\n=== First item sample ===');
    console.log(JSON.stringify(first, null, 2).substring(0, 2000));
  }

  // Look at a few items to understand the structure
  console.log('\n=== Sample session codes and titles ===');
  allItems.slice(0, 10).forEach(item => {
    console.log(`  ${item.code || item.abbreviation || '???'}: ${(item.title || item.name || '???').substring(0, 80)}`);
  });

  await browser.close();
})();
