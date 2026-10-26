import test from "node:test";
import assert from "node:assert/strict";
import { normalizeModel, sameProduct, assertSourcePermission, calculateProfit, publishEligibility } from "../lib/core.mjs";

test("normalization handles width/case/hyphen without conflating versions", () => {
  assert.equal(normalizeModel(" ｄｓｃ－ＲＸ１００Ｍ５ "), "DSCRX100M5");
  assert.notEqual(normalizeModel("DSC-RX100M5"), normalizeModel("DSC-RX100M5A"));
});

test("matching requires exact model, variant and condition", () => {
  const base = { brand: "Sony", model: "DSC-RX100M5", variant: "black", condition: "USED_GOOD" };
  assert.equal(sameProduct(base, { ...base, brand: "SONY" }), true);
  assert.equal(sameProduct(base, { ...base, model: "DSC-RX100M5A" }), false);
  assert.equal(sameProduct(base, { ...base, condition: "FOR_PARTS" }), false);
});

test("sample profit is 7560 JPY with 37.8% ROI on invested amount", () => {
  const r = calculateProfit({ saleJPY: 40000, purchaseJPY: 20000,
    internationalShippingJPY: 5500, ebayFeesJPY: 6140, paymentFxFeesJPY: 800 });
  assert.equal(r.netProfitJPY, 7560);
  assert.equal(r.roiPercent, 37.8);
  assert.equal(r.marginPercent, 18.9);
});

test("unexpected or fractional costs fail closed", () => {
  assert.throws(() => calculateProfit({ saleJPY: 10.9, purchaseJPY: 1 }), /INVALID_JPY_AMOUNT/);
  assert.throws(() => calculateProfit({ saleJPY: 10, purchaseJPY: -1 }), /INVALID_JPY_AMOUNT/);
  assert.throws(() => calculateProfit({ saleJPY: 10, purchaseJPY: 0 }), /ZERO_INVESTMENT/);
});

test("sources default to denied", () => {
  assert.throws(() => assertSourcePermission(null, "collect"), /SOURCE_NOT_APPROVED/);
  assert.throws(() => assertSourcePermission({ status: "PENDING", enabled: true }, "collect"),
    /SOURCE_NOT_APPROVED/);
});

test("approval must include evidence, allowed operation and expiry", () => {
  const approved = {
    status: "APPROVED", enabled: true,
    permissionEvidenceUrl: "https://example.com/permission",
    licenseScope: "commercial research dataset",
    allowedOperations: ["collect"], expiresAt: "2030-01-01T00:00:00Z"
  };
  assert.equal(assertSourcePermission(approved, "collect", new Date("2026-10-26")), true);
  assert.throws(() => assertSourcePermission(approved, "redistribute", new Date("2026-10-26")),
    /SOURCE_OPERATION_NOT_PERMITTED/);
  assert.throws(() => assertSourcePermission(approved, "collect", new Date("2031-01-01")),
    /SOURCE_PERMISSION_EXPIRED_OR_UNVERIFIED/);
});

test("mock and unlicensed sold figures cannot be published", () => {
  const result = publishEligibility({ isMock: true, soldDataLicensed: false,
    provenanceComplete: false, sourcePermissionApproved: false, matchConfidence: 1,
    conditionMatched: true, roiPercent: 40, netProfitJPY: 20000, soldCount90d: 100 });
  assert.equal(result.publishable, false);
  assert.equal(result.proEligible, false);
  assert.ok(result.reasons.includes("DEMO_DATA"));
});

test("pro filtering requires 3 numeric thresholds and valid rights", () => {
  const base = { isMock: false, soldDataLicensed: true, provenanceComplete: true,
    sourcePermissionApproved: true, matchConfidence: 0.95, conditionMatched: true,
    roiPercent: 25, netProfitJPY: 5000, soldCount90d: 10 };
  assert.deepEqual(publishEligibility(base), { publishable: true, proEligible: true, reasons: [] });
  assert.equal(publishEligibility({ ...base, soldCount90d: 9 }).proEligible, false);
  assert.equal(publishEligibility({ ...base, matchConfidence: 0.80 }).publishable, false);
});
