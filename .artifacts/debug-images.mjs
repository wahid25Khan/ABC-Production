import { chromium } from "playwright";

const SITE = "https://americanbookcompany.my.site.com/AmericanBookCompany";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

await page.goto(SITE, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(5000);

// Search for the product that HAS media: "LEAP 2025 Geometry" (01tWj00000BND3tIAH)
const searchUrl = `${SITE}/webruntime/api/services/data/v66.0/commerce/webstores/0ZEam000004dJDNGA2/search/products?searchTerm=LEAP+2025+Geometry&pageSize=5`;
const resp = await page.evaluate(async (url) => {
  const r = await fetch(url, { credentials: "include" });
  return { status: r.status, body: await r.json() };
}, searchUrl);

const products = resp.body?.productsPage?.products || [];
console.log(`Products found: ${products.length}`);
for (const p of products.slice(0, 3)) {
  console.log(`\n${p.name} (${p.id})`);
  console.log(`  defaultImage: ${JSON.stringify(p.defaultImage)}`);
}

await browser.close();
