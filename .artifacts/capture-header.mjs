import { chromium, devices } from 'playwright';

const url = 'https://americanbookcompany.my.site.com/AmericanBookCompany/#Georgia';

const captureDesktop = async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.screenshot({ path: '.artifacts/header-desktop.png', fullPage: false });
  await browser.close();
};

const captureMobile = async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices['iPhone 12'] });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.screenshot({ path: '.artifacts/header-mobile.png', fullPage: false });
  await browser.close();
};

await captureDesktop();
await captureMobile();
console.log('done');
