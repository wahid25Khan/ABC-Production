import { readFileSync, writeFileSync } from 'fs';

const CATEGORY_MAP = {
  'Math':           '0ZGam000000isBBGAY',
  'English':        '0ZGam000000isCnGAI',
  'Reading':        '0ZGam000000isEPGAY',
  'Social Studies': '0ZGam000000isG1GAI',
  'Science':        '0ZGam000000isHdGAI',
  'Writing':        '0ZGam000000isJFGAY',
};
const SHOP_ALL = '0ZGam000000itATGAY'; // fallback for null/unknown Category__c

const lines = readFileSync('.artifacts/uncatalogued-products.csv', 'utf8').trim().split('\n');
lines.shift(); // remove header

let output = 'ProductId,ProductCategoryId\n';
const counts = {};

for (const line of lines) {
  const [id, category] = line.split(',');
  if (!id || !id.startsWith('01t')) continue;
  const cat = category?.trim() || '';
  const categoryId = CATEGORY_MAP[cat] ?? SHOP_ALL;
  output += `${id},${categoryId}\n`;
  counts[cat || '(null)'] = (counts[cat || '(null)'] ?? 0) + 1;
}

writeFileSync('.artifacts/pcp-import.csv', output);
console.log('Written .artifacts/pcp-import.csv');
console.log('Row counts by category:');
for (const [k, v] of Object.entries(counts).sort((a,b) => b[1]-a[1])) {
  console.log(`  ${k.padEnd(20)} ${v}`);
}
