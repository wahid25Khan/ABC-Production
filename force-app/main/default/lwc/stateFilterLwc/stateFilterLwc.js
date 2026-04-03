import { LightningElement, api, track } from "lwc";
import isGuest from "@salesforce/user/isGuest";

const STORAGE_KEY = "abc_selected_state";
const CHECKOUT_STAGE_KEY = "abc_checkout_stage";
const LOGIN_URL = "/AmericanBookCompany/login";
const GUEST_LOGIN_GUARD_PATHS = new Set([
  "/AmericanBookCompany/mylists",
  "/AmericanBookCompany/my-orders"
]);

const STATE_ABBREVIATIONS = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  "District of Columbia": "DC",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY"
};

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

  @track selectedValue = "";
  @track isOpen = false;

  states = [
    "Alabama",
    "Alaska",
    "Arizona",
    "Arkansas",
    "California",
    "Colorado",
    "Connecticut",
    "Delaware",
    "District of Columbia",
    "Florida",
    "Georgia",
    "Hawaii",
    "Idaho",
    "Illinois",
    "Indiana",
    "Iowa",
    "Kansas",
    "Kentucky",
    "Louisiana",
    "Maine",
    "Maryland",
    "Massachusetts",
    "Michigan",
    "Minnesota",
    "Mississippi",
    "Missouri",
    "Montana",
    "Nebraska",
    "Nevada",
    "New Hampshire",
    "New Jersey",
    "New Mexico",
    "New York",
    "North Carolina",
    "North Dakota",
    "Ohio",
    "Oklahoma",
    "Oregon",
    "Pennsylvania",
    "Rhode Island",
    "South Carolina",
    "South Dakota",
    "Tennessee",
    "Texas",
    "Utah",
    "Vermont",
    "Virginia",
    "Washington",
    "West Virginia",
    "Wisconsin",
    "Wyoming"
  ];

  _docClickHandler;
  _watchId;
  _watchDebounce;
  _lastHref;
  _cleanT1;
  _cleanT2;
  _searchInputWatchId;
  _cartPatchId;

  connectedCallback() {
    if (this.redirectGuestAccountPageToLogin()) {
      return;
    }

    const url = new URL(globalThis.location.href);

    if (this.isResultsPage(url)) {
      this.ensureResultsAllIfMissing(url);

      const st = this.getStateFromResults(url) || this.defaultState;
      this.selectedValue = st;
      this.safeSetStorage(STORAGE_KEY, st);

      const refreshedUrl = new URL(globalThis.location.href);
      if (refreshedUrl.search && refreshedUrl.search.length > 1) {
        this.cleanUrlAfterDelay();
      }
    } else {
      const st = this.resolveStandardPageState(url);
      this.selectedValue = st;
      this.safeSetStorage(STORAGE_KEY, st);

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

  get displayValue() {
    return this.selectedValue || "Select State";
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
    this.safeSetStorage(STORAGE_KEY, val);
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

      const cartBody = document.querySelector('section[data-automation="cartBody"]');
      const emptyHeading = this.findElementByExactText(
        ["h1", "h2", "p", "div", "span"],
        "Your cart is empty"
      );

      if (cartBody && emptyHeading) {
        document.body.dataset.abcCartEmpty = "true";
        this.applyEmptyCartPatch(cartBody);
        return;
      }

      delete document.body.dataset.abcCartEmpty;
      this.restoreFilledCartMainColumn();
      this.normalizeFilledCartHeading();
      this.hideCartChromeForFilledState();
      this.renameDeleteActions();
      this.normalizeCartItemTitles();
      this.normalizeCartActionArea();
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
      const guestButton = this.findElementByExactText(["button"], "Continue as Guest");
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
    const cartHeadingCandidates = Array.from(document.querySelectorAll("h1, p"));

    cartHeadingCandidates.forEach((el) => {
      const text = (el.textContent || "").trim();
      if (text === "Cart") {
        el.textContent = "Your Cart";
      }
    });
  }

  normalizeCartSummaryHeading() {
    const summaryHeading = this.findElementByExactText(["h1", "h2", "p", "div", "span"], "Summary");
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
      this.findElementByExactText(["button"], "Quantity Help")
    ];

    elementsToHide.forEach((el) => {
      if (el) {
        el.style.display = "none";
      }
    });

    const pagination = document.querySelector("commerce_cart-managed-contents nav");
    if (pagination) {
      pagination.style.display = "none";
    }

    const sortControl = document.querySelector("commerce_cart-header lightning-combobox");
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

    const couponLink = this.findElementByExactText(["a", "button"], "Enter a Coupon Code");
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
    const itemLinks = Array.from(document.querySelectorAll("commerce_cart-managed-contents a, commerce_cart-managed-contents p"));
    itemLinks.forEach((el) => {
      const text = (el.textContent || "").trim();
      if (text.endsWith(" - Color Print + Digital")) {
        el.textContent = text.replace(/\s+-\s+Color Print \+ Digital$/, "");
      }
    });
  }

  restoreFilledCartMainColumn() {
    const mainColumn = document.querySelector(
      'community_layout-column.col-large-size_7-of-12'
    );
    const content = mainColumn?.querySelector(':scope > div.column-content');

    if (content) {
      content.style.setProperty("display", "block", "important");
      content.style.setProperty("width", "100%", "important");
    }
  }

  normalizeCartActionArea() {
    const downloadButton = this.findElementByExactText(["button", "a"], "Download a Quote");
    const checkoutButton = this.findElementByExactText(["button", "a"], "Proceed to Checkout");
    const poLink = this.findElementByExactText(["button", "a"], "Need to submit a PO?");

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

  applyEmptyCartPatch(cartBody) {
    this.normalizeCartHeading();

    if (!cartBody.querySelector(".abc-cart-empty-state")) {
      cartBody.innerHTML = [
        '<div class="abc-cart-empty-state">',
        '<p class="abc-cart-empty-message">No items in cart</p>',
        '<img class="abc-cart-empty-image" src="https://americanbookcompany.com/images/need-to-download-a-quote-wide.svg" alt="Need to download a quote? Add items to your cart to begin.">',
        "</div>"
      ].join("");
    }

    const clearCart = document.querySelector('[data-automation="clearCart"]');
    if (clearCart) {
      clearCart.style.display = "none";
    }

    const checkoutButton = this.findElementByExactText(["button", "a"], "Checkout");
    if (checkoutButton) {
      checkoutButton.style.display = "none";
    }

    const continueShopping = this.findElementByExactText(["a", "button"], "Continue Shopping");
    if (continueShopping) {
      continueShopping.style.display = "none";
    }

    const mainColumn = document.querySelector(
      'community_layout-section[data-component-id="section-5592"] community_layout-column.col-large-size_7-of-12'
    );
    if (mainColumn) {
      mainColumn.style.flex = "0 0 100%";
      mainColumn.style.maxWidth = "100%";
    }

    const spacerColumn = document.querySelector(
      'community_layout-section[data-component-id="section-5592"] community_layout-column.col-large-size_1-of-12'
    );
    if (spacerColumn) {
      spacerColumn.style.display = "none";
    }

    const summaryColumn = document.querySelector(
      'community_layout-section[data-component-id="section-5592"] community_layout-column.col-large-size_4-of-12'
    );
    if (summaryColumn) {
      summaryColumn.style.display = "none";
    }
  }

  findElementByExactText(selectors, text) {
    for (const selector of selectors) {
      const candidates = Array.from(document.querySelectorAll(selector));
      const match = candidates.find((el) => (el.textContent || "").trim() === text);
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
        this.safeSetStorage(STORAGE_KEY, st);

        if (url.search && url.search.length > 1) {
          this.cleanUrlAfterDelay();
        }
      } else {
        const st = this.resolveStandardPageState(url);
        this.selectedValue = st;
        this.safeSetStorage(STORAGE_KEY, st);

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

  getStoredState() {
    try {
      const v = globalThis.localStorage.getItem(STORAGE_KEY) || "";
      return this.states.includes(v) ? v : "";
    } catch {
      return "";
    }
  }

  resolveStandardPageState(urlObj) {
    const hashState = this.getStateFromHash(urlObj);

    if (this.isHomePage(urlObj)) {
      return hashState || this.defaultState;
    }

    const storedState = this.getStoredState();
    return storedState || hashState || this.defaultState;
  }

  safeSetStorage(key, val) {
    try {
      globalThis.localStorage.setItem(key, val);
    } catch {
      // ignore
    }
  }

  decodeDeep(str) {
    if (!str) return "";
    let out = str;
    for (let i = 0; i < 3; i += 1) {
      try {
        const dec = decodeURIComponent(out);
        if (dec === out) break;
        out = dec;
      } catch {
        break;
      }
    }
    return out;
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
        const jsonStr = this.decodeDeep(refinementsRaw);
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
        const decoded = this.decodeDeep(singleRef);
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

    const storedState = this.getStoredState();
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
        globalThis.history.replaceState({}, "", urlObj.pathname + urlObj.search);
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