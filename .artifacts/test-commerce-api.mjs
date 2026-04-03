import { chromium } from 'playwright';

const siteUrl = 'https://americanbookcompany.my.site.com/AmericanBookCompany/#Georgia';
const webStoreId = '0ZEam000004dJDNGA2';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

console.log('1. Loading site...');
await page.goto(siteUrl, { waitUntil: 'load', timeout: 60000 });
await page.waitForSelector('c-state-filter-lwc', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2000);

// Test 1: with asGuest=true (current code approach)
const test1 = await page.evaluate(async (wsId) => {
  try {
    const r = await fetch(`/AmericanBookCompany/webruntime/api/services/data/v66.0/commerce/webstores/${wsId}/search/products?searchTerm=English&pageSize=1&asGuest=true&language=en-US`, { credentials: 'same-origin' });
    const d = await r.json();
    return { status: r.status, ok: r.ok, body: JSON.stringify(d).slice(0, 300) };
  } catch (e) { return { error: e.message }; }
}, webStoreId);
console.log('2. asGuest=true  →', test1.status, test1.ok ? 'OK' : 'FAIL', test1.body?.slice(0,150));

// Test 2: without asGuest (let the system determine)
const test2 = await page.evaluate(async (wsId) => {
  try {
    const r = await fetch(`/AmericanBookCompany/webruntime/api/services/data/v66.0/commerce/webstores/${wsId}/search/products?searchTerm=English&pageSize=1&language=en-US`, { credentials: 'same-origin' });
    const d = await r.json();
    return { status: r.status, ok: r.ok, body: JSON.stringify(d).slice(0, 300) };
  } catch (e) { return { error: e.message }; }
}, webStoreId);
console.log('3. no asGuest    →', test2.status, test2.ok ? 'OK' : 'FAIL', test2.body?.slice(0,150));

// Test 3: check network errors/console for Commerce component errors
const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
await page.goto('https://americanbookcompany.my.site.com/AmericanBookCompany/global-search/Georgia', { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(5000);
await page.screenshot({ path: '.artifacts/search-page.png', fullPage: false });
console.log('4. Search page screenshot saved');
console.log('5. Console errors on search page:', errors.length);
errors.slice(0, 5).forEach(e => console.log('   -', e.slice(0, 200)));

await browser.close();
