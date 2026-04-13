import isGuestUser from "@salesforce/user/isGuest";
import {
  DEFAULT_STORE_NAME,
  STOREFRONT_REQUEST_PARAMS,
  applyStorefrontRequestParams,
  buildProductDetailPath,
  firstString,
  formatCurrency,
  normalizeImageUrl,
  parsePositiveInteger,
  resolveProductImageUrl,
  resolveStockKeepingUnit,
  toNumber
} from "./productHelper";

const PRODUCT_BATCH_SIZE = 20;
const PRODUCT_FIELDS = ["StockKeepingUnit", "Name", "purchaseQuantityRule"];

function detectFormatMeta(formatLabel) {
  const normalized = String(formatLabel || "").trim().toLowerCase();
  const hasColor = normalized.includes("color");
  const hasBw =
    normalized.includes("b&w") ||
    normalized.includes("black and white") ||
    normalized.includes("black/white") ||
    normalized.includes("black & white") ||
    /\bbw\b/.test(normalized);
  const hasPrint = hasColor || hasBw || normalized.includes("print");

  return {
    hasColor,
    hasBw,
    hasPrint,
    hasDigital:
      normalized.includes("digital") ||
      normalized.includes("ebook") ||
      normalized.includes("e-book") ||
      normalized.includes("coursewave") ||
      normalized.includes("online testing")
  };
}

function normalizeFormatLine(formatPart) {
  return String(formatPart || "")
    .replace(/black\s*(?:and|&|\/)\s*white/gi, "B&W")
    .replace(/\be-book\b/gi, "eBook")
    .replace(/\bebook\b/gi, "eBook")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitCartItemName(name) {
  const normalizedName = String(name || "").trim();
  const match = /^(.+?)\s+-\s+(.+)$/.exec(normalizedName);

  return {
    baseName: match ? match[1].trim() : normalizedName,
    formatLabel: match ? match[2].trim() : ""
  };
}

export function normalizeCartQuantityRule(rule, fallbackMinimum = 10) {
  const minimum =
    parsePositiveInteger(rule?.minimum ?? rule?.Minimum) ??
    parsePositiveInteger(fallbackMinimum) ??
    10;

  const maximum = parsePositiveInteger(rule?.maximum ?? rule?.Maximum);
  const increment =
    parsePositiveInteger(rule?.increment ?? rule?.Increment) ?? 1;

  return {
    minimum,
    maximum: maximum && maximum <= 9999 ? maximum : null,
    increment
  };
}

export function normalizeQuantityToRule(value, quantityRule, fallbackMinimum = 10) {
  const rule = normalizeCartQuantityRule(quantityRule, fallbackMinimum);
  let normalized = parsePositiveInteger(value) ?? rule.minimum;

  if (normalized < rule.minimum) {
    normalized = rule.minimum;
  }

  if (rule.maximum && normalized > rule.maximum) {
    normalized = rule.maximum;
  }

  if (rule.increment > 1) {
    const steps = Math.round((normalized - rule.minimum) / rule.increment);
    normalized = rule.minimum + steps * rule.increment;

    if (rule.maximum && normalized > rule.maximum) {
      normalized =
        rule.minimum +
        Math.floor((rule.maximum - rule.minimum) / rule.increment) *
          rule.increment;
    }

    if (normalized < rule.minimum) {
      normalized = rule.minimum;
    }
  }

  return normalized;
}

export function buildCartFormatLines(formatLabel) {
  const uniqueLines = new Map();

  String(formatLabel || "")
    .split("+")
    .map((part) => normalizeFormatLine(part))
    .filter(Boolean)
    .forEach((line) => {
      const key = line.toLowerCase();
      if (!uniqueLines.has(key)) {
        uniqueLines.set(key, line);
      }
    });

  return Array.from(uniqueLines.values());
}

export function buildCartIncludesLines(formatLabel, quantity) {
  const normalizedQuantity = parsePositiveInteger(quantity) ?? 0;
  const meta = detectFormatMeta(formatLabel);
  const lines = [...buildCartFormatLines(formatLabel)];

  if (meta.hasColor) {
    lines.push(`${normalizedQuantity} Color Print Workbooks`);
  } else if (meta.hasPrint) {
    lines.push(
      `${normalizedQuantity} ${meta.hasBw ? "B&W Print Workbooks" : "Print Workbooks"}`
    );
  }

  if (normalizedQuantity > 0) {
    lines.push(`${normalizedQuantity} CourseWave Codes for Online Testing`);
  }

  return lines.filter(Boolean);
}

export function buildCartOrderSummaryLines(items) {
  const summary = {
    digital: 0,
    printed: 0,
    printedColor: 0,
    courseWave: 0
  };

  (items || []).forEach((item) => {
    const quantity = parsePositiveInteger(item?.quantity) ?? 0;
    if (!quantity) {
      return;
    }

    const meta = detectFormatMeta(item?.formatLabel);

    summary.digital += quantity;
    summary.courseWave += quantity;

    if (meta.hasColor) {
      summary.printedColor += quantity;
    } else if (meta.hasPrint) {
      summary.printed += quantity;
    }
  });

  return [
    summary.digital
      ? `${summary.digital} Digital Workbooks`
      : "",
    summary.printed
      ? `${summary.printed} Printed Workbooks`
      : "",
    summary.printedColor
      ? `${summary.printedColor} Printed Color Workbooks`
      : "",
    summary.courseWave
      ? `${summary.courseWave} CourseWave Codes for Online Testing`
      : ""
  ].filter(Boolean);
}

export function extractCartItems(data) {
  const rows =
    data?.cartItems ||
    data?.items ||
    data?.itemCollection ||
    data?.cartItemCollection ||
    [];

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => row?.cartItem || row?.item || row)
    .filter(Boolean);
}

export function normalizeCartSummary(data) {
  const summary = data?.cartSummary || data || {};

  const subtotal =
    toNumber(summary?.totalProductAmountAfterAdjustments) ??
    toNumber(summary?.totalProductAmount) ??
    toNumber(summary?.totalAmountWithItemAdjustment) ??
    0;

  const shipping =
    toNumber(summary?.totalChargeAmountWithItemAdjustment) ??
    toNumber(summary?.totalChargeAmount);

  const salesTax = toNumber(summary?.totalTaxAmount) ?? 0;
  const total =
    toNumber(summary?.grandTotalAmount) ??
    toNumber(summary?.totalListPrice) ??
    subtotal + (shipping ?? 0) + salesTax;

  const currencyIsoCode =
    firstString([summary?.currencyIsoCode]) || "USD";

  return {
    currencyIsoCode,
    subtotal,
    shipping,
    salesTax,
    total,
    subtotalLabel: formatCurrency(subtotal, currencyIsoCode),
    shippingLabel:
      shipping === null ? "" : formatCurrency(shipping, currencyIsoCode),
    salesTaxLabel: formatCurrency(salesTax, currencyIsoCode),
    totalLabel: formatCurrency(total, currencyIsoCode)
  };
}

export function normalizeCartItem(item, { storeName = DEFAULT_STORE_NAME } = {}) {
  const productDetails = item?.productDetails || {};
  const productId = String(
    item?.productId || productDetails?.productId || ""
  ).trim();
  const itemId = String(item?.cartItemId || item?.id || "").trim();
  const currencyIsoCode =
    firstString([item?.currencyIsoCode, productDetails?.currencyIsoCode]) ||
    "USD";
  const quantityRule = normalizeCartQuantityRule(
    productDetails?.purchaseQuantityRule || item?.purchaseQuantityRule
  );
  const quantity = normalizeQuantityToRule(item?.quantity, quantityRule);
  const { baseName, formatLabel } = splitCartItemName(
    item?.name || productDetails?.name
  );

  const unitPrice =
    toNumber(item?.unitAdjustedPriceWithItemAdj) ??
    toNumber(item?.unitAdjustedPrice) ??
    toNumber(item?.salesPrice) ??
    toNumber(item?.listPrice) ??
    0;

  const imageUrl = normalizeImageUrl(
    firstString([
      productDetails?.thumbnailImage?.url,
      productDetails?.thumbnailImage?.thumbnailUrl,
      resolveProductImageUrl(productDetails),
      resolveProductImageUrl(item)
    ])
  );

  return {
    id: itemId,
    productId,
    productName: baseName || productDetails?.name || "Product",
    formatLabel,
    quantity,
    draftQuantity: String(quantity),
    quantityRule,
    quantityHelpText: `Quantity (min ${quantityRule.minimum})`,
    includesLines: buildCartIncludesLines(formatLabel, quantity),
    detailPath: productId
      ? buildProductDetailPath(
          {
            id: productId,
            name: baseName || productDetails?.name || "detail",
            urlName: productDetails?.productUrlName
          },
          storeName
        )
      : "",
    imageUrl,
    sku: resolveStockKeepingUnit(productDetails),
    unitPrice,
    unitPriceLabel: formatCurrency(unitPrice, currencyIsoCode),
    lineTotal:
      toNumber(item?.totalPrice) ??
      toNumber(item?.totalAmount) ??
      unitPrice * quantity,
    lineTotalLabel: formatCurrency(
      toNumber(item?.totalPrice) ??
        toNumber(item?.totalAmount) ??
        unitPrice * quantity,
      currencyIsoCode
    ),
    currencyIsoCode,
    bulkPricingApplied: quantity >= quantityRule.minimum,
    bulkPricingClass:
      quantity >= quantityRule.minimum
        ? "bulk-label bulk-applied"
        : "bulk-label",
    bulkPricingLabel:
      quantity >= quantityRule.minimum
        ? "Bulk Pricing Applied"
        : `+${
            quantityRule.minimum - quantity
          } copies for volume discounts`
  };
}

function buildProductsEndpoint({
  storeName = DEFAULT_STORE_NAME,
  webStoreId,
  productIds,
  paramName = "ids",
  fields = PRODUCT_FIELDS
}) {
  const params = applyStorefrontRequestParams(new URLSearchParams(), {
    asGuest: isGuestUser
  });

  params.set(paramName, productIds.join(","));

  (fields || []).forEach((field) => {
    params.append("fields", field);
  });

  Object.entries(STOREFRONT_REQUEST_PARAMS).forEach(([key, value]) => {
    params.set(key, value);
  });

  return `/${storeName}/webruntime/api/services/data/v66.0/commerce/webstores/${webStoreId}/products?${params.toString()}`;
}

async function fetchProductBatch({
  productIds,
  storeName = DEFAULT_STORE_NAME,
  webStoreId
}) {
  const paramNames = ["ids", "productIds"];

  for (const paramName of paramNames) {
    try {
      const response = await fetch(
        buildProductsEndpoint({
          storeName,
          webStoreId,
          productIds,
          paramName
        }),
        {
          method: "GET",
          credentials: "include"
        }
      );

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const rows =
        data?.products ||
        data?.productCollection?.products ||
        data?.productPage?.products ||
        data?.productsPage?.products ||
        [];

      const productMap = new Map();
      (Array.isArray(rows) ? rows : []).forEach((product) => {
        const productId = String(product?.id || "").trim();
        if (productId) {
          productMap.set(productId, product);
        }
      });

      if (productMap.size) {
        return productMap;
      }
    } catch {
      // Try the next supported parameter name.
    }
  }

  return new Map();
}

export async function fetchStorefrontProductDetails({
  productIds,
  storeName = DEFAULT_STORE_NAME,
  webStoreId
}) {
  const uniqueProductIds = [...new Set((productIds || []).filter(Boolean))];
  if (!uniqueProductIds.length || !webStoreId) {
    return new Map();
  }

  const merged = new Map();
  const batches = [];

  for (let index = 0; index < uniqueProductIds.length; index += PRODUCT_BATCH_SIZE) {
    batches.push(uniqueProductIds.slice(index, index + PRODUCT_BATCH_SIZE));
  }

  const batchResults = await Promise.all(
    batches.map((batch) =>
      fetchProductBatch({
        productIds: batch,
        storeName,
        webStoreId
      })
    )
  );

  batchResults.forEach((batchMap) => {
    batchMap.forEach((value, key) => merged.set(key, value));
  });

  return merged;
}