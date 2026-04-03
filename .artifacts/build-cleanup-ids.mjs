#!/usr/bin/env node
/**
 * build-cleanup-ids.mjs
 * Generates keeper-ids.csv and duplicate-ids.csv for the cleanup process.
 * Also generates keeper-updates.csv with merged State/Grade values.
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET_ORG = "ABC-Production";
const OUT = resolve(__dirname, "backups");

function soql(query) {
  const cmd = `sf data query --query "${query.replace(/"/g, '\\"')}" --target-org ${TARGET_ORG} --result-format json`;
  const raw = execSync(cmd, { maxBuffer: 50 * 1024 * 1024, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  return JSON.parse(raw).result?.records || [];
}

function csvEscape(val) {
  if (val == null) return "";
  const s = String(val);
  return (s.includes(",") || s.includes('"') || s.includes("\n"))
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
}

/* ── Load data ─────────────────────────────────────────────────── */
console.log("Loading Product2...");
const products = soql(
  "SELECT Id, Name, StockKeepingUnit, State__c, Grade_Level__c, CreatedDate FROM Product2 WHERE IsActive = true ORDER BY CreatedDate ASC"
);
console.log(`  ${products.length} active products`);

console.log("Loading ProductMedia...");
const mediaSet = new Set(soql("SELECT ProductId FROM ProductMedia").map(r => r.ProductId));
console.log(`  ${mediaSet.size} products with media`);

console.log("Loading ProductFormatPricing...");
const fmtCountMap = new Map();
for (const r of soql("SELECT Product__c FROM ProductFormatPricing__c WHERE Is_Active__c = true")) {
  fmtCountMap.set(r.Product__c, (fmtCountMap.get(r.Product__c) || 0) + 1);
}

/* ── Group by name, pick keepers ──────────────────────────────── */
console.log("Picking keepers...");
const byName = new Map();
for (const p of products) {
  const name = (p.Name || "").trim();
  if (!name) continue;
  if (!byName.has(name)) byName.set(name, []);
  byName.get(name).push(p);
}

function keeperScore(p) {
  let score = 0;
  if (mediaSet.has(p.Id)) score += 10000;
  score += (fmtCountMap.get(p.Id) || 0) * 100;
  if (p.StockKeepingUnit) score += 10;
  return score;
}

function unionMultiselect(records, field) {
  const vals = new Set();
  for (const r of records) {
    const raw = r[field];
    if (!raw) continue;
    raw.split(";").forEach(v => { const t = v.trim(); if (t) vals.add(t); });
  }
  return [...vals].sort().join(";");
}

const keepers = [];
const duplicates = [];
const keeperUpdates = [];

for (const [name, group] of byName) {
  const scored = group.map((p, idx) => ({ p, score: keeperScore(p), idx }));
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);

  const keeper = scored[0].p;
  keepers.push(keeper.Id);

  const combinedStates = unionMultiselect(group, "State__c");
  const combinedGrades = unionMultiselect(group, "Grade_Level__c");

  keeperUpdates.push({
    Id: keeper.Id,
    Name: name,
    State__c: combinedStates,
    Grade_Level__c: combinedGrades
  });

  for (let i = 1; i < scored.length; i++) {
    duplicates.push(scored[i].p.Id);
  }
}

/* ── Write files ──────────────────────────────────────────────── */
writeFileSync(resolve(OUT, "keeper-ids.csv"), "Id\n" + keepers.join("\n") + "\n");
console.log(`  Wrote keeper-ids.csv (${keepers.length} keepers)`);

writeFileSync(resolve(OUT, "duplicate-ids.csv"), "Id\n" + duplicates.join("\n") + "\n");
console.log(`  Wrote duplicate-ids.csv (${duplicates.length} duplicates)`);

const updateRows = keeperUpdates.map(r =>
  [csvEscape(r.Id), csvEscape(r.Name), csvEscape(r.State__c), csvEscape(r.Grade_Level__c)].join(",")
);
writeFileSync(resolve(OUT, "keeper-updates.csv"), "Id,Name,State__c,Grade_Level__c\n" + updateRows.join("\n") + "\n");
console.log(`  Wrote keeper-updates.csv (${keeperUpdates.length} rows)`);

console.log(`\nSummary: ${keepers.length} keepers, ${duplicates.length} duplicates to delete`);
