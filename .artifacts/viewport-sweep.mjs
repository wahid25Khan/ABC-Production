import { chromium } from 'playwright';

const pages = [
  {
    key: 'login',
    url: 'https://americanbookcompany.my.site.com/AmericanBookCompany/login?ec=302&startURL=%2FAmericanBookCompany%2Fmyprofile'
  },
  {
    key: 'create-account',
    url: 'https://americanbookcompany.my.site.com/AmericanBookCompany/create-account'
  },
  {
    key: 'checkout',
    url: 'https://americanbookcompany.my.site.com/AmericanBookCompany/checkout'
  }
];

const viewports = [
  { key: 'tablet', width: 820, height: 1180 },
  { key: 'mobile', width: 390, height: 844 }
];

function collectMetrics(viewportKey) {
  const getRect = (node) => {
    if (!node) {
      return null;
    }

    const { x, y, width, height } = node.getBoundingClientRect();
    return {
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
      width: Number(width.toFixed(1)),
      height: Number(height.toFixed(1))
    };
  };
  const findByText = (selector, text) =>
    Array.from(document.querySelectorAll(selector)).find(
      (node) => node.textContent && node.textContent.trim() === text
    );
  const findHeading = (text) =>
    Array.from(document.querySelectorAll('h1, h2, h3')).find(
      (node) => node.textContent && node.textContent.trim() === text
    );
  const doc = document.documentElement;
  const header = document.querySelector('[data-layout-site-region="header"]');
  const formCard = document.querySelector(
    'form, c-account-login-form, c-create-account-registration, c-checkout-login-gate'
  );
  const inputs = Array.from(document.querySelectorAll('input'));
  const firstName = inputs.find((input) => input.placeholder === 'Enter first name');
  const lastName = inputs.find((input) => input.placeholder === 'Enter last name');
  const email = inputs.find((input) => input.placeholder === 'Enter email');
  const googleButton = findByText('a,button', 'Google');
  const microsoftButton = findByText('a,button', 'Microsoft');
  const floatingButton = findByText('a,button', 'Button');
  const newCustomers = findHeading('New Customers');
  const returningCustomers = findHeading('Returning Customers');
  const returnToCart = findByText('a,button', 'Return to cart');

  return {
    viewport: {
      key: viewportKey,
      width: window.innerWidth,
      height: window.innerHeight
    },
    scrollWidth: doc.scrollWidth,
    overflowX: doc.scrollWidth > window.innerWidth,
    header: {
      exists: Boolean(header),
      navCount: header ? header.querySelectorAll('nav').length : 0,
      searchCount: header ? header.querySelectorAll('input[type="search"]').length : 0,
      cartCount: header
        ? header.querySelectorAll(
            'commerce_builder-cart-badge, commerce_builder-mini-cart, button[aria-label*="Cart"], button[title*="Cart"]'
          ).length
        : 0,
      navRect: getRect(header ? header.querySelector('nav') : null),
      searchRect: getRect(header ? header.querySelector('input[type="search"]') : null)
    },
    login: {
      floatingButtonPresent: Boolean(floatingButton),
      floatingButtonRect: getRect(floatingButton),
      formCardRect: getRect(formCard)
    },
    createAccount: {
      firstNameRect: getRect(firstName),
      lastNameRect: getRect(lastName),
      emailRect: getRect(email),
      googleButtonRect: getRect(googleButton),
      microsoftButtonRect: getRect(microsoftButton),
      sameRowNameFields:
        Boolean(firstName) &&
        Boolean(lastName) &&
        Math.abs(firstName.getBoundingClientRect().y - lastName.getBoundingClientRect().y) < 8,
      sameRowSocialButtons:
        Boolean(googleButton) &&
        Boolean(microsoftButton) &&
        Math.abs(googleButton.getBoundingClientRect().y - microsoftButton.getBoundingClientRect().y) < 8
    },
    checkout: {
      newCustomersRect: getRect(newCustomers),
      returningCustomersRect: getRect(returningCustomers),
      returnToCartRect: getRect(returnToCart),
      sameRowCustomerBlocks:
        Boolean(newCustomers) &&
        Boolean(returningCustomers) &&
        Math.abs(newCustomers.getBoundingClientRect().y - returningCustomers.getBoundingClientRect().y) < 20,
      stackedCustomerBlocks:
        Boolean(newCustomers) &&
        Boolean(returningCustomers) &&
        Math.abs(newCustomers.getBoundingClientRect().x - returningCustomers.getBoundingClientRect().x) < 24 &&
        returningCustomers.getBoundingClientRect().y > newCustomers.getBoundingClientRect().y + 40
    }
  };
}

const browser = await chromium.launch({ headless: true });
const results = [];

for (const viewport of viewports) {
  for (const pageConfig of pages) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height }
    });

    await page.goto(pageConfig.url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(2500);

    const metrics = await page.evaluate(collectMetrics, viewport.key);
    const screenshotPath = `.artifacts/${pageConfig.key}-${viewport.key}.png`;

    await page.screenshot({ path: screenshotPath, fullPage: true });

    results.push({
      page: pageConfig.key,
      viewport: viewport.key,
      screenshotPath,
      metrics
    });

    await page.close();
  }
}

await browser.close();
console.log(JSON.stringify(results, null, 2));