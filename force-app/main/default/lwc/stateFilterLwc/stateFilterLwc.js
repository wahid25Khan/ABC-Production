import { LightningElement, api } from "lwc";
import isGuest from "@salesforce/user/isGuest";
import getFavoriteState from "@salesforce/apex/WishlistController.getFavoriteState";
import toggleFavorite from "@salesforce/apex/WishlistController.toggleFavorite";
import {
  ALL_STATES,
  STATE_ABBREVIATIONS,
  readStateFromStorage,
  writeStateToStorage,
  decodeUrlValue,
  DEFAULT_WEBSTORE_ID
} from "c/utils";

const CHECKOUT_STAGE_KEY = "abc_checkout_stage";
const CART_FILLED_RECOVERY_RELOAD_KEY = "abc_cart_filled_recovery_reload";
const LOGIN_URL = "/AmericanBookCompany/login";
const GUEST_LOGIN_GUARD_PATHS = new Set([
  "/AmericanBookCompany/mylists",
  "/AmericanBookCompany/my-orders"
]);
const CART_PRODUCT_DETAIL_PATTERN = /\/product\/[^/]+\/([A-Za-z0-9]{15,18})(?:[?#]|$)/;

export default class StateFilterLwc extends LightningElement {
  @api refinementKey = "State__c";
  @api refinementParam = "refinement";
  @api refinementsParam = "refinements";
  @api facetsParam = "facets";

  @api defaultState = "Georgia";

  resultsBasePath = "/AmericanBookCompany/global-search";
  resultsAllPath = "/AmericanBookCompany/global-search/all";

  urlMode = "compat"; // 'short' | 'compat'

  cleanDelayFastMs = 180;
  cleanDelaySlowMs = 500;

  watchIntervalMs = 250;
  watchDebounceMs = 120;
  searchInputWatchMs = 300;

  selectedValue = "";
  isOpen = false;

  states = [...ALL_STATES];

  _docClickHandler;
  _watchId;
  _watchDebounce;
  _lastHref;
  _cleanT1;
  _cleanT2;
  _searchInputWatchId;
  _cartPatchId;
  cartWishlistStates = new Map();
  cartWishlistPendingProductIds = new Set();

  connectedCallback() {
    if (this.redirectGuestAccountPageToLogin()) {
      return;
    }

    const url = new URL(globalThis.location.href);

    if (this.isResultsPage(url)) {
      this.ensureResultsAllIfMissing(url);

      const st = this.getStateFromResults(url) || this.defaultState;
      this.selectedValue = st;
      writeStateToStorage(st);

      const refreshedUrl = new URL(globalThis.location.href);
      if (refreshedUrl.search && refreshedUrl.search.length > 1) {
        this.cleanUrlAfterDelay();
      }
    } else {
      const st = this.resolveStandardPageState(url);
      this.selectedValue = st;
      writeStateToStorage(st);

      if (this.isHomePage(url)) {
        this.ensureHomeHash(st);
      }

      const refreshedUrl = new URL(globalThis.location.href);
      if (
        (!this.isHomePage(refreshedUrl) && refreshedUrl.hash) ||
        (refreshedUrl.search && refreshedUrl.search.length > 1)
      ) {
        this.cleanUrlAfterDelay();
      }
    }

    this._docClickHandler = (evt) => {
      if (!this.template.contains(evt.target)) {
        this.isOpen = false;
      }
    };
    document.addEventListener("click", this._docClickHandler);

    this.startUrlWatcher();
    this.startSearchInputWatcher();
    this.startCartPatchWatcher();

    // eslint-disable-next-line @lwc/lwc/no-async-operation
    globalThis.setTimeout(() => {
      this.clearVisibleSearchInputIfAll();
    }, 250);

    // eslint-disable-next-line @lwc/lwc/no-async-operation
    globalThis.setTimeout(() => {
      this.clearVisibleSearchInputIfAll();
    }, 800);
  }

  redirectGuestAccountPageToLogin() {
    if (!isGuest) {
      return false;
    }

    const currentUrl = new URL(globalThis.location.href);
    const currentPath = this.normalizeGuardPath(currentUrl.pathname);

    if (!GUEST_LOGIN_GUARD_PATHS.has(currentPath)) {
      return false;
    }

    const startUrl = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    globalThis.location.replace(
      `${LOGIN_URL}?startURL=${encodeURIComponent(startUrl)}`
    );
    return true;
  }

  normalizeGuardPath(path) {
    if (!path || path === "/") {
      return path || "/";
    }

    return path.endsWith("/") ? path.slice(0, -1) : path;
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._docClickHandler);
    this.stopUrlWatcher();
    this.stopSearchInputWatcher();
    this.stopCartPatchWatcher();
    globalThis.clearTimeout(this._cleanT1);
    globalThis.clearTimeout(this._cleanT2);
  }

  get displayShortValue() {
    const selected = this.selectedValue || this.defaultState || "";
    return this.toStateAbbreviation(selected);
  }

  get valueClass() {
    return this.selectedValue ? "value" : "value placeholder";
  }

  get optionList() {
    return this.states.map((s) => ({
      label: s,
      value: s,
      className: s === this.selectedValue ? "option selected" : "option"
    }));
  }

  toggleOpen(event) {
    event.stopPropagation();
    this.isOpen = !this.isOpen;
  }

  handleSelect(event) {
    event.stopPropagation();
    const val = event.currentTarget.dataset.value || "";
    this.selectedValue = val;
    this.isOpen = false;
    writeStateToStorage(val);
    this.applyToUrl(val);
  }

  startUrlWatcher() {
    this._lastHref = globalThis.location.href;
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._watchId = globalThis.setInterval(() => {
      const href = globalThis.location.href;
      if (href !== this._lastHref) {
        this._lastHref = href;
        globalThis.clearTimeout(this._watchDebounce);
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._watchDebounce = globalThis.setTimeout(() => {
          this.onUrlChanged();
        }, this.watchDebounceMs);
      }
    }, this.watchIntervalMs);
  }

  stopUrlWatcher() {
    globalThis.clearInterval(this._watchId);
    globalThis.clearTimeout(this._watchDebounce);
    this._watchId = null;
    this._watchDebounce = null;
  }

  startSearchInputWatcher() {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._searchInputWatchId = globalThis.setInterval(() => {
      try {
        const url = new URL(globalThis.location.href);
        if (!this.isResultsPage(url)) return;

        const kw = this.getResultsKeyword(url);

        if ((kw || "").toLowerCase() === "all") {
          this.clearVisibleSearchInputIfAll();
          return;
        }

        const input = this.findGlobalSearchInput();
        if (!input) return;

        const inputVal = (input.value || "").trim();

        if (!inputVal && kw && kw.toLowerCase() !== "all") {
          const params = new URLSearchParams(url.search);
          const stateVal =
            this.getStateFromResults(url) ||
            this.selectedValue ||
            this.defaultState;

          params.set("page", "1");
          params.set(this.refinementParam, `${this.refinementKey}:${stateVal}`);

          if (this.urlMode === "compat") {
            const refinementsList = [
              {
                nameOrId: this.refinementKey,
                type: "DistinctValue",
                attributeType: "Custom",
                values: [stateVal]
              }
            ];
            params.set(
              this.refinementsParam,
              encodeURIComponent(JSON.stringify(refinementsList))
            );
          } else {
            params.delete(this.refinementsParam);
          }

          params.delete(this.facetsParam);
          params.delete(`search-facet-section-${this.refinementKey}`);

          const target =
            this.resultsAllPath +
            (params.toString() ? `?${params.toString()}` : "");
          const currentPathAndSearch =
            globalThis.location.pathname + globalThis.location.search;

          if (currentPathAndSearch !== target) {
            globalThis.location.assign(target);
          }
        }
      } catch {
        // ignore
      }
    }, this.searchInputWatchMs);
  }

  stopSearchInputWatcher() {
    globalThis.clearInterval(this._searchInputWatchId);
    this._searchInputWatchId = null;
  }

  startCartPatchWatcher() {
    this.runCartPageDomPatch();

    // eslint-disable-next-line @lwc/lwc/no-async-operation
    globalThis.setTimeout(() => {
      this.runCartPageDomPatch();
    }, 250);

    // eslint-disable-next-line @lwc/lwc/no-async-operation
    globalThis.setTimeout(() => {
      this.runCartPageDomPatch();
    }, 1000);

    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._cartPatchId = globalThis.setInterval(() => {
      this.runCartPageDomPatch();
    }, 750);
  }

  stopCartPatchWatcher() {
    globalThis.clearInterval(this._cartPatchId);
    this._cartPatchId = null;
  }

  runCartPageDomPatch() {
    try {
      const pathname = globalThis.location?.pathname || "";
      if (/(^|\/)checkout\/?$/.test(pathname)) {
        this.normalizeCheckoutGatePage();
        return;
      }

      if (!/(^|\/)cart\/?$/.test(pathname)) {
        this.resetCheckoutGatePage();
        return;
      }

      this.clearCheckoutStage();

      this.normalizeCartHeading();
      this.normalizeCartSummaryHeading();

      const cartBody = document.querySelector(
        'section[data-automation="cartBody"]'
      );
      const emptyHeadingSelectors = ["h1", "h2", "p", "div", "span"];
      const emptyHeading =
        this.findElementByExactText(
          emptyHeadingSelectors,
          "Your cart is empty"
        ) ||
        this.findElementByExactText(emptyHeadingSelectors, "No items in cart");

      if (cartBody && emptyHeading) {
        document.body.dataset.abcCartEmpty = "true";
        this.applyEmptyCartPatch(cartBody);
        return;
      }

      delete document.body.dataset.abcCartEmpty;

      if (this.shouldRecoverFilledCart(cartBody)) {
        this.recoverFilledCart();
        return;
      }

      this.clearFilledCartRecoveryFlag();
      this.restoreFilledCartMainColumn();
      this.normalizeFilledCartHeading();
      this.alignCartSummaryWithFirstItem();
      this.hideCartChromeForFilledState();
      this.renameDeleteActions();
      this.normalizeCartItemTitles();
      this.normalizeCartItemPrices();
      this.relayoutCartItems();
      this.normalizeCartActionArea();
      this.syncCartWishlistActions();
    } catch {
      // ignore
    }
  }

  normalizeCheckoutGatePage() {
    const gate = document.querySelector("c-checkout-login-gate");
    const columnsContent = gate?.parentElement?.parentElement?.parentElement;

    if (!gate || !columnsContent) {
      return;
    }

    columnsContent.classList.add("abc-checkout-columns");

    const currentStage = this.getCheckoutStage();
    document.body.dataset.abcCheckoutStage = currentStage;

    if (currentStage === "gate") {
      const guestButton = this.findElementByExactText(
        ["button"],
        "Continue as Guest"
      );
      const signInButton = this.findElementByExactText(["button"], "Sign In");

      this.bindCheckoutStageAdvance(guestButton);
      this.bindCheckoutStageAdvance(signInButton);
      delete document.body.dataset.abcCheckoutHideDelivery;
      return;
    }

    this.toggleEmptyShippingMethodSection();
  }

  resetCheckoutGatePage() {
    delete document.body.dataset.abcCheckoutStage;
    delete document.body.dataset.abcCheckoutHideDelivery;
    document.querySelectorAll(".abc-checkout-columns").forEach((el) => {
      el.classList.remove("abc-checkout-columns");
    });
  }

  toggleEmptyShippingMethodSection() {
    const deliverySection = document.querySelector(
      "commerce_unified_checkout-checkout-section-delivery"
    );

    if (!deliverySection) {
      delete document.body.dataset.abcCheckoutHideDelivery;
      return;
    }

    const sectionText = (deliverySection.textContent || "").trim();
    const hasShippingChoices = !!deliverySection.querySelector(
      'input[type="radio"], select, [role="radio"]'
    );

    if (
      !hasShippingChoices &&
      sectionText.includes("Enter an address to see shipping method options")
    ) {
      document.body.dataset.abcCheckoutHideDelivery = "true";
      return;
    }

    delete document.body.dataset.abcCheckoutHideDelivery;
  }

  bindCheckoutStageAdvance(element) {
    if (!element || element.dataset.abcCheckoutBound === "true") {
      return;
    }

    element.dataset.abcCheckoutBound = "true";
    element.addEventListener("click", () => {
      this.setCheckoutStage("details");
      document.body.dataset.abcCheckoutStage = "details";
      globalThis.dispatchEvent(
        new CustomEvent("abccheckoutstagechange", {
          detail: { stage: "details" }
        })
      );
    });
  }

  getCheckoutStage() {
    try {
      return globalThis.sessionStorage?.getItem(CHECKOUT_STAGE_KEY) || "gate";
    } catch {
      return "gate";
    }
  }

  setCheckoutStage(stageValue) {
    try {
      globalThis.sessionStorage?.setItem(CHECKOUT_STAGE_KEY, stageValue);
    } catch {
      // ignore
    }
  }

  clearCheckoutStage() {
    try {
      globalThis.sessionStorage?.removeItem(CHECKOUT_STAGE_KEY);
    } catch {
      // ignore
    }
  }

  normalizeCartHeading() {
    const cartHeadingCandidates = Array.from(
      document.querySelectorAll("h1, p")
    );

    cartHeadingCandidates.forEach((el) => {
      const text = (el.textContent || "").trim();
      if (text === "Cart") {
        el.textContent = "Your Cart";
      }
    });
  }

  normalizeCartSummaryHeading() {
    const summaryHeading = this.findElementByExactText(
      ["h1", "h2", "p", "div", "span"],
      "Summary"
    );
    if (summaryHeading) {
      summaryHeading.textContent = "Order Summary";
    }
  }

  normalizeFilledCartHeading() {
    const heading = document.querySelector("commerce_cart-header h1");
    if (heading) {
      heading.textContent = "Your Cart";
    }

    const countNodes = Array.from(document.querySelectorAll("p, div, span"));
    countNodes.forEach((el) => {
      const text = (el.textContent || "").trim();
      if (/^\(\d+\s+items?\)$/i.test(text)) {
        el.style.display = "none";
      }

      if (text === "Sort By") {
        const wrapper = el.closest("div");
        if (wrapper) {
          wrapper.style.display = "none";
        }
        el.style.display = "none";
      }

      if (text === "Product Code") {
        const wrapper = el.parentElement;
        if (wrapper) {
          wrapper.style.display = "none";
        }
      }
    });
  }

  hideCartChromeForFilledState() {
    const elementsToHide = [
      this.findElementByExactText(["button"], "Skip to Bottom"),
      this.findElementByExactText(["button"], "Skip to Top"),
      this.findElementByExactText(["button"], "Previous"),
      this.findElementByExactText(["button"], "Next"),
      this.findElementByExactText(["button"], "Quantity Help"),
    ];

    elementsToHide.forEach((el) => {
      if (el) {
        el.style.display = "none";
      }
    });

    // Hide the "Quantity Help" (ⓘ) popover element inside the qty selector
    document
      .querySelectorAll("commerce-quantity-selector-popover")
      .forEach((el) => {
        el.style.setProperty("display", "none", "important");
      });

    const pagination = document.querySelector(
      "commerce_cart-managed-contents nav"
    );
    if (pagination) {
      pagination.style.display = "none";
    }

    const sortControl = document.querySelector(
      "commerce_cart-header lightning-combobox"
    );
    if (sortControl) {
      const wrapper = sortControl.closest("div");
      if (wrapper) {
        wrapper.style.display = "none";
      }
    }

    const clearCart = this.findElementByExactText(["button"], "Clear Cart");
    if (clearCart) {
      clearCart.style.display = "none";
    }

    const couponLink = this.findElementByExactText(
      ["a", "button"],
      "Enter a Coupon Code"
    );
    if (couponLink) {
      couponLink.style.display = "none";
    }

    const skuNodes = Array.from(document.querySelectorAll("p, div, span"));
    skuNodes.forEach((el) => {
      const text = (el.textContent || "").trim();
      if (text.startsWith("SKU# ")) {
        el.style.display = "none";
      }
    });
  }

  renameDeleteActions() {
    const deleteButtons = Array.from(document.querySelectorAll("button"));
    deleteButtons.forEach((button) => {
      const text = (button.textContent || "").trim();
      if (text === "Delete") {
        button.textContent = "Remove from cart";
      }
    });
  }

  normalizeCartItemTitles() {
    document
      .querySelectorAll("commerce_cart-managed-contents article")
      .forEach((article) => {
        // Capture the format/variant suffix (e.g. "Color Print + Digital") from
        // the product name before stripping it. Pattern: "{name} - {format}".
        const nameLink = article.querySelector(".item-name a");
        if (!nameLink) return;
        const text = (nameLink.textContent || "").trim();
        const match = /^(.+?)\s+-\s+(.+)$/.exec(text);
        if (match) {
          if (!article.dataset.abcFormat) {
            article.dataset.abcFormat = match[2]; // e.g. "Color Print + Digital"
          }
          // Strip suffix from every text node in the name area
          article.querySelectorAll(".item-name a, .item-name p").forEach((el) => {
            const t = (el.textContent || "").trim();
            if (t.includes(" - ")) {
              el.textContent = t.replace(/\s+-\s+.+$/, "");
            }
          });
        }
      });
  }

  normalizeCartItemPrices() {
    // Bold the per-item unit price and prepend "Unit Price:" label
    document
      .querySelectorAll("commerce_cart-managed-contents .unitPrice")
      .forEach((el) => {
        el.style.setProperty("font-weight", "700", "important");
        el.style.setProperty("color", "#1e2a3a", "important");
        // Transform visible span: "$41.00/item" → "Unit Price: $41.00"
        const visibleSpan = el.querySelector("span:not(.slds-assistive-text)");
        if (visibleSpan && !visibleSpan.dataset.abcNormalized) {
          const raw = visibleSpan.textContent.trim();
          const price = raw.replace(/\/item$/, "").trim();
          visibleSpan.textContent = "Unit Price: " + price;
          visibleSpan.style.setProperty("display", "block", "important");
          visibleSpan.dataset.abcNormalized = "1";
        }
      });
  }

  relayoutCartItems() {
    const BULK_THRESHOLD = 25; // volume pricing kicks in at 25+ units
    document
      .querySelectorAll("commerce_cart-managed-contents article")
      .forEach((article) => {
        const container = article.querySelector(".container.image");
        if (!container) return;
        this._applyCartItemGridStyles(container);
        this._ensureCartIncludesEl(container, article);
        const col3Wrap = this._ensureCartCol3Wrap(container);
        this._updateCartCol3Contents(col3Wrap, container, article, BULK_THRESHOLD);
      });
  }

  _applyCartItemGridStyles(container) {
    // 3 rows: row1=name, row2=includes, row3=actions
    container.style.setProperty("grid-template-columns", "160px 1fr 210px", "important");
    container.style.setProperty("grid-template-rows", "auto auto auto", "important");
    container.style.setProperty("grid-template-areas", "none", "important");
    container.style.setProperty("column-gap", "24px", "important");
    container.style.setProperty("row-gap", "8px", "important");
    container.style.setProperty("align-items", "start", "important");

    const imgDiv = container.querySelector(".item-image");
    if (imgDiv) {
      imgDiv.style.setProperty("grid-column", "1", "important");
      imgDiv.style.setProperty("grid-row", "1 / span 3", "important");
    }
    const nameDiv = container.querySelector(".item-name");
    if (nameDiv) {
      nameDiv.style.setProperty("grid-column", "2", "important");
      nameDiv.style.setProperty("grid-row", "1", "important");
      nameDiv.style.setProperty("align-self", "start", "important");
      nameDiv.style.setProperty("width", "100%", "important");
    }
    // Actions are placed in row 3 — includes occupies row 2 (set in _ensureCartIncludesEl)
    const actionsDiv = container.querySelector(".item-actions");
    if (actionsDiv) {
      actionsDiv.style.setProperty("grid-column", "2", "important");
      actionsDiv.style.setProperty("grid-row", "3", "important");
      actionsDiv.style.setProperty("align-self", "start", "important");
    }
    const pricesDiv = container.querySelector(".item-prices");
    if (pricesDiv) {
      pricesDiv.style.setProperty("display", "none", "important");
    }
  }

  _ensureCartIncludesEl(container, article) {
    const format = article.dataset.abcFormat;
    let includesEl = container.querySelector(".abc-cart-includes");
    if (!format) {
      if (includesEl) includesEl.style.setProperty("display", "none", "important");
      return;
    }
    if (!includesEl) {
      includesEl = document.createElement("div");
      includesEl.className = "abc-cart-includes";
      // Insert after .item-name in the DOM so grid ordering stays correct
      const nameDiv = container.querySelector(".item-name");
      nameDiv ? nameDiv.after(includesEl) : container.appendChild(includesEl);
    }
    includesEl.innerHTML = `<span style="font-size:12px;color:#6b7785;font-weight:600;display:block;margin-bottom:2px">Includes:</span><span style="font-size:13px;color:#1e2a3a">${format}</span>`;
    includesEl.style.setProperty("grid-column", "2", "important");
    includesEl.style.setProperty("grid-row", "2", "important");
    includesEl.style.setProperty("align-self", "start", "important");
    includesEl.style.setProperty("display", "block", "important");
  }

  _ensureCartCol3Wrap(container) {
    let col3Wrap = container.querySelector(".abc-cart-col3-wrap");
    if (!col3Wrap) {
      col3Wrap = document.createElement("div");
      col3Wrap.className = "abc-cart-col3-wrap";
      container.appendChild(col3Wrap);
    }
    col3Wrap.style.setProperty("grid-column", "3", "important");
    col3Wrap.style.setProperty("grid-row", "1 / span 3", "important");
    col3Wrap.style.setProperty("display", "flex", "important");
    col3Wrap.style.setProperty("flex-direction", "column", "important");
    col3Wrap.style.setProperty("align-items", "flex-end", "important");
    col3Wrap.style.setProperty("gap", "6px", "important");
    return col3Wrap;
  }

  _updateCartCol3Contents(col3Wrap, container, article, bulkThreshold) {
    const unitPriceDiv = container.querySelector(".item-unit-price");
    if (unitPriceDiv && unitPriceDiv.parentElement !== col3Wrap) {
      col3Wrap.insertBefore(unitPriceDiv, col3Wrap.firstChild);
    }
    if (unitPriceDiv) {
      unitPriceDiv.style.setProperty("text-align", "right", "important");
      unitPriceDiv.style.setProperty("width", "100%", "important");
    }

    const qtyInput = article.querySelector("input.slds-input");
    const currentQty = qtyInput ? Number.parseInt(qtyInput.value, 10) : 0;
    this._updateCartUpsell(col3Wrap, unitPriceDiv, currentQty, bulkThreshold);

    const descP = article.querySelector("p[class*='slds-p-top']");
    const minMatch = descP?.innerText?.trim().match(/between (\d+) and/);
    this._updateCartQtyLabel(col3Wrap, minMatch ? minMatch[1] : null);

    const qtySelector = article.querySelector("commerce-quantity-selector");
    if (qtySelector && qtySelector.parentElement !== col3Wrap) {
      col3Wrap.appendChild(qtySelector);
    }
    qtySelector?.style.setProperty("width", "100%", "important");
  }

  _updateCartUpsell(col3Wrap, unitPriceDiv, currentQty, bulkThreshold) {
    let upsellEl = col3Wrap.querySelector(".abc-cart-upsell");
    if (!upsellEl) {
      upsellEl = document.createElement("div");
      upsellEl.className = "abc-cart-upsell";
      upsellEl.style.setProperty("font-size", "12px", "important");
      upsellEl.style.setProperty("color", "#c25700", "important");
      upsellEl.style.setProperty("font-weight", "600", "important");
      upsellEl.style.setProperty("text-align", "right", "important");
      upsellEl.style.setProperty("line-height", "1.3", "important");
      unitPriceDiv?.nextSibling?.before(upsellEl) ?? col3Wrap.appendChild(upsellEl);
    }
    if (currentQty > 0 && currentQty < bulkThreshold) {
      upsellEl.textContent = `+${bulkThreshold - currentQty} copies for volume discounts`;
      upsellEl.style.setProperty("display", "block", "important");
    } else {
      upsellEl.style.setProperty("display", "none", "important");
    }
  }

  _updateCartQtyLabel(col3Wrap, minQty) {
    let qtyLabelEl = col3Wrap.querySelector(".abc-cart-qty-label");
    if (!qtyLabelEl) {
      qtyLabelEl = document.createElement("div");
      qtyLabelEl.className = "abc-cart-qty-label";
      qtyLabelEl.style.setProperty("font-size", "12px", "important");
      qtyLabelEl.style.setProperty("color", "#6b7785", "important");
      qtyLabelEl.style.setProperty("text-align", "right", "important");
      qtyLabelEl.style.setProperty("margin-top", "4px", "important");
      qtyLabelEl.style.setProperty("width", "100%", "important");
      col3Wrap.appendChild(qtyLabelEl);
    }
    if (minQty) {
      qtyLabelEl.textContent = `Quantity (min ${minQty})`;
    }
  }

  restoreFilledCartMainColumn() {
    const { mainColumn, spacerColumn, summaryColumn } =
      this.getCartLayoutColumns();
    const contentNodes = mainColumn
      ? Array.from(mainColumn.querySelectorAll(".column-content"))
      : [];

    if (mainColumn) {
      mainColumn.style.removeProperty("flex");
      mainColumn.style.removeProperty("max-width");
    }

    if (spacerColumn) {
      spacerColumn.style.removeProperty("display");
    }

    if (summaryColumn) {
      summaryColumn.style.removeProperty("display");
    }

    contentNodes.forEach((content) => {
      content.style.setProperty("display", "block", "important");
      content.style.setProperty("width", "100%", "important");
      content.style.removeProperty("margin-top");
    });
  }

  alignCartSummaryWithFirstItem() {
    const { summaryColumn } = this.getCartLayoutColumns();
    const summaryContent = summaryColumn?.querySelector(".column-content");

    // Align with the product image inside the first cart item, not the article
    // top, so the Order Summary card starts at the same row as the book cover.
    const firstCartImage = document.querySelector(
      "commerce_cart-managed-contents article .item-image img, " +
        "commerce_cart-managed-contents article img"
    );

    if (!summaryContent) {
      return;
    }

    summaryContent.style.removeProperty("margin-top");

    if (!firstCartImage || globalThis.innerWidth < 1024) {
      return;
    }

    const firstImageTop = firstCartImage.getBoundingClientRect().top;
    const summaryTop = summaryContent.getBoundingClientRect().top;
    const offset = Math.round(firstImageTop - summaryTop);

    if (offset > 0) {
      summaryContent.style.setProperty("margin-top", `${offset}px`, "important");
    }
  }

  getCartLayoutColumns() {
    const cartSection = document
      .querySelector('section[data-automation="cartBody"]')
      ?.closest("community_layout-section");

    return {
      mainColumn: cartSection?.querySelector(
        "community_layout-column.col-large-size_7-of-12"
      ),
      spacerColumn: cartSection?.querySelector(
        "community_layout-column.col-large-size_1-of-12"
      ),
      summaryColumn: cartSection?.querySelector(
        "community_layout-column.col-large-size_4-of-12"
      )
    };
  }

  normalizeCartActionArea() {
    const downloadButton = this.findElementByExactText(
      ["button", "a"],
      "Download a Quote"
    );
    const checkoutButton = this.findElementByExactText(
      ["button", "a"],
      "Proceed to Checkout"
    );
    const poLink = this.findElementByExactText(
      ["button", "a"],
      "Need to submit a PO?"
    );

    if (downloadButton) {
      this.applyButtonStyle(downloadButton, {
        background: "#fff",
        color: "#007cba",
        border: "2px solid #007cba"
      });
    }

    if (checkoutButton) {
      this.applyButtonStyle(checkoutButton, {
        background: "#007cba",
        color: "#fff",
        border: "none"
      });
    }

    if (poLink) {
      poLink.style.background = "transparent";
      poLink.style.border = "none";
      poLink.style.color = "#2e609c";
      poLink.style.display = "block";
      poLink.style.fontSize = "15px";
      poLink.style.fontWeight = "400";
      poLink.style.margin = "6px auto 0";
      poLink.style.padding = "4px 0 0";
      poLink.style.textAlign = "center";
      poLink.style.boxShadow = "none";
      poLink.style.width = "100%";
      poLink.style.maxWidth = "100%";
      poLink.style.borderRadius = "0";
    }
  }

  syncCartWishlistActions() {
    const cartItems = Array.from(
      document.querySelectorAll("commerce_cart-managed-contents article")
    );

    cartItems.forEach((article) => {
      const productId = this.resolveCartProductId(article);
      const actionArea = article.querySelector(".item-actions");

      if (!productId || !actionArea) {
        return;
      }

      const button = this.ensureCartWishlistButton(actionArea, productId);
      const isPending = this.cartWishlistPendingProductIds.has(productId);
      const isFavorite = this.cartWishlistStates.get(productId);
      let label = "Move to Wishlist";

      if (isPending) {
        label = "Updating...";
      } else if (isFavorite) {
        label = "Remove from Wishlist";
      }

      button.textContent = label;
      button.disabled = isPending;
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);

      if (!isGuest && isFavorite === undefined && !isPending) {
        this.loadCartWishlistState(productId);
      }
    });
  }

  ensureCartWishlistButton(actionArea, productId) {
    let button = actionArea.querySelector(".abc-cart-wishlist-button");

    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "abc-cart-wishlist-button";
      button.addEventListener("click", (event) => {
        this.handleCartWishlistClick(event);
      });
      actionArea.insertBefore(button, actionArea.firstChild);
    }

    button.dataset.productId = productId;
    return button;
  }

  resolveCartProductId(article) {
    const productLink = article.querySelector(
      '.item-name a[href*="/product/"], a[href*="/product/"]'
    );

    return this.extractProductIdFromHref(
      productLink?.getAttribute("href") || ""
    );
  }

  extractProductIdFromHref(href) {
    const match = CART_PRODUCT_DETAIL_PATTERN.exec(String(href || ""));
    return match?.[1] || "";
  }

  async loadCartWishlistState(productId) {
    if (!productId || this.cartWishlistPendingProductIds.has(productId)) {
      return;
    }

    this.cartWishlistPendingProductIds.add(productId);
    this.syncCartWishlistActions();

    try {
      const result = await getFavoriteState({
        productId,
        webStoreId: DEFAULT_WEBSTORE_ID
      });
      this.cartWishlistStates.set(productId, Boolean(result?.favorite));
    } catch {
      this.cartWishlistStates.set(productId, false);
    } finally {
      this.cartWishlistPendingProductIds.delete(productId);
      this.syncCartWishlistActions();
    }
  }

  async handleCartWishlistClick(event) {
    const productId = event.currentTarget?.dataset?.productId || "";

    if (!productId || this.cartWishlistPendingProductIds.has(productId)) {
      return;
    }

    if (isGuest) {
      const startUrl = `${globalThis.location.pathname}${globalThis.location.search}${globalThis.location.hash}`;
      globalThis.location.assign(
        `${LOGIN_URL}?startURL=${encodeURIComponent(startUrl)}`
      );
      return;
    }

    const previousState = this.cartWishlistStates.get(productId) === true;
    this.cartWishlistPendingProductIds.add(productId);
    this.syncCartWishlistActions();

    try {
      const result = await toggleFavorite({
        productId,
        webStoreId: DEFAULT_WEBSTORE_ID
      });

      if (result?.success === false) {
        this.cartWishlistStates.set(productId, previousState);
        return;
      }

      this.cartWishlistStates.set(productId, Boolean(result?.favorite));
    } catch {
      this.cartWishlistStates.set(productId, previousState);
    } finally {
      this.cartWishlistPendingProductIds.delete(productId);
      this.syncCartWishlistActions();
    }
  }

  applyButtonStyle(element, options) {
    element.style.display = "flex";
    element.style.alignItems = "center";
    element.style.justifyContent = "center";
    element.style.width = "100%";
    element.style.minHeight = "50px";
    element.style.padding = "14px 24px";
    element.style.borderRadius = "9999px";
    element.style.fontSize = "16px";
    element.style.fontWeight = "700";
    element.style.textAlign = "center";
    element.style.textDecoration = "none";
    element.style.boxSizing = "border-box";
    element.style.background = options.background;
    element.style.color = options.color;
    element.style.border = options.border;
  }

  applyEmptyCartPatch() {
    this.normalizeCartHeading();

    const clearCart = document.querySelector('[data-automation="clearCart"]');
    if (clearCart) {
      clearCart.style.display = "none";
    }

    const checkoutButton = this.findElementByExactText(
      ["button", "a"],
      "Checkout"
    );
    if (checkoutButton) {
      checkoutButton.style.display = "none";
    }

    const continueShopping = this.findElementByExactText(
      ["a", "button"],
      "Continue Shopping"
    );
    if (continueShopping) {
      continueShopping.style.display = "none";
    }

    const { mainColumn, spacerColumn, summaryColumn } =
      this.getCartLayoutColumns();

    if (mainColumn) {
      mainColumn.style.flex = "0 0 100%";
      mainColumn.style.maxWidth = "100%";
    }

    if (spacerColumn) {
      spacerColumn.style.display = "none";
    }

    if (summaryColumn) {
      summaryColumn.style.display = "none";
    }
  }

  shouldRecoverFilledCart(cartBody) {
    return Boolean(
      cartBody?.querySelector(":scope > .abc-cart-empty-state") &&
      !cartBody.querySelector("article") &&
      !this.hasFilledCartRecoveryRun()
    );
  }

  recoverFilledCart() {
    try {
      globalThis.sessionStorage?.setItem(
        CART_FILLED_RECOVERY_RELOAD_KEY,
        "true"
      );
    } catch {
      // ignore
    }

    globalThis.location.reload();
  }

  hasFilledCartRecoveryRun() {
    try {
      return (
        globalThis.sessionStorage?.getItem(CART_FILLED_RECOVERY_RELOAD_KEY) ===
        "true"
      );
    } catch {
      return false;
    }
  }

  clearFilledCartRecoveryFlag() {
    try {
      globalThis.sessionStorage?.removeItem(CART_FILLED_RECOVERY_RELOAD_KEY);
    } catch {
      // ignore
    }
  }

  findElementByExactText(selectors, text) {
    for (const selector of selectors) {
      const candidates = Array.from(document.querySelectorAll(selector));
      const match = candidates.find(
        (el) => (el.textContent || "").trim() === text
      );
      if (match) {
        return match;
      }
    }

    return null;
  }

  clearVisibleSearchInputIfAll() {
    try {
      const url = new URL(globalThis.location.href);
      if (!this.isResultsPage(url)) return;

      const kw = this.getResultsKeyword(url);
      if (
        String(kw || "")
          .trim()
          .toLowerCase() !== "all"
      )
        return;

      const input = this.findGlobalSearchInput();
      if (!input) return;

      if (
        String(input.value || "")
          .trim()
          .toLowerCase() === "all"
      ) {
        input.value = "";
        input.setAttribute("value", "");

        // eslint-disable-next-line @lwc/lwc/prefer-custom-event
        input.dispatchEvent(new Event("input", { bubbles: true }));
        // eslint-disable-next-line @lwc/lwc/prefer-custom-event
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    } catch {
      // ignore
    }
  }

  findGlobalSearchInput() {
    const selectors = [
      'input[type="search"]',
      'input[placeholder="Search..."]',
      'input[placeholder="Search"]',
      'input[placeholder*="Search"]',
      'input[name="search"]'
    ];

    for (const selector of selectors) {
      // eslint-disable-next-line @lwc/lwc/no-document-query
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  onUrlChanged() {
    try {
      const url = new URL(globalThis.location.href);

      if (this.isResultsPage(url)) {
        this.ensureResultsAllIfMissing(url);

        const st = this.getStateFromResults(url) || this.defaultState;
        this.selectedValue = st;
        writeStateToStorage(st);

        if (url.search && url.search.length > 1) {
          this.cleanUrlAfterDelay();
        }
      } else {
        const st = this.resolveStandardPageState(url);
        this.selectedValue = st;
        writeStateToStorage(st);

        if (this.isHomePage(url)) {
          this.ensureHomeHash(st);
        }

        if (
          (!this.isHomePage(url) && url.hash) ||
          (url.search && url.search.length > 1)
        ) {
          this.cleanUrlAfterDelay();
        }
      }

      // eslint-disable-next-line @lwc/lwc/no-async-operation
      globalThis.setTimeout(() => {
        this.clearVisibleSearchInputIfAll();
      }, 250);
    } catch {
      // ignore
    }
  }

  isResultsPage(urlObj) {
    return urlObj.pathname.includes("/global-search");
  }

  isHomePage(urlObj) {
    const parts = (urlObj.pathname || "").split("/").filter(Boolean);
    return parts.length <= 1;
  }

  resolveStandardPageState(urlObj) {
    const hashState = this.getStateFromHash(urlObj);

    if (this.isHomePage(urlObj)) {
      return hashState || this.defaultState;
    }

    const storedState = readStateFromStorage();
    return storedState || hashState || this.defaultState;
  }

  getStateFromHash(urlObj) {
    const h = (urlObj.hash || "").replace(/^#/, "").trim();
    if (!h) return "";
    const v = decodeURIComponent(h);
    return this.states.includes(v) ? v : "";
  }

  ensureHomeHash(stateVal) {
    try {
      const url = new URL(globalThis.location.href);
      const desiredHash = `#${encodeURIComponent(stateVal)}`;
      if (url.hash !== desiredHash) {
        globalThis.history.replaceState(
          {},
          "",
          url.pathname + url.search + desiredHash
        );
        this._lastHref = globalThis.location.href;
      }
    } catch {
      // ignore
    }
  }

  getResultsKeyword(urlObj) {
    const p = urlObj.pathname || "";
    if (!p.startsWith(this.resultsBasePath)) return "";
    let rest = p.slice(this.resultsBasePath.length);
    rest = rest.replace(/^\/+/, "");
    const seg = rest.split("/")[0] || "";
    return decodeURIComponent(seg);
  }

  getStateFromResultsPath(urlObj) {
    const kw = String(this.getResultsKeyword(urlObj) || "").trim();
    if (!kw || kw.toLowerCase() === "all") {
      return "";
    }

    return this.states.includes(kw) ? kw : "";
  }

  getStateFromParams(urlObj) {
    try {
      const refinementsRaw = urlObj.searchParams.get(this.refinementsParam);
      if (refinementsRaw) {
        const jsonStr = decodeUrlValue(refinementsRaw);
        const list = JSON.parse(jsonStr);
        const stateEntry = Array.isArray(list)
          ? list.find((r) => r?.nameOrId === this.refinementKey)
          : null;

        if (
          stateEntry &&
          Array.isArray(stateEntry.values) &&
          stateEntry.values.length
        ) {
          return stateEntry.values[0];
        }
      }

      const singleRef = urlObj.searchParams.get(this.refinementParam);
      if (singleRef) {
        const decoded = decodeUrlValue(singleRef);
        const prefix = `${this.refinementKey}:`;
        if (decoded.startsWith(prefix)) {
          return decoded.substring(prefix.length);
        }
      }
    } catch {
      // ignore
    }
    return "";
  }

  getStateFromResults(urlObj) {
    const fromParams = this.getStateFromParams(urlObj);
    if (fromParams && this.states.includes(fromParams)) {
      return fromParams;
    }

    const fromPath = this.getStateFromResultsPath(urlObj);
    if (fromPath) {
      return fromPath;
    }

    const storedState = readStateFromStorage();
    if (storedState) {
      return storedState;
    }

    return "";
  }

  ensureResultsAllIfMissing(urlObj) {
    try {
      const kw = this.getResultsKeyword(urlObj);
      const hasKw = !!kw;

      if (!hasKw) {
        globalThis.history.replaceState(
          {},
          "",
          this.resultsAllPath + urlObj.search
        );
        this._lastHref = globalThis.location.href;
        return;
      }

      if (urlObj.hash) {
        globalThis.history.replaceState(
          {},
          "",
          urlObj.pathname + urlObj.search
        );
        this._lastHref = globalThis.location.href;
      }
    } catch {
      // ignore
    }
  }

  cleanUrlAfterDelay() {
    globalThis.clearTimeout(this._cleanT1);
    globalThis.clearTimeout(this._cleanT2);

    const tryClean = () => {
      try {
        const url = new URL(globalThis.location.href);

        if (this.isResultsPage(url)) {
          const kw = this.getResultsKeyword(url) || "all";
          const desiredPath = `${this.resultsBasePath}/${encodeURIComponent(kw)}`;
          globalThis.history.replaceState({}, "", desiredPath);
          this._lastHref = globalThis.location.href;
          this.clearVisibleSearchInputIfAll();
        } else if (this.isHomePage(url)) {
          const st =
            this.getStateFromHash(url) ||
            this.selectedValue ||
            this.defaultState;
          const desiredHash = `#${encodeURIComponent(st)}`;
          globalThis.history.replaceState({}, "", url.pathname + desiredHash);
          this._lastHref = globalThis.location.href;
        } else {
          globalThis.history.replaceState({}, "", url.pathname);
          this._lastHref = globalThis.location.href;
        }
      } catch {
        // ignore
      }
    };

    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._cleanT1 = globalThis.setTimeout(tryClean, this.cleanDelayFastMs);
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._cleanT2 = globalThis.setTimeout(tryClean, this.cleanDelaySlowMs);
  }

  applyToUrl(stateVal) {
    const current = new URL(globalThis.location.href);
    const params = new URLSearchParams(current.search);

    params.set("page", "1");
    params.set(this.refinementParam, `${this.refinementKey}:${stateVal}`);

    params.delete(this.facetsParam);
    params.delete(`search-facet-section-${this.refinementKey}`);

    if (this.urlMode === "compat") {
      const refinementsList = [
        {
          nameOrId: this.refinementKey,
          type: "DistinctValue",
          attributeType: "Custom",
          values: [stateVal]
        }
      ];
      params.set(
        this.refinementsParam,
        encodeURIComponent(JSON.stringify(refinementsList))
      );
    } else {
      params.delete(this.refinementsParam);
    }

    if (this.isResultsPage(current)) {
      const kw = this.getResultsKeyword(current) || "all";
      const targetPath = `${this.resultsBasePath}/${encodeURIComponent(kw)}`;
      const newUrl =
        targetPath + (params.toString() ? `?${params.toString()}` : "");
      globalThis.location.assign(newUrl);
    } else {
      const targetPath = current.pathname;
      const hash = this.isHomePage(current)
        ? `#${encodeURIComponent(stateVal)}`
        : "";
      const newUrl =
        targetPath + (params.toString() ? `?${params.toString()}` : "") + hash;
      globalThis.location.assign(newUrl);
    }
  }

  toStateAbbreviation(stateName) {
    const value = String(stateName || "").trim();
    if (!value) {
      return "ST";
    }

    return STATE_ABBREVIATIONS[value] || value.slice(0, 2).toUpperCase();
  }
}
