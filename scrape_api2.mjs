import { chromium } from 'playwright';
import fs from 'fs';

const CATALOG_URL = 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog?tab.sessioncatalogtab=1714168666431001NNiH';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture the sessions API request to see the payload
  let sessionsRequest = null;
  
  page.on('request', async req => {
    const url = req.url();
    if (url === 'https://events.summit.snowflake.com/api/sessions') {
      sessionsRequest = {
        method: req.method(),
        url: url,
        headers: req.headers(),
        postData: req.postData(),
      };
    }
  });

  console.log('Loading catalog to capture API request...');
  await page.goto(CATALOG_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(10000);

  if (!sessionsRequest) {
    console.log('ERROR: Did not capture sessions API request');
    await browser.close();
    process.exit(1);
  }

  console.log('\n=== Sessions API Request ===');
  console.log(`Method: ${sessionsRequest.method}`);
  console.log(`URL: ${sessionsRequest.url}`);
  console.log('\nHeaders:');
  Object.entries(sessionsRequest.headers).forEach(([k, v]) => {
    if (!k.startsWith('sec-') && k !== 'user-agent') {
      console.log(`  ${k}: ${v.substring(0, 120)}`);
    }
  });
  console.log('\nPost Data:');
  if (sessionsRequest.postData) {
    try {
      const parsed = JSON.parse(sessionsRequest.postData);
      console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log(sessionsRequest.postData.substring(0, 2000));
    }
  }

  // Now try to call the API with a larger page size from within the browser context
  console.log('\n=== Trying to call API with size=500 ===');
  const payload = sessionsRequest.postData ? JSON.parse(sessionsRequest.postData) : {};
  
  // Modify size/count parameters
  if (payload.size) payload.size = 500;
  if (payload.count) payload.count = 500;
  if (payload.numItems) payload.numItems = 500;
  if (payload.pageSize) payload.pageSize = 500;
  
  // Also try adding common pagination params
  payload.size = 500;

  const result = await page.evaluate(async (params) => {
    const { url, headers, payload } = params;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return {
        totalSearchItems: data.totalSearchItems,
        sections: data.sectionList?.length,
        itemCount: data.sectionList?.[0]?.items?.length || 0,
        numItems: data.sectionList?.[0]?.numItems || 0,
        keys: Object.keys(data).join(', '),
        sectionKeys: data.sectionList?.[0] ? Object.keys(data.sectionList[0]).join(', ') : '',
      };
    } catch (e) {
      return { error: e.message };
    }
  }, { url: sessionsRequest.url, headers: sessionsRequest.headers, payload });

  console.log('Result:', JSON.stringify(result, null, 2));

  await browser.close();
})();
