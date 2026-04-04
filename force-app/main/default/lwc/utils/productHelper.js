/**
 * Shared product-related utilities for ABC B2B Commerce LWCs.
 * Used by similarProductsByState, similarProductsBySubject, featuredStateBooks, etc.
 */

const DEFAULT_STORE_NAME = "AmericanBookCompany";

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

export { DEFAULT_STORE_NAME };
