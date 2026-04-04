import { createElement } from "lwc";
import ProductDetailComponent from "c/productDetailComponent";
import getVariationPricing from "@salesforce/apex/ProductVariationController.getVariationPricing";
import getFavoriteState from "@salesforce/apex/WishlistController.getFavoriteState";
import toggleFavorite from "@salesforce/apex/WishlistController.toggleFavorite";

// ─── Mock Apex ───────────────────────────────────────────────────────────────

jest.mock(
  "@salesforce/apex/ProductVariationController.getVariationPricing",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/WishlistController.getFavoriteState",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/WishlistController.toggleFavorite",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

// ─── Constants ───────────────────────────────────────────────────────────────

const PRODUCT_ID = "01tTestProduct0001";

// A realistic Apex VariationResult returned by getVariationPricing
const MOCK_VARIATION_RESULT = {
  variations: [
    {
      format: "Color Print + Digital",
      productId: PRODUCT_ID,
      unitPrice: 41,
      minimumQuantity: 10,
      maximumQuantity: 10000,
      incrementQuantity: 1,
      tiers: [
        { lowerBound: 10, upperBound: 24, price: 41 },
        { lowerBound: 25, upperBound: null, price: 25.5 }
      ]
    },
    {
      format: "B&W Print + Digital",
      productId: PRODUCT_ID,
      unitPrice: 41,
      minimumQuantity: 10,
      maximumQuantity: 10000,
      incrementQuantity: 1,
      tiers: [
        { lowerBound: 10, upperBound: 24, price: 41 },
        { lowerBound: 25, upperBound: null, price: 25.25 }
      ]
    }
  ],
  hasVariations: true
};

// Response from /products?ids=...
const MOCK_PRODUCT_API = {
  products: [
    {
      id: PRODUCT_ID,
      name: "Georgia GSE Success American Government/Civics",
      defaultImage: { url: "https://example.com/book.jpg" },
      purchaseQuantityRule: { minimum: 10, maximum: 10000, increment: 1 },
      fields: { StockKeepingUnit: "ISBN: 9780000000001" }
    }
  ]
};

// Response from /pricing/products?productIds=...
const MOCK_PRICING_API = {
  pricingLineItemResults: [
    {
      productId: PRODUCT_ID,
      currencyIsoCode: "USD",
      listPrice: 41,
      salesPrice: 41,
      unitPrice: 41
    }
  ]
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Flush all pending microtasks and macrotasks (covers nested async/await chains)
function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Build a fetch mock that handles products, pricing and cart-items endpoints */
function buildFetchMock({ cartOk = true } = {}) {
  return jest.fn((url) => {
    if (url.includes("/pricing/products")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(MOCK_PRICING_API)
      });
    }
    if (url.includes("/products")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(MOCK_PRODUCT_API)
      });
    }
    if (url.includes("/cart-items")) {
      return Promise.resolve({ ok: cartOk });
    }
    return Promise.resolve({ ok: false });
  });
}

/** Create element with productId set, append to DOM and wait for async init */
async function createInitialized(extraProps = {}) {
  const el = createElement("c-product-detail-component", {
    is: ProductDetailComponent
  });
  el.productId = PRODUCT_ID;
  Object.assign(el, extraProps);
  document.body.appendChild(el);
  await flushPromises();
  // Extra round to cover nested awaits in initialize() (fetch → json → apex)
  await flushPromises();
  return el;
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  getVariationPricing.mockResolvedValue(MOCK_VARIATION_RESULT);
  getFavoriteState.mockResolvedValue({ success: true, favorite: false });
  toggleFavorite.mockResolvedValue({ success: true, favorite: true });
  globalThis.fetch = buildFetchMock();
  // Replace location with a plain writable object so Jest doesn't
  // throw "Not implemented: navigation" when handleAddToCart redirects.
  delete globalThis.location;
  globalThis.location = {
    href: `https://americanbookcompany.my.site.com/AmericanBookCompany/product/test/${PRODUCT_ID}`,
    pathname: `/AmericanBookCompany/product/test/${PRODUCT_ID}`,
    search: "",
    origin: "https://americanbookcompany.my.site.com"
  };
});

afterEach(() => {
  while (document.body.firstChild) {
    document.body.firstChild.remove();
  }
  jest.clearAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("c-product-detail-component", () => {
  // ── Loading state ──────────────────────────────────────────────────────────

  it("shows loading spinner before initialization completes", async () => {
    // Use a fetch that never resolves so we can observe the loading state
    globalThis.fetch = jest.fn(() => new Promise(() => {}));
    const el = createElement("c-product-detail-component", {
      is: ProductDetailComponent
    });
    el.productId = PRODUCT_ID;
    document.body.appendChild(el);
    await Promise.resolve(); // First tick: connectedCallback fires, loading=true
    expect(el.shadowRoot.querySelector("lightning-spinner")).not.toBeNull();
  });

  it("hides loading spinner after product is fetched", async () => {
    const el = await createInitialized();
    expect(el.shadowRoot.querySelector("lightning-spinner")).toBeNull();
  });

  // ── Product rendering ──────────────────────────────────────────────────────

  it("renders the product title after initialization", async () => {
    const el = await createInitialized();
    const title = el.shadowRoot.querySelector(".title");
    expect(title).not.toBeNull();
    expect(title.textContent).toBe(
      "Georgia GSE Success American Government/Civics"
    );
  });

  it("renders product ISBN as subtitle", async () => {
    const el = await createInitialized();
    // ISBN is in the subtitle element
    const subtitle = el.shadowRoot.querySelector(".subtitle");
    expect(subtitle).not.toBeNull();
  });

  it("calls the Salesforce products API with the correct productId", async () => {
    await createInitialized();
    const fetchCalls = globalThis.fetch.mock.calls;
    const productCall = fetchCalls.find(
      ([url]) => url.includes("/products") && !url.includes("/pricing/")
    );
    expect(productCall).toBeDefined();
    expect(productCall[0]).toContain(PRODUCT_ID);
  });

  it("calls the pricing API with the correct productId", async () => {
    await createInitialized();
    const pricingCall = globalThis.fetch.mock.calls.find(([url]) =>
      url.includes("/pricing/products")
    );
    expect(pricingCall).toBeDefined();
    expect(pricingCall[0]).toContain(PRODUCT_ID);
  });

  // ── Order total display ────────────────────────────────────────────────────

  it("displays order-total-line element after loading", async () => {
    const el = await createInitialized();
    expect(el.shadowRoot.querySelector(".order-total-line")).not.toBeNull();
  });

  it("shows correct order total for standard qty (10 × $41 = $410)", async () => {
    const el = await createInitialized();
    const strong = el.shadowRoot.querySelector(".order-total-line strong");
    expect(strong.textContent).toBe("$410.00");
  });

  it("updates order total when user changes qty to bulk threshold (25 × $25.50 = $637.50)", async () => {
    const el = await createInitialized();
    const input = el.shadowRoot.querySelector(".qty-input");
    input.value = "25";
    input.dispatchEvent(new Event("input"));
    await flushPromises();
    const strong = el.shadowRoot.querySelector(".order-total-line strong");
    expect(strong.textContent).toBe("$637.50");
  });

  it("uses tier-2 bulk price for qty above threshold (30 × $25.50 = $765)", async () => {
    const el = await createInitialized();
    const input = el.shadowRoot.querySelector(".qty-input");
    input.value = "30";
    input.dispatchEvent(new Event("input"));
    await flushPromises();
    const strong = el.shadowRoot.querySelector(".order-total-line strong");
    expect(strong.textContent).toBe("$765.00");
  });

  // ── Quantity stepper ───────────────────────────────────────────────────────

  it("initialises quantity to minQty (10) after loading", async () => {
    const el = await createInitialized();
    expect(Number(el.shadowRoot.querySelector(".qty-input").value)).toBe(10);
  });

  it("increment button increases quantity by 1", async () => {
    const el = await createInitialized();
    el.shadowRoot.querySelector('[aria-label="Increase quantity"]').click();
    await flushPromises();
    expect(Number(el.shadowRoot.querySelector(".qty-input").value)).toBe(11);
  });

  it("decrement button decreases quantity by 1", async () => {
    const el = await createInitialized();
    el.shadowRoot.querySelector('[aria-label="Increase quantity"]').click();
    await flushPromises();
    el.shadowRoot.querySelector('[aria-label="Decrease quantity"]').click();
    await flushPromises();
    expect(Number(el.shadowRoot.querySelector(".qty-input").value)).toBe(10);
  });

  it("decrement button is disabled when quantity is at minQty", async () => {
    const el = await createInitialized();
    expect(
      el.shadowRoot.querySelector('[aria-label="Decrease quantity"]').disabled
    ).toBe(true);
  });

  it("clamps typed quantity below minQty to minQty", async () => {
    const el = await createInitialized();
    const input = el.shadowRoot.querySelector(".qty-input");
    input.value = "2";
    input.dispatchEvent(new Event("input"));
    await flushPromises();
    expect(Number(input.value)).toBe(10);
  });

  it("ignores PurchaseQuantityRule maximum > 9999 (sentinel) and uses fallback 50", async () => {
    // maximumQuantity = 10000 from MOCK_VARIATION_RESULT (> 9999 sentinel)
    // → maxQty falls back to @api prop default 50
    const el = await createInitialized();
    expect(el.shadowRoot.querySelector(".qty-input").getAttribute("max")).toBe(
      "50"
    );
  });

  // ── Tier display ───────────────────────────────────────────────────────────

  it("renders two tier rows after variation pricing loads", async () => {
    const el = await createInitialized();
    expect(el.shadowRoot.querySelectorAll(".price-row").length).toBe(2);
  });

  it("renders bulk-tier label as 25+", async () => {
    const el = await createInitialized();
    const rows = el.shadowRoot.querySelectorAll(".price-row");
    expect(rows[1].querySelector(".td").textContent).toBe("25+");
  });

  it("renders Digital Only as a quantity and price table row", async () => {
    getVariationPricing.mockResolvedValue({
      variations: [
        {
          format: "Digital Only",
          productId: PRODUCT_ID,
          unitPrice: 15.25,
          minimumQuantity: 50,
          maximumQuantity: 50,
          incrementQuantity: 1,
          tiers: []
        }
      ],
      hasVariations: false
    });

    const el = await createInitialized();
    const headers = [
      ...el.shadowRoot.querySelectorAll(".price-table-head .th")
    ].map((node) => node.textContent.trim());
    const row = el.shadowRoot.querySelector(".price-row");

    expect(headers).toEqual(["Quantity", "Price"]);
    expect(row.textContent).toContain("50+");
    expect(row.textContent).toContain("$15.25");
  });

  // ── Variation tab switching ────────────────────────────────────────────────

  it("renders two variation tabs", async () => {
    const el = await createInitialized();
    expect(el.shadowRoot.querySelectorAll('[role="tab"]').length).toBe(2);
  });

  it("switching to B&W tab resets quantity & updates total to B&W tier price", async () => {
    const el = await createInitialized();
    // Set qty to 30 (bulk tier of Color: $25.50)
    const input = el.shadowRoot.querySelector(".qty-input");
    input.value = "30";
    input.dispatchEvent(new Event("input"));
    await flushPromises();
    expect(
      el.shadowRoot.querySelector(".order-total-line strong").textContent
    ).toBe("$765.00"); // 30 × 25.50

    // Switch to B&W tab → qty resets to 10 → 10 × 41 = $410
    el.shadowRoot.querySelectorAll('[role="tab"]')[1].click();
    await flushPromises();
    expect(
      el.shadowRoot.querySelector(".order-total-line strong").textContent
    ).toBe("$410.00");
  });

  // ── handleAddToCart ────────────────────────────────────────────────────────

  it("calls the cart-items API with productId, quantity and type=Product", async () => {
    const el = await createInitialized();
    el.shadowRoot.querySelector(".btn-add").click();
    await flushPromises();
    const cartCall = globalThis.fetch.mock.calls.find(([url]) =>
      url.includes("/cart-items")
    );
    expect(cartCall).toBeDefined();
    const cartUrl = new URL(cartCall[0], "https://example.com");
    const body = JSON.parse(cartCall[1].body);
    expect(cartUrl.searchParams.get("language")).toBe("en-US");
    expect(cartUrl.searchParams.get("asGuest")).toBe("true");
    expect(cartUrl.searchParams.get("htmlEncode")).toBe("false");
    expect(body.productId).toBe(PRODUCT_ID);
    expect(body.quantity).toBe(10);
    expect(body.type).toBe("Product");
  });

  it("calls products and pricing APIs with guest storefront parameters", async () => {
    await createInitialized();

    const productsCall = globalThis.fetch.mock.calls.find(
      ([url]) =>
        url.includes("/products?") && !url.includes("/pricing/products")
    );
    const pricingCall = globalThis.fetch.mock.calls.find(([url]) =>
      url.includes("/pricing/products")
    );

    expect(productsCall).toBeDefined();
    expect(pricingCall).toBeDefined();

    const productsUrl = new URL(productsCall[0], "https://example.com");
    const pricingUrl = new URL(pricingCall[0], "https://example.com");

    expect(productsUrl.searchParams.get("asGuest")).toBe("true");
    expect(productsUrl.searchParams.get("language")).toBe("en-US");
    expect(productsUrl.searchParams.get("htmlEncode")).toBe("false");
    expect(pricingUrl.searchParams.get("asGuest")).toBe("true");
    expect(pricingUrl.searchParams.get("language")).toBe("en-US");
    expect(pricingUrl.searchParams.get("htmlEncode")).toBe("false");
  });

  it("dispatches addtocart event with correct productId, quantity and unitPrice", async () => {
    const el = await createInitialized();
    const handler = jest.fn();
    el.addEventListener("addtocart", handler);
    el.shadowRoot.querySelector(".btn-add").click();
    await flushPromises();
    expect(handler).toHaveBeenCalledTimes(1);
    const { productId, quantity, unitPrice } = handler.mock.calls[0][0].detail;
    expect(productId).toBe(PRODUCT_ID);
    expect(quantity).toBe(10);
    expect(unitPrice).toBe(41); // tier-1 price at qty 10
  });

  it("dispatches addtocart with bulk unit price when qty is in bulk tier", async () => {
    const el = await createInitialized();
    const input = el.shadowRoot.querySelector(".qty-input");
    input.value = "30";
    input.dispatchEvent(new Event("input"));
    await flushPromises();
    const handler = jest.fn();
    el.addEventListener("addtocart", handler);
    el.shadowRoot.querySelector(".btn-add").click();
    await flushPromises();
    const { quantity, unitPrice } = handler.mock.calls[0][0].detail;
    expect(quantity).toBe(30);
    expect(unitPrice).toBe(25.5); // tier-2 bulk price for Color Print
  });

  it("dispatches addtocart event even when cart API returns error", async () => {
    globalThis.fetch = buildFetchMock({ cartOk: false });
    const el = await createInitialized();
    const handler = jest.fn();
    el.addEventListener("addtocart", handler);
    el.shadowRoot.querySelector(".btn-add").click();
    await flushPromises();
    // addtocart event is always dispatched regardless of cart API success
    expect(handler).toHaveBeenCalledTimes(1);
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  it("shows error message when products API fails", async () => {
    globalThis.fetch = jest.fn((url) => {
      if (url.includes("/pricing/products")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(MOCK_PRICING_API)
        });
      }
      // Products endpoint returns not-ok
      return Promise.resolve({ ok: false });
    });
    const el = createElement("c-product-detail-component", {
      is: ProductDetailComponent
    });
    el.productId = PRODUCT_ID;
    document.body.appendChild(el);
    await flushPromises();
    await flushPromises();
    const errEl = el.shadowRoot.querySelector(".error-message");
    expect(errEl).not.toBeNull();
    expect(errEl.textContent).toContain("Unable to load");
  });

  it("shows error message when no productId is provided and URL has no ID", async () => {
    globalThis.location = {
      href: "https://americanbookcompany.my.site.com/AmericanBookCompany/home",
      pathname: "/AmericanBookCompany/home",
      search: ""
    };
    const el = createElement("c-product-detail-component", {
      is: ProductDetailComponent
    });
    // productId is empty (default ""), URL has no SF ID pattern
    document.body.appendChild(el);
    await flushPromises();
    await flushPromises();
    const errEl = el.shadowRoot.querySelector(".error-message");
    expect(errEl).not.toBeNull();
  });

  // ── getVariationPricing failure does not break the PDP ────────────────────

  it("renders product even when getVariationPricing Apex throws", async () => {
    getVariationPricing.mockRejectedValue(new Error("Apex error"));
    const el = await createInitialized();
    // Product should still be visible (variationPricing stays null, no crash)
    expect(el.shadowRoot.querySelector(".title")).not.toBeNull();
  });

  it("hydrates favorite state from Apex on initial load", async () => {
    getFavoriteState.mockResolvedValue({ success: true, favorite: true });
    const el = await createInitialized();
    const icon = el.shadowRoot.querySelector(".heart-btn lightning-icon");
    expect(icon.iconName).toBe("utility:favorite");
  });

  it("toggles favorite via Apex and dispatches favoritechange", async () => {
    const el = await createInitialized();
    const handler = jest.fn();
    el.addEventListener("favoritechange", handler);

    el.shadowRoot.querySelector(".heart-btn").click();
    await flushPromises();

    expect(toggleFavorite).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.favorite).toBe(true);
  });
});
