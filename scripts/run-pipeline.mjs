#!/usr/bin/env node
// A safe, reproducible dry run until collection and resale rights are approved.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { calculateProfit, publishEligibility } from "../lib/core.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const mode = option("--mode", process.env.DATA_MODE || "MOCK");
const output = option("--output", "out/opportunities.json");
if (mode !== "MOCK") {
  console.error("LIVE_ADAPTER_NOT_CONFIGURED: collection modes are disabled until permission and implementation review.");
  process.exit(2);
}

const profit = calculateProfit({
  saleJPY: 40000,
  purchaseJPY: 20000,
  internationalShippingJPY: 5500,
  ebayFeesJPY: 6140,
  paymentFxFeesJPY: 800
});
const eligibility = publishEligibility({
  isMock: true,
  soldDataLicensed: false,
  provenanceComplete: false,
  sourcePermissionApproved: false,
  matchConfidence: 0.99,
  conditionMatched: true,
  roiPercent: profit.roiPercent,
  netProfitJPY: profit.netProfitJPY,
  soldCount90d: 0
});
const report = {
  schemaVersion: 1,
  mode: "MOCK",
  generatedAt: new Date().toISOString(),
  containsRealMarketData: false,
  publicationStatus: "DEMO_ONLY",
  collection: { mercari: "DISABLED", ebay_active: "DISABLED", ebay_sold: "DISABLED" },
  opportunities: [{
    id: "DEMO-001",
    brand: "DEMO",
    model: "DEMO-CAMERA-01",
    ebayPriceType: "SYNTHETIC_TEST_VALUE",
    mercariQuery: "DEMO-CAMERA-01",
    price: profit,
    eligibility
  }]
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log("MOCK_ONLY report written: " + output);
console.log("No external product data was collected; no listings were published.");
