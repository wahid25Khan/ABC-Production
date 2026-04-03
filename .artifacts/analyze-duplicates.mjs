#!/usr/bin/env node
/**
 * analyze-duplicates.mjs
 * Queries the ABC-Production org to identify duplicate Product2 records,
 * pick a "keeper" for each unique product name, and output analysis CSVs.
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET_ORG = "ABC-Production";
const STORE_PRICEBOOK_ID = "01sam0000041Az8AAE";

/* ── helpers ──────────────────────────────────────────────────────── */

function soql(query) {
  const cmd = `sf data query --query "${query.replace(/"/g, '\\"')}" --target-org ${TARGET_ORG} --result-format json`;
  const raw = execSync(cmd, { maxBuffer: 50 * 1024 * 1024, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  const parsed = JSON.parse(raw);
  return parsed.result?.records || [];
}

function csvEscape(val) {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function csvRow(arr) {
  return arr.map(csvEscape).join(",");
}

/* ── Step 1: Load all active Product2 records ────────────────────── */

console.log("1/6  Loading active Product2 records...");
const products = soql(
  "SELECT Id, Name, StockKeepingUnit, ProductCode, State__c, Grade_Level__c, CreatedDate, ProductClass FROM Product2 WHERE IsActive = true ORDER BY CreatedDate ASC"
);
console.log(`     Found ${products.length} active products`);

/* ── Step 2: Load related record counts ──────────────────────────── */

console.log("2/6  Loading ProductMedia product IDs...");
const mediaRows = soql("SELECT ProductId FROM ProductMedia");
const mediaSet = new Set(mediaRows.map(r => r.ProductId));
console.log(`     ${mediaSet.size} products have media`);

console.log("3/6  Loading store PricebookEntry product IDs...");
const pbeRows = soql(
  `SELECT Product2Id FROM PricebookEntry WHERE Pricebook2Id = '${STORE_PRICEBOOK_ID}' AND IsActive = true`
);
const storePriceSet = new Set(pbeRows.map(r => r.Product2Id));
console.log(`     ${storePriceSet.size} products have store pricebook entries`);

console.log("4/6  Loading ProductFormatPricing product IDs...");
const fmtRaw = soql(
  "SELECT Product__c FROM ProductFormatPricing__c WHERE Is_Active__c = true"
);
const fmtCountMap = new Map();
for (const r of fmtRaw) {
  fmtCountMap.set(r.Product__c, (fmtCountMap.get(r.Product__c) || 0) + 1);
}
console.log(`     ${fmtCountMap.size} products have format pricing`);

console.log("5/6  Loading ProductCategoryProduct product IDs...");
const catRaw = soql("SELECT ProductId FROM ProductCategoryProduct");
const catSet = new Set(catRaw.map(r => r.ProductId));
console.log(`     ${catSet.size} products in categories`);

/* ── Step 3: Group products by name and pick keepers ─────────────── */

console.log("6/6  Analyzing duplicates...");

// Group by Name
const byName = new Map();
for (const p of products) {
  const name = (p.Name || "").trim();
  if (!name) continue;
  if (!byName.has(name)) byName.set(name, []);
  byName.get(name).push(p);
}

// Scoring function for keeper selection
function keeperScore(p) {
  let score = 0;
  if (mediaSet.has(p.Id)) score += 10000;                    // has images
  if (storePriceSet.has(p.Id)) score += 1000;                // in store pricebook
  score += (fmtCountMap.get(p.Id) || 0) * 100;              // format pricing count
  if (p.StockKeepingUnit) score += 10;                       // has SKU
  // Oldest gets higher score (lower timestamp = earlier = better)
  // We already sorted by CreatedDate ASC, so first in array is oldest
  return score;
}

// Collect union of multiselect values
function unionMultiselect(records, field) {
  const vals = new Set();
  for (const r of records) {
    const raw = r[field];
    if (!raw) continue;
    raw.split(";").forEach(v => {
      const trimmed = v.trim();
      if (trimmed) vals.add(trimmed);
    });
  }
  return [...vals].sort().join(";");
}

const analysisRows = [];
const orphanRows = [];
let totalDupes = 0;
let totalKeepers = 0;
let totalOrphans = 0;

for (const [name, group] of byName) {
  // Score and sort: highest score first, then oldest first (stable sort)
  const scored = group.map((p, idx) => ({ p, score: keeperScore(p), origIdx: idx }));
  scored.sort((a, b) => b.score - a.score || a.origIdx - b.origIdx);

  const keeper = scored[0].p;
  const dupes = scored.slice(1).map(s => s.p);
  const combinedStates = unionMultiselect(group, "State__c");
  const combinedGrades = unionMultiselect(group, "Grade_Level__c");

  totalKeepers++;
  totalDupes += dupes.length;

  analysisRows.push({
    Name: name,
    KeeperID: keeper.Id,
    KeeperSKU: keeper.StockKeepingUnit || "",
    KeeperCreatedDate: keeper.CreatedDate,
    HasMedia: mediaSet.has(keeper.Id) ? "YES" : "NO",
    HasStorePrice: storePriceSet.has(keeper.Id) ? "YES" : "NO",
    FormatCount: fmtCountMap.get(keeper.Id) || 0,
    CombinedStates: combinedStates,
    CombinedGrades: combinedGrades,
    TotalRecords: group.length,
    DuplicateCount: dupes.length,
    DuplicateIDs: dupes.map(d => d.Id).join(";")
  });

  // Check if keeper is an orphan (no store association at all)
  const hasAny = mediaSet.has(keeper.Id) ||
    storePriceSet.has(keeper.Id) ||
    fmtCountMap.has(keeper.Id) ||
    catSet.has(keeper.Id);

  if (!hasAny) {
    orphanRows.push({
      Id: keeper.Id,
      Name: name,
      SKU: keeper.StockKeepingUnit || "",
      CreatedDate: keeper.CreatedDate,
      State: keeper.State__c || "",
      Grade: keeper.Grade_Level__c || "",
      HasMedia: "NO",
      HasStorePrice: "NO",
      FormatCount: 0,
      InCategory: "NO"
    });
    totalOrphans++;
  }
}

/* ── Write CSVs ──────────────────────────────────────────────────── */

const analysisHeader = "Name,KeeperID,KeeperSKU,KeeperCreatedDate,HasMedia,HasStorePrice,FormatCount,CombinedStates,CombinedGrades,TotalRecords,DuplicateCount,DuplicateIDs";
const analysisCsv = [analysisHeader, ...analysisRows.map(r =>
  csvRow([r.Name, r.KeeperID, r.KeeperSKU, r.KeeperCreatedDate, r.HasMedia, r.HasStorePrice,
    r.FormatCount, r.CombinedStates, r.CombinedGrades, r.TotalRecords, r.DuplicateCount, r.DuplicateIDs])
)].join("\n");

writeFileSync(resolve(__dirname, "duplicate-product-analysis.csv"), analysisCsv + "\n");
console.log(`\n  Wrote duplicate-product-analysis.csv (${analysisRows.length} unique products)`);

const orphanHeader = "Id,Name,SKU,CreatedDate,State,Grade,HasMedia,HasStorePrice,FormatCount,InCategory";
const orphanCsv = [orphanHeader, ...orphanRows.map(r =>
  csvRow([r.Id, r.Name, r.SKU, r.CreatedDate, r.State, r.Grade, r.HasMedia, r.HasStorePrice, r.FormatCount, r.InCategory])
)].join("\n");

writeFileSync(resolve(__dirname, "orphan-products.csv"), orphanCsv + "\n");
console.log(`  Wrote orphan-products.csv (${orphanRows.length} orphan products)`);

/* ── Summary ─────────────────────────────────────────────────────── */

const withDupes = analysisRows.filter(r => r.DuplicateCount > 0);
const keepersWithMedia = analysisRows.filter(r => r.HasMedia === "YES").length;
const keepersWithStorePrice = analysisRows.filter(r => r.HasStorePrice === "YES").length;
const keepersWithFormats = analysisRows.filter(r => r.FormatCount > 0).length;

const summary = `
=== DUPLICATE PRODUCT ANALYSIS SUMMARY ===

Total active Product2 records:     ${products.length}
Unique product names (keepers):    ${totalKeepers}
Duplicate records to remove:       ${totalDupes}
Orphan products (no store assoc):  ${totalOrphans}

--- Keeper quality ---
Keepers with ProductMedia (images): ${keepersWithMedia}
Keepers with store pricebook entry: ${keepersWithStorePrice}
Keepers with format pricing:        ${keepersWithFormats}
Keepers with 3 formats:             ${analysisRows.filter(r => r.FormatCount === 3).length}
Keepers with 1 format:              ${analysisRows.filter(r => r.FormatCount === 1).length}
Keepers with 0 formats:             ${analysisRows.filter(r => r.FormatCount === 0).length}

--- Duplicate distribution ---
Products with 0 duplicates:  ${analysisRows.filter(r => r.DuplicateCount === 0).length}
Products with 1 duplicate:   ${analysisRows.filter(r => r.DuplicateCount === 1).length}
Products with 2-5 dupes:     ${analysisRows.filter(r => r.DuplicateCount >= 2 && r.DuplicateCount <= 5).length}
Products with 6-50 dupes:    ${analysisRows.filter(r => r.DuplicateCount >= 6 && r.DuplicateCount <= 50).length}
Products with 51-100 dupes:  ${analysisRows.filter(r => r.DuplicateCount >= 51 && r.DuplicateCount <= 100).length}
Products with 100+ dupes:    ${analysisRows.filter(r => r.DuplicateCount > 100).length}

--- Top 10 most duplicated ---
${withDupes
  .sort((a, b) => b.DuplicateCount - a.DuplicateCount)
  .slice(0, 10)
  .map(r => `  ${r.DuplicateCount.toString().padStart(4)} dupes: ${r.Name}`)
  .join("\n")}

--- Child records affected (estimates) ---
ProductFormatPricing__c to delete: ~${totalDupes} (1 per duplicate)
PricebookEntry to delete:         ~${totalDupes * 3} (3 per duplicate)
ProductCategoryProduct to delete:  ~${totalDupes} (1+ per duplicate)
`.trim();

writeFileSync(resolve(__dirname, "cleanup-summary.txt"), summary + "\n");
console.log(`  Wrote cleanup-summary.txt\n`);
console.log(summary);
