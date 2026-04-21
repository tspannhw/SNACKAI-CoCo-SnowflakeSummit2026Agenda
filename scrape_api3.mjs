import { chromium } from 'playwright';
import fs from 'fs';

const CATALOG_URL = 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog?tab.sessioncatalogtab=1714168666431001NNiH';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture the sessions API request details
  let capturedHeaders = {};
  let capturedPostData = '';
  
  page.on('request', req => {
    if (req.url() === 'https://events.summit.snowflake.com/api/sessions') {
      capturedHeaders = req.headers();
      capturedPostData = req.postData();
    }
  });

  console.log('Loading catalog to capture API request...');
  await page.goto(CATALOG_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(10000);

  console.log('Captured post data:', capturedPostData);
  console.log('Key headers:');
  console.log('  rfapiprofileid:', capturedHeaders.rfapiprofileid);
  console.log('  rfwidgetid:', capturedHeaders.rfwidgetid);

  // Try calling with different sizes via the browser context (reuse cookies/headers)
  const apiUrl = 'https://events.summit.snowflake.com/api/sessions';
  
  // Parse the form data and add size parameter
  const params = new URLSearchParams(capturedPostData);
  
  // Try adding common RainFocus pagination params
  params.set('size', '500');
  params.set('from', '0');

  console.log('\n=== Trying with size=500, from=0 ===');
  const result1 = await page.evaluate(async ({ url, body, profileId, widgetId }) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'rfapiprofileid': profileId,
          'rfwidgetid': widgetId,
        },
        body: body,
      });
      const data = await res.json();
      return {
        totalSearchItems: data.totalSearchItems,
        sections: data.sectionList?.length,
        itemCount: data.sectionList?.[0]?.items?.length || 0,
        numItems: data.sectionList?.[0]?.numItems || 0,
        total: data.sectionList?.[0]?.total || 0,
      };
    } catch (e) {
      return { error: e.message };
    }
  }, { url: apiUrl, body: params.toString(), profileId: capturedHeaders.rfapiprofileid, widgetId: capturedHeaders.rfwidgetid });
  console.log('Result:', JSON.stringify(result1, null, 2));

  // If that didn't work, try getting all pages
  console.log('\n=== Paginating through API ===');
  let allItems = [];
  let from = 0;
  const pageSize = 50;
  
  for (let page_num = 0; page_num < 10; page_num++) {
    const pageParams = new URLSearchParams(capturedPostData);
    pageParams.set('from', String(from));
    
    const pageResult = await page.evaluate(async ({ url, body, profileId, widgetId }) => {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'rfapiprofileid': profileId,
            'rfwidgetid': widgetId,
          },
          body: body,
        });
        const data = await res.json();
        const items = data.sectionList?.[0]?.items || [];
        return {
          total: data.totalSearchItems,
          count: items.length,
          items: items,
        };
      } catch (e) {
        return { error: e.message, count: 0, items: [] };
      }
    }, { url: apiUrl, body: pageParams.toString(), profileId: capturedHeaders.rfapiprofileid, widgetId: capturedHeaders.rfwidgetid });

    console.log(`  Page ${page_num + 1} (from=${from}): ${pageResult.count} items (total: ${pageResult.total})`);
    
    if (pageResult.items.length === 0) break;
    allItems = allItems.concat(pageResult.items);
    from += pageResult.count;
    
    if (allItems.length >= (pageResult.total || 999)) break;
  }

  console.log(`\n=== Total sessions fetched: ${allItems.length} ===`);

  // Save all session data
  fs.writeFileSync('api_sessions_all.json', JSON.stringify(allItems, null, 2));
  console.log('Saved to api_sessions_all.json');

  // Quick stats
  const byDay = {};
  const byType = {};
  allItems.forEach(item => {
    const time = item.times?.[0];
    const day = time ? time.dayName : 'Unknown';
    byDay[day] = (byDay[day] || 0) + 1;
    const type = item.type || 'Unknown';
    byType[type] = (byType[type] || 0) + 1;
  });
  console.log('\nBy day:', byDay);
  console.log('By type:', byType);

  // Show some codes
  console.log('\nSample codes:');
  allItems.slice(0, 5).forEach(i => console.log(`  ${i.code}: ${i.title}`));
  allItems.slice(-5).forEach(i => console.log(`  ${i.code}: ${i.title}`));

  await browser.close();
})();
