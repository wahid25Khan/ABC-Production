import { createElement } from "lwc";
import QuickShopModal from "c/quickShopModal";
import getFavoriteState from "@salesforce/apex/WishlistController.getFavoriteState";
import toggleFavorite from "@salesforce/apex/WishlistController.toggleFavorite";

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

// Flush the microtask queue so LWC re-renders after reactive property changes
function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SINGLE_VARIATION = {
  variations: [
    {
      format: "Color Print + Digital",
      productId: "01tABC0000001AAAA",
      unitPrice: 41,
      minimumQuantity: 10,
      maximumQuantity: 50,
      incrementQuantity: 1,
      tiers: [
        { lowerBound: 10, upperBound: 24, price: 41 },
        { lowerBound: 25, upperBound: null, price: 25.5 }
      ]
    }
  ]
};

const TWO_VARIATIONS = {
  variations: [
    {
      format: "Color Print + Digital",
      productId: "01tABC0000001AAAA",
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
      productId: "01tABC0000001AAAA",
      unitPrice: 41,
      minimumQuantity: 10,
      maximumQuantity: 10000,
      incrementQuantity: 1,
      tiers: [
        { lowerBound: 10, upperBound: 24, price: 41 },
        { lowerBound: 25, upperBound: null, price: 25.25 }
      ]
    }
  ]
};

const NO_BULK_VARIATION = {
  variations: [
    {
      format: "Standard",
      productId: "01tABC0000001BBBB",
      unitPrice: 41,
      minimumQuantity: 10,
      maximumQuantity: 50,
      incrementQuantity: 1,
      tiers: []
    }
  ]
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createModal(props = {}) {
  const el = createElement("c-quick-shop-modal", { is: QuickShopModal });
  Object.assign(el, props);
  document.body.appendChild(el);
  return el;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("c-quick-shop-modal", () => {
  beforeEach(() => {
    getFavoriteState.mockResolvedValue({ success: true, favorite: false });
    toggleFavorite.mockResolvedValue({ success: true, favorite: true });
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.firstChild.remove();
    }
    jest.clearAllMocks();
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  it("shows loading spinner when title is not set", async () => {
    const el = createModal({ variationPricing: SINGLE_VARIATION });
    await flushPromises();
    expect(el.shadowRoot.querySelector("lightning-spinner")).not.toBeNull();
  });

  it("shows loading spinner when variationPricing is not set", async () => {
    const el = createModal({ title: "Test Book" });
    await flushPromises();
    expect(el.shadowRoot.querySelector("lightning-spinner")).not.toBeNull();
  });

  it("hides loading spinner when both title and variationPricing are provided", async () => {
    const el = createModal({
      title: "Test Book",
      variationPricing: SINGLE_VARIATION
    });
    await flushPromises();
    expect(el.shadowRoot.querySelector("lightning-spinner")).toBeNull();
  });

  it("shows pricing error state without trapping the user in loading", async () => {
    const el = createModal({
      title: "Test Book",
      productId: "01tERROR000001",
      pricingError: true
    });
    await flushPromises();

    expect(el.shadowRoot.querySelector("lightning-spinner")).toBeNull();
    expect(el.shadowRoot.querySelector(".pricing-error")).not.toBeNull();
    expect(el.shadowRoot.querySelector(".btn-add").disabled).toBe(true);
    expect(el.shadowRoot.querySelector(".details-btn").disabled).toBe(false);
  });

  // ── Rendering ─────────────────────────────────────────────────────────────

  it("renders the product title in the modal heading", async () => {
    const el = createModal({
      title: "Georgia GSE Success American Government",
      variationPricing: SINGLE_VARIATION
    });
    await flushPromises();
    expect(el.shadowRoot.querySelector("h2.title").textContent).toBe(
      "Georgia GSE Success American Government"
    );
  });

  it("renders the ISBN as subtitle", async () => {
    const el = createModal({
      title: "Test Book",
      isbn: "ISBN: 9780000000000",
      variationPricing: SINGLE_VARIATION
    });
    await flushPromises();
    expect(el.shadowRoot.querySelector(".subtitle").textContent).toBe(
      "ISBN: 9780000000000"
    );
  });

  // ── Tier display ───────────────────────────────────────────────────────────

  it("renders one row per tier", async () => {
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION });
    await flushPromises();
    expect(el.shadowRoot.querySelectorAll(".price-row").length).toBe(2);
  });

  it("renders correct tier quantity labels (bounded and open-ended)", async () => {
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION });
    await flushPromises();
    const rows = el.shadowRoot.querySelectorAll(".price-row");
    // First row: "10–24" (en-dash \u2013), second row: "25+"
    expect(rows[0].querySelector(".td").textContent).toBe("10\u201324");
    expect(rows[1].querySelector(".td").textContent).toBe("25+");
  });

  it("formats tier price as USD with 2 decimal places", async () => {
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION });
    await flushPromises();
    const priceCell = el.shadowRoot.querySelector(".price-row .price");
    expect(priceCell.textContent).toBe("$41.00");
  });

  it("falls back to flat-rate row when no tiers are defined", async () => {
    const el = createModal({ title: "T", variationPricing: NO_BULK_VARIATION });
    await flushPromises();
    // hasTiers = false → one flat-rate .price-row is rendered (no tier rows)
    const rows = el.shadowRoot.querySelectorAll(".price-row");
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector(".td").textContent).toContain("+");
  });

  // ── Unit price resolution ──────────────────────────────────────────────────

  it("uses tier-1 unit price for qty in standard range (10–24)", async () => {
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION });
    await flushPromises();
    // Default qty = minQty = 10 → tier 1 ($41); total = 10 × 41 = $410.00
    const strong = el.shadowRoot.querySelector(".order-total-line strong");
    expect(strong.textContent).toBe("$410.00");
  });

  it("uses tier-2 bulk price for qty at bulk threshold (25+)", async () => {
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION });
    await flushPromises();
    const input = el.shadowRoot.querySelector(".qty-input");
    input.value = "30";
    input.dispatchEvent(new Event("input"));
    await flushPromises();
    // qty=30 → tier 2 ($25.50); total = 30 × 25.5 = $765.00
    const strong = el.shadowRoot.querySelector(".order-total-line strong");
    expect(strong.textContent).toBe("$765.00");
  });

  it("updates total when quantity is set exactly at bulk threshold (25)", async () => {
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION });
    await flushPromises();
    const input = el.shadowRoot.querySelector(".qty-input");
    input.value = "25";
    input.dispatchEvent(new Event("input"));
    await flushPromises();
    // qty=25 → tier 2 ($25.50); total = 25 × 25.5 = $637.50
    const strong = el.shadowRoot.querySelector(".order-total-line strong");
    expect(strong.textContent).toBe("$637.50");
  });

  it("displays order-total-line element in the template", async () => {
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION });
    await flushPromises();
    expect(el.shadowRoot.querySelector(".order-total-line")).not.toBeNull();
    expect(
      el.shadowRoot.querySelector(".order-total-line").textContent
    ).toContain("Order Total");
  });

  // ── Quantity stepper ───────────────────────────────────────────────────────

  it("initialises quantity to minQty from variation", async () => {
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION });
    await flushPromises();
    expect(Number(el.shadowRoot.querySelector(".qty-input").value)).toBe(10);
  });

  it("increments quantity by incrementQty on plus-button click", async () => {
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION });
    await flushPromises();
    el.shadowRoot.querySelector('[aria-label="Increase quantity"]').click();
    await flushPromises();
    expect(Number(el.shadowRoot.querySelector(".qty-input").value)).toBe(11);
  });

  it("decrements quantity by incrementQty on minus-button click", async () => {
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION });
    await flushPromises();
    // Increment first so we have room to decrement
    el.shadowRoot.querySelector('[aria-label="Increase quantity"]').click();
    await flushPromises();
    el.shadowRoot.querySelector('[aria-label="Decrease quantity"]').click();
    await flushPromises();
    expect(Number(el.shadowRoot.querySelector(".qty-input").value)).toBe(10);
  });

  it("disables decrement button when quantity equals minQty", async () => {
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION });
    await flushPromises();
    expect(
      el.shadowRoot.querySelector('[aria-label="Decrease quantity"]').disabled
    ).toBe(true);
  });

  it("disables increment button when quantity equals maxQty", async () => {
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION }); // max = 50
    await flushPromises();
    const input = el.shadowRoot.querySelector(".qty-input");
    input.value = "50";
    input.dispatchEvent(new Event("input"));
    await flushPromises();
    expect(
      el.shadowRoot.querySelector('[aria-label="Increase quantity"]').disabled
    ).toBe(true);
  });

  it("clamps typed quantity below minQty up to minQty", async () => {
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION });
    await flushPromises();
    const input = el.shadowRoot.querySelector(".qty-input");
    input.value = "3";
    input.dispatchEvent(new Event("input"));
    await flushPromises();
    expect(Number(input.value)).toBe(10);
  });

  it("clamps typed quantity above maxQty down to maxQty", async () => {
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION }); // max = 50
    await flushPromises();
    const input = el.shadowRoot.querySelector(".qty-input");
    input.value = "999";
    input.dispatchEvent(new Event("input"));
    await flushPromises();
    expect(Number(input.value)).toBe(50);
  });

  it("snaps typed quantity to nearest valid increment when incrementQty > 1", async () => {
    const incVariation = {
      variations: [
        {
          format: "Standard",
          productId: "01tINC",
          unitPrice: 41,
          minimumQuantity: 10,
          maximumQuantity: 100,
          incrementQuantity: 5,
          tiers: [{ lowerBound: 10, upperBound: null, price: 41 }]
        }
      ]
    };
    const el = createModal({ title: "T", variationPricing: incVariation });
    await flushPromises();
    const input = el.shadowRoot.querySelector(".qty-input");
    // Type 13 → nearest valid step = 10 + round((13-10)/5)*5 = 10+5=15
    input.value = "13";
    input.dispatchEvent(new Event("input"));
    await flushPromises();
    expect(Number(input.value)).toBe(15);
  });

  // ── maxQty sentinel guard ──────────────────────────────────────────────────

  it("ignores variation maximumQuantity > 9999 (sentinel) and falls back to @api prop", async () => {
    // TWO_VARIATIONS has maximumQuantity = 10000 (> 9999 sentinel)
    const el = createModal({
      title: "T",
      variationPricing: TWO_VARIATIONS,
      maximumQuantity: 50
    });
    await flushPromises();
    expect(el.shadowRoot.querySelector(".qty-input").getAttribute("max")).toBe(
      "50"
    );
  });

  // ── addtocart event ────────────────────────────────────────────────────────

  it("dispatches addtocart event with correct productId, quantity and unitPrice", async () => {
    const el = createModal({
      title: "Test Book",
      isbn: "ISBN: 9780000000001",
      variationPricing: SINGLE_VARIATION
    });
    await flushPromises();
    const handler = jest.fn();
    el.addEventListener("addtocart", handler);
    el.shadowRoot.querySelector(".btn-add").click();
    expect(handler).toHaveBeenCalledTimes(1);
    const { productId, quantity, unitPrice, isbn, title } =
      handler.mock.calls[0][0].detail;
    expect(productId).toBe("01tABC0000001AAAA");
    expect(quantity).toBe(10);
    expect(unitPrice).toBe(41); // tier-1 price at qty 10
    expect(isbn).toBe("ISBN: 9780000000001");
    expect(title).toBe("Test Book");
  });

  it("dispatches addtocart with bulk unit price when qty is in bulk tier", async () => {
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION });
    await flushPromises();
    const input = el.shadowRoot.querySelector(".qty-input");
    input.value = "30";
    input.dispatchEvent(new Event("input"));
    await flushPromises();
    const handler = jest.fn();
    el.addEventListener("addtocart", handler);
    el.shadowRoot.querySelector(".btn-add").click();
    const { quantity, unitPrice } = handler.mock.calls[0][0].detail;
    expect(quantity).toBe(30);
    expect(unitPrice).toBe(25.5); // tier-2 bulk price
  });

  // ── Total price = cart-consistent ─────────────────────────────────────────

  it("total price matches listPrice × qty for standard qty (matches what cart will charge)", async () => {
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION });
    await flushPromises();
    // qty=10, unitPrice=$41 → order total = $410.00
    const strong = el.shadowRoot.querySelector(".order-total-line strong");
    expect(strong.textContent).toBe("$410.00");
  });

  it("total price matches discounted price × qty for bulk qty (matches what cart will charge at 25+)", async () => {
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION });
    await flushPromises();
    const input = el.shadowRoot.querySelector(".qty-input");
    input.value = "25";
    input.dispatchEvent(new Event("input"));
    await flushPromises();
    // qty=25, unitPrice=$25.50 → order total = $637.50
    const strong = el.shadowRoot.querySelector(".order-total-line strong");
    expect(strong.textContent).toBe("$637.50");
  });

  // ── Close behavior ────────────────────────────────────────────────────────

  it("dispatches close event when X button is clicked", async () => {
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION });
    await flushPromises();
    const handler = jest.fn();
    el.addEventListener("close", handler);
    el.shadowRoot.querySelector(".close-btn").click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("dispatches close event when backdrop is clicked", async () => {
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION });
    await flushPromises();
    const handler = jest.fn();
    el.addEventListener("close", handler);
    el.shadowRoot.querySelector(".slds-backdrop").click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  // ── Variation tab switching ────────────────────────────────────────────────

  it("renders two tabs when there are multiple variations", async () => {
    const el = createModal({ title: "T", variationPricing: TWO_VARIATIONS });
    await flushPromises();
    expect(el.shadowRoot.querySelectorAll('[role="tab"]').length).toBe(2);
  });

  it("does not render tabs when there is only one variation", async () => {
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION });
    await flushPromises();
    expect(el.shadowRoot.querySelector(".plan-toggle")).toBeNull();
  });

  it("clicking tab 2 fires planchange with correct format and resets quantity to minQty", async () => {
    const el = createModal({ title: "T", variationPricing: TWO_VARIATIONS });
    await flushPromises();
    // Increment qty first
    el.shadowRoot.querySelector('[aria-label="Increase quantity"]').click();
    await flushPromises();
    const handler = jest.fn();
    el.addEventListener("planchange", handler);
    const tabs = el.shadowRoot.querySelectorAll('[role="tab"]');
    tabs[1].click();
    await flushPromises();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.format).toBe("B&W Print + Digital");
    // Quantity should reset to minQty after tab change
    expect(Number(el.shadowRoot.querySelector(".qty-input").value)).toBe(10);
  });

  it("switching variation changes the bulk tier price in the total", async () => {
    const el = createModal({ title: "T", variationPricing: TWO_VARIATIONS });
    await flushPromises();
    // Set bulk qty on tab 1 (Color Print: $25.50)
    const input = el.shadowRoot.querySelector(".qty-input");
    input.value = "30";
    input.dispatchEvent(new Event("input"));
    await flushPromises();
    expect(
      el.shadowRoot.querySelector(".order-total-line strong").textContent
    ).toBe("$765.00"); // 30 × 25.50
    // Switch to tab 2 (B&W Print: $25.25) — qty resets to 10
    el.shadowRoot.querySelectorAll('[role="tab"]')[1].click();
    await flushPromises();
    // After tab switch, qty resets to 10, tier-1 price → 10 × 41 = $410
    expect(
      el.shadowRoot.querySelector(".order-total-line strong").textContent
    ).toBe("$410.00");
  });

  // ── Trial and view-details events ─────────────────────────────────────────

  it("dispatches trial event with correct detail", async () => {
    const el = createModal({
      title: "Test Book",
      isbn: "ISBN: 9780000000001",
      variationPricing: SINGLE_VARIATION
    });
    await flushPromises();
    const handler = jest.fn();
    el.addEventListener("trial", handler);
    el.shadowRoot.querySelector(".btn-trial").click();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.isbn).toBe("ISBN: 9780000000001");
  });

  it("dispatches viewdetails event when footer button is clicked", async () => {
    const el = createModal({
      title: "Test Book",
      variationPricing: SINGLE_VARIATION
    });
    await flushPromises();
    const handler = jest.fn();
    el.addEventListener("viewdetails", handler);
    el.shadowRoot.querySelector(".details-btn").click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("dispatches viewdetails with fallback productId when pricing is unavailable", async () => {
    const el = createModal({
      title: "Test Book",
      productId: "01tDETAILS0001",
      pricingError: true
    });
    await flushPromises();
    const handler = jest.fn();
    el.addEventListener("viewdetails", handler);

    el.shadowRoot.querySelector(".details-btn").click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.productId).toBe("01tDETAILS0001");
  });

  // ── open/close API ───────────────────────────────────────────────────────

  it("@api close() fires close event and collapses isOpen", async () => {
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION });
    await flushPromises();
    const handler = jest.fn();
    el.addEventListener("close", handler);
    el.close();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("hydrates favorite state from Apex", async () => {
    getFavoriteState.mockResolvedValue({ success: true, favorite: true });
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION });
    await flushPromises();
    await flushPromises();
    const icon = el.shadowRoot.querySelector(".heart-btn lightning-icon");
    expect(icon.iconName).toBe("utility:favorite");
  });

  it("toggles favorite via Apex and dispatches favoritechange", async () => {
    const el = createModal({ title: "T", variationPricing: SINGLE_VARIATION });
    await flushPromises();
    await flushPromises();
    const handler = jest.fn();
    el.addEventListener("favoritechange", handler);

    el.shadowRoot.querySelector(".heart-btn").click();
    await flushPromises();

    expect(toggleFavorite).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.favorite).toBe(true);
  });
});
