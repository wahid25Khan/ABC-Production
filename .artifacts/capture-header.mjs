import { chromium, devices } from 'playwright';

const url = 'https://americanbookcompany.my.site.com/AmericanBookCompany/#Georgia';

const captureDesktop = async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  // Use 'load' so the page doesn't wait for continuous background API polling.
  // Then explicitly wait for LWC hydration and CSS injection to complete.
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  // Wait for the custom LWC to mount (triggers CSS injection on connectedCallback).
  await page.waitForSelector('c-state-filter-lwc', { timeout: 20000 }).catch(() => {});
  // Wait for the injected <style> to appear in <head>.
  await page.waitForSelector('#abc-header-responsive-css', { timeout: 10000 }).catch(() => {});
  // Brief settle time for layout reflow.
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '.artifacts/header-desktop.png', fullPage: false });
  await browser.close();
};

const captureMobile = async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices['iPhone 12'] });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('c-state-filter-lwc', { timeout: 20000 }).catch(() => {});
  await page.waitForSelector('#abc-header-responsive-css', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '.artifacts/header-mobile.png', fullPage: false });
  await browser.close();
};

await captureDesktop();
await captureMobile();
console.log('done');
