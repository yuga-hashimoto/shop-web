// CI-safe, deterministic business rules. Live scraping/API collection is intentionally absent.
export function normalizeModel(model) {
  if (typeof model !== "string" || !model.trim()) {
    throw new TypeError("model must be a non-empty string");
  }
  return model.normalize("NFKC").toUpperCase().replace(/[\s\-_\u2010-\u2015]/g, "");
}

export function sameProduct(a, b) {
  if (!a || !b) return false;
  return normalizeModel(a.brand) === normalizeModel(b.brand)
    && normalizeModel(a.model) === normalizeModel(b.model)
    && normalizeModel(a.variant || "STANDARD") === normalizeModel(b.variant || "STANDARD")
    && a.condition === b.condition;
}

export function assertSourcePermission(source, operation, now = new Date()) {
  if (!source || source.status !== "APPROVED" || source.enabled !== true) {
    throw new Error("SOURCE_NOT_APPROVED");
  }
  if (!source.permissionEvidenceUrl || !source.licenseScope
      || !Array.isArray(source.allowedOperations)
      || !source.allowedOperations.includes(operation)) {
    throw new Error("SOURCE_OPERATION_NOT_PERMITTED");
  }
  if (!source.expiresAt || Number.isNaN(Date.parse(source.expiresAt))
      || now >= new Date(source.expiresAt)) {
    throw new Error("SOURCE_PERMISSION_EXPIRED_OR_UNVERIFIED");
  }
  return true;
}

export function calculateProfit({
  saleJPY, purchaseJPY, domesticShippingJPY = 0, internationalShippingJPY = 0,
  ebayFeesJPY = 0, paymentFxFeesJPY = 0, packingJPY = 0, returnReserveJPY = 0,
  dutiesTaxesJPY = 0, otherJPY = 0
}) {
  const amounts = { saleJPY, purchaseJPY, domesticShippingJPY, internationalShippingJPY,
    ebayFeesJPY, paymentFxFeesJPY, packingJPY, returnReserveJPY, dutiesTaxesJPY, otherJPY };
  for (const [key, value] of Object.entries(amounts)) {
    if (!Number.isSafeInteger(value) || value < 0) throw new TypeError("INVALID_JPY_AMOUNT: " + key);
  }
  const investedJPY = purchaseJPY + domesticShippingJPY;
  if (investedJPY === 0) throw new Error("ZERO_INVESTMENT");
  const costsJPY = investedJPY + internationalShippingJPY + ebayFeesJPY
    + paymentFxFeesJPY + packingJPY + returnReserveJPY + dutiesTaxesJPY + otherJPY;
  const netProfitJPY = saleJPY - costsJPY;
  return {
    revenueJPY: saleJPY,
    costsJPY,
    netProfitJPY,
    roiPercent: Math.round((netProfitJPY / investedJPY) * 1000) / 10,
    marginPercent: saleJPY ? Math.round((netProfitJPY / saleJPY) * 1000) / 10 : null
  };
}

export function publishEligibility({
  isMock, soldDataLicensed, provenanceComplete, matchConfidence, conditionMatched,
  sourcePermissionApproved, roiPercent, netProfitJPY, soldCount90d
}) {
  const reasons = [];
  if (isMock) reasons.push("DEMO_DATA");
  if (!soldDataLicensed) reasons.push("SOLD_DATA_UNLICENSED");
  if (!provenanceComplete) reasons.push("EVIDENCE_MISSING");
  if (!sourcePermissionApproved) reasons.push("SOURCE_PERMISSION_MISSING");
  if (!conditionMatched || matchConfidence < 0.92) reasons.push("MATCH_UNCERTAIN");
  if (!Number.isFinite(roiPercent) || !Number.isFinite(netProfitJPY)
      || !Number.isInteger(soldCount90d)) reasons.push("METRICS_MISSING");
  const publishable = reasons.length === 0;
  return {
    publishable,
    proEligible: publishable && roiPercent >= 25 && netProfitJPY >= 5000 && soldCount90d >= 10,
    reasons
  };
}
