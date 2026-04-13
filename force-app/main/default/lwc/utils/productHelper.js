/**
 * Shared product-related utilities for ABC B2B Commerce LWCs.
 * Used by similarProductsByState, similarProductsBySubject, featuredStateBooks, etc.
 */

import { addItemToCart } from "commerce/cartApi";
import isGuestUser from "@salesforce/user/isGuest";

const DEFAULT_STORE_NAME = "AmericanBookCompany";
export const CART_UPDATED_EVENT_NAME = "abccartupdated";

export const STOREFRONT_GUEST_REQUEST_PARAMS = Object.freeze({
  language: "en-US",
  asGuest: "true",
  htmlEncode: "false"
});

export const STOREFRONT_REQUEST_PARAMS = Object.freeze({
  language: "en-US",
  htmlEncode: "false"
});

export function applyStorefrontGuestParams(params) {
  const nextParams =
    params instanceof URLSearchParams
      ? params
      : new URLSearchParams(params || {});

  Object.entries(STOREFRONT_GUEST_REQUEST_PARAMS).forEach(([key, value]) => {
    nextParams.set(key, value);
  });

  return nextParams;
}

export function applyStorefrontRequestParams(
  params,
  { asGuest = isGuestUser } = {}
) {
  const nextParams =
    params instanceof URLSearchParams
      ? params
      : new URLSearchParams(params || {});

  Object.entries(STOREFRONT_REQUEST_PARAMS).forEach(([key, value]) => {
    nextParams.set(key, value);
  });

  if (asGuest) {
    nextParams.set("asGuest", "true");
  } else {
    nextParams.delete("asGuest");
  }

  return nextParams;
}

/**
 * Normalize a raw product API response item into a consistent shape.
 * @param {object} item — Raw product from Commerce search API.
 * @returns {object|null} Normalized product or null if invalid.
 */
export function normalizeProduct(item) {
  const id = String(item?.id || "").trim();
  if (!id) {
    return null;
  }

  const name = String(item.name || "").trim() || "Untitled";
  const imageUrl = resolveProductImageUrl(item);
  const urlName = String(item.urlName || item.slug || "").trim();

  return {
    ...item,
    id,
    name,
    imageUrl,
    urlName
  };
}

/**
 * Resolve the best available image URL from a product item.
 * Checks direct URL properties, then falls back to mediaGroups.
 * @param {object} item — Raw product from Commerce search API.
 * @returns {string} The image URL or empty string.
 */
export function resolveProductImageUrl(item) {
  const directCandidates = [
    item?.defaultImage?.url,
    item?.image?.url,
    item?.imageUrl
  ];

  const directHit = directCandidates.find(
    (v) => typeof v === "string" && v.trim()
  );
  if (directHit) {
    return directHit.trim();
  }

  const mediaGroups = Array.isArray(item?.mediaGroups) ? item.mediaGroups : [];
  const allMediaItems = mediaGroups.flatMap((g) =>
    g && Array.isArray(g.mediaItems) ? g.mediaItems : []
  );

  for (const media of allMediaItems) {
    const url = media && (media.url || media.image?.url);
    if (typeof url === "string" && url.trim()) {
      return url.trim();
    }
  }

  return "";
}

/**
 * Extract the products array from any of the 5 known Commerce API response shapes.
 * @param {object} data — The parsed API response JSON.
 * @returns {Array} The products list or empty array.
 */
export function extractProductList(data) {
  if (!data || typeof data !== "object") {
    return [];
  }

  const list =
    data.productsPage?.products ||
    data.productPage?.products ||
    data.productSearchResult?.products ||
    data.searchProductResult?.products ||
    data.products;

  return Array.isArray(list) ? list : [];
}

/**
 * Build a product detail page URL path.
 * @param {object} product — Normalized product with id and urlName/name.
 * @param {string} [storeName] — Store path prefix (default: AmericanBookCompany).
 * @returns {string} The relative URL path.
 */
export function buildProductDetailPath(
  product,
  storeName = DEFAULT_STORE_NAME
) {
  const nameSource = product.urlName || product.name || "detail";
  const recordName = String(nameSource)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");

  return `/${storeName}/product/${recordName || "detail"}/${product.id}`;
}

export function buildCartPath(storeName = DEFAULT_STORE_NAME) {
  return `/${storeName}/cart`;
}

export function buildAddToCartEndpoint({
  storeName = DEFAULT_STORE_NAME,
  webStoreId,
  cartStateOrId = "active",
  asGuest = isGuestUser
} = {}) {
  const targetCart = String(cartStateOrId || "active").trim() || "active";
  const params = applyStorefrontRequestParams(new URLSearchParams(), {
    asGuest
  });

  return `/${storeName}/webruntime/api/services/data/v66.0/commerce/webstores/${webStoreId}/carts/${targetCart}/cart-items?${params.toString()}`;
}

export function buildAddToCartSuccessModalData(
  product,
  storeName = DEFAULT_STORE_NAME
) {
  const safeProduct = product && typeof product === "object" ? product : null;
  const normalizedProductId = String(safeProduct?.id || "").trim();

  return {
    productName: firstString([safeProduct?.name]) || "Product",
    productImageUrl: normalizeImageUrl(resolveProductImageUrl(safeProduct)),
    productUrl: normalizedProductId
      ? buildProductDetailPath(safeProduct, storeName)
      : "",
    cartUrl: buildCartPath(storeName)
  };
}

/**
 * Scroll a product carousel to a specific index.
 * @param {ShadowRoot} template — The component's template (this.template).
 * @param {number} index — The card index to scroll to.
 * @param {string} [behavior='smooth'] — Scroll behavior.
 */
export function scrollCarouselToIndex(template, index, behavior = "smooth") {
  globalThis.requestAnimationFrame(() => {
    const viewport = template.querySelector(".products-viewport");
    const track = template.querySelector(".products-track");
    const firstCard = template.querySelector(".product-card");

    if (!viewport || !track || !firstCard) {
      return;
    }

    const style = globalThis.getComputedStyle(track);
    const gapValue = style.columnGap || style.gap || "0";
    const gap = Number.parseFloat(gapValue) || 0;
    const cardWidth = firstCard.getBoundingClientRect().width;
    const left = Math.max(0, index * (cardWidth + gap));

    viewport.scrollTo({ left, behavior });
  });
}

/**
 * Resolve a nested property by dot-separated path.
 * @param {object} source — The object to traverse.
 * @param {string} path — Dot-separated property path (e.g. "prices.listPrice").
 * @returns {*} The resolved value or undefined.
 */
export function resolveByPath(source, path) {
  if (!source || !path) return undefined;

  return path.split(".").reduce((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) return acc[key];
    return undefined;
  }, source);
}

/**
 * Safely convert a value to a finite number.
 * Handles number, string, and objects with amount/value properties.
 * @param {*} value — The value to convert.
 * @returns {number|null} The numeric value or null.
 */
export function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "object") {
    if (typeof value.amount === "number" && Number.isFinite(value.amount))
      return value.amount;
    if (typeof value.value === "number" && Number.isFinite(value.value))
      return value.value;
  }

  const parsed = Number(String(value).replaceAll(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Return the first truthy string from an array of candidates.
 * Handles plain strings and objects with value/displayValue properties.
 * @param {Array} values — Array of candidate values.
 * @returns {string} The first resolved string or empty string.
 */
export function firstString(values) {
  for (const value of values || []) {
    if (typeof value === "string" && value.trim()) return value.trim();

    if (value && typeof value === "object") {
      if (typeof value.value === "string" && value.value.trim())
        return value.value.trim();
      if (typeof value.displayValue === "string" && value.displayValue.trim())
        return value.displayValue.trim();
    }
  }

  return "";
}

/**
 * Resolve a price from the first matching path that yields a finite number.
 * @param {object} source — The pricing object to search.
 * @param {string[]} paths — Ordered list of dot-paths to try.
 * @returns {number|null} The resolved price or null.
 */
export function resolvePrice(source, paths) {
  for (const path of paths) {
    const value = resolveByPath(source, path);
    const normalized = toNumber(value);
    if (normalized !== null) return normalized;
  }
  return null;
}

/**
 * Extract a product-ID-keyed pricing map from a Commerce pricing API response.
 * @param {object} data — The parsed pricing API response.
 * @returns {Map<string, object>} Map of productId → pricing object.
 */
export function extractPricingMap(data) {
  const root = data && typeof data === "object" ? data : {};
  let rows = [];
  if (Array.isArray(root.pricingLineItemResults)) {
    rows = root.pricingLineItemResults;
  } else if (Array.isArray(root.pricingResults)) {
    rows = root.pricingResults;
  }

  const pricingByProductId = new Map();

  for (const row of rows) {
    const productId = String(
      row?.productId ||
        row?.pricingLineItem?.productId ||
        row?.product?.id ||
        row?.product?.productId ||
        ""
    ).trim();

    if (!productId) continue;

    pricingByProductId.set(productId, {
      currencyIsoCode:
        firstString([row?.currencyIsoCode, root?.currencyIsoCode]) || "USD",
      listPrice: resolvePrice(row, [
        "listPrice",
        "pricebookPrice",
        "listUnitPrice"
      ]),
      salesPrice: resolvePrice(row, [
        "salesPrice",
        "unitPrice",
        "unitAdjustedPrice",
        "price"
      ]),
      negotiatedPrice: resolvePrice(row, ["negotiatedPrice"]),
      unitPrice: resolvePrice(row, [
        "unitPrice",
        "salesPrice",
        "unitAdjustedPrice",
        "price"
      ])
    });
  }

  return pricingByProductId;
}

/**
 * Format a numeric amount as a currency string.
 * @param {number} amount — The amount to format.
 * @param {string} [currencyIsoCode='USD'] — ISO 4217 currency code.
 * @returns {string} Formatted currency string or em-dash if invalid.
 */
export function formatCurrency(amount, currencyIsoCode) {
  if (!Number.isFinite(amount)) return "\u2014";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyIsoCode || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

/**
 * Normalize an image URL — handle protocol-relative, relative, and whitespace.
 * @param {string} url — The raw image URL.
 * @returns {string} The normalized URL or empty string.
 */
export function normalizeImageUrl(url) {
  const value = String(url || "")
    .trim()
    .replaceAll(/\s/g, "%20");
  if (!value) return "";

  if (/^(https?:|data:)/i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;

  if (globalThis.window?.location?.origin) {
    if (value.startsWith("/")) {
      return `${globalThis.window.location.origin}${value}`;
    }
    return `${globalThis.window.location.origin}/${value.replace(/^\/+/, "")}`;
  }

  return value;
}

/**
 * Extract the SKU/StockKeepingUnit from a product item.
 * @param {object} item — Raw product from Commerce API.
 * @returns {string} The SKU or empty string.
 */
export function resolveStockKeepingUnit(item) {
  return firstString([
    item?.sku,
    item?.stockKeepingUnit,
    resolveByPath(item, "fields.StockKeepingUnit")
  ]);
}

/**
 * Extract the currency ISO code from a product item.
 * @param {object} item — Raw product from Commerce API.
 * @returns {string} The currency code, defaults to "USD".
 */
export function resolveCurrencyIsoCode(item) {
  const resolved = firstString([
    resolveByPath(item, "prices.currencyIsoCode"),
    resolveByPath(item, "fields.CurrencyIsoCode"),
    item?.currencyIsoCode
  ]);

  return resolved || "USD";
}

/**
 * Parse a value as a positive integer, returning null if invalid.
 * @param {*} value — The value to parse.
 * @returns {number|null} The positive integer or null.
 */
export function parsePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function dispatchCartUpdated(detail = {}) {
  if (
    typeof globalThis.dispatchEvent !== "function" ||
    typeof CustomEvent !== "function"
  ) {
    return;
  }

  globalThis.dispatchEvent(
    new CustomEvent(CART_UPDATED_EVENT_NAME, {
      detail
    })
  );
}

async function addProductToCartViaRest({
  productId,
  quantity,
  storeName = DEFAULT_STORE_NAME,
  webStoreId,
  cartStateOrId = "active",
  asGuest = isGuestUser
} = {}) {
  if (!webStoreId) {
    return {
      ok: false,
      error: new Error("Missing webStoreId.")
    };
  }

  const response = await fetch(
    buildAddToCartEndpoint({
      storeName,
      webStoreId,
      cartStateOrId,
      asGuest
    }),
    {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        productId,
        quantity,
        type: "Product"
      })
    }
  );

  if (!response.ok) {
    const raw = await response.text();
    let parsed;

    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = raw;
    }

    const message =
      parsed?.message ||
      parsed?.[0]?.message ||
      `Add to cart failed with status ${response.status}.`;

    return {
      ok: false,
      error: new Error(message),
      response,
      parsed
    };
  }

  let result = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  return {
    ok: true,
    result,
    response
  };
}

export async function addProductToCart({
  productId,
  quantity,
  storeName = DEFAULT_STORE_NAME,
  webStoreId
} = {}) {
  const normalizedProductId = String(productId || "").trim();
  const normalizedQuantity = parsePositiveInteger(quantity) ?? 1;

  if (!normalizedProductId) {
    return {
      ok: false,
      error: new Error("Missing productId.")
    };
  }

  try {
    const result = await addItemToCart(
      normalizedProductId,
      normalizedQuantity
    );

    dispatchCartUpdated({
      productId: normalizedProductId,
      quantity: normalizedQuantity
    });

    return {
      ok: true,
      result
    };
  } catch (error) {
    const fallback = await addProductToCartViaRest({
      productId: normalizedProductId,
      quantity: normalizedQuantity,
      storeName,
      webStoreId,
      cartStateOrId: "active",
      asGuest: isGuestUser
    });

    if (fallback.ok) {
      dispatchCartUpdated({
        productId: normalizedProductId,
        quantity: normalizedQuantity
      });
      return fallback;
    }

    return {
      ok: false,
      error: fallback.error || error,
      primaryError: error,
      fallbackError: fallback.error
    };
  }
}

/**
 * Resolve the unit price from tier pricing for a given quantity.
 * @param {object} variation — The selected variation with tiers and unitPrice.
 * @param {number} quantity — The quantity the buyer wants.
 * @param {number} [defaultMinQty=10] — Fallback minimum quantity.
 * @returns {number|null} The resolved price or null.
 */
export function resolveUnitPriceForQuantity(variation, quantity, defaultMinQty = 10) {
  if (!variation) {
    return null;
  }

  const tiers = variation.tiers;
  const fallbackPrice = toNumber(variation.unitPrice);
  if (!tiers?.length) {
    return fallbackPrice;
  }

  const qty = parsePositiveInteger(quantity) ?? defaultMinQty;
  for (const tier of tiers) {
    const lower = toNumber(tier?.lowerBound);
    const upper = toNumber(tier?.upperBound);
    const price = toNumber(tier?.price);

    if (price === null || lower === null) {
      continue;
    }

    if (qty >= lower && (upper === null || qty <= upper)) {
      return price;
    }
  }

  return fallbackPrice;
}

export { DEFAULT_STORE_NAME };