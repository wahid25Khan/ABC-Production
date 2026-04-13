import { LightningElement, wire } from "lwc";
import isGuestUser from "@salesforce/user/isGuest";
import logoResource from "@salesforce/resourceUrl/ABCLogo";
import {
  CartSummaryAdapter,
  refreshCartSummary
} from "commerce/cartApi";
import {
  decodeUrlValue,
  dispatchStateChange,
  readStateFromStorage,
  writeStateToStorage,
  ALL_STATES,
  STATE_STORAGE_KEY,
  DEFAULT_WEBSTORE_ID,
  DEFAULT_STORE_NAME,
  CART_UPDATED_EVENT_NAME
} from "c/utils";

// Module-level flag: ensures Lato <link> is injected only once per page lifetime
// (avoids document.querySelector which is forbidden by @lwc/lwc/no-document-query)
let _latoFontInjected = false;

// ─────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────
const BASE = "/AmericanBookCompany";
const RESULTS_BASE = `${BASE}/global-search`;
const RESULTS_ALL = `${BASE}/global-search/all`;
const REFINEMENT_KEY = "State__c";
const REFINEMENT_PARAM = "refinement";
const REFINEMENTS_PARAM = "refinements";
const FACETS_PARAM = "facets";
const PAGE_PARAM = "page";
const CLEAN_URL_DELAY_MS = 250;

const RESULTS_PATH_RE = /\/global-search(\/|$)/;
const HOME_PATH_RE = /\/AmericanBookCompany\/?$/;

// 8 nav links matching standard navigation menu
const NAV_LINKS = [
  { id: "shop", label: "SHOP ALL", url: RESULTS_ALL, target: "_self", rel: "" },
  {
    id: "catalog",
    label: "GET CATALOG",
    url: `${BASE}/catalog`,
    target: "_self",
    rel: ""
  },
  {
    id: "about",
    label: "ABOUT ABC",
    url: `${BASE}/about-abc`,
    target: "_self",
    rel: ""
  },
  {
    id: "coursewave",
    label: "COURSEWAVE",
    url: "https://coursewave.com/",
    target: "_blank",
    rel: "noopener noreferrer"
  },
  {
    id: "certification",
    label: "CERTIFICATION",
    url: `${BASE}/certification`,
    target: "_self",
    rel: ""
  },
  {
    id: "ordering-docs",
    label: "ORDERING DOCS",
    url: `${BASE}/ordering-docs`,
    target: "_self",
    rel: ""
  },
  { id: "blog", label: "BLOG", url: `${BASE}/blog`, target: "_self", rel: "" },
  {
    id: "podcast",
    label: "PODCAST",
    url: `${BASE}/podcast`,
    target: "_self",
    rel: ""
  }
];

const DEFAULT_STATE = "Georgia";

// ─────────────────────────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────────────────────────
export default class CustomHeader extends LightningElement {
  // ── Public read-only data ──
  logoUrl = logoResource;
  isGuest = isGuestUser;
  navLinks = NAV_LINKS;
  storeName = DEFAULT_STORE_NAME;
  webStoreId = DEFAULT_WEBSTORE_ID;

  // ── URL helpers ──
  loginUrl = `${BASE}/login`;
  createAccountUrl = `${BASE}/create-account`;
  accountUrl = `${BASE}/myprofile`;
  ordersUrl = `${BASE}/my-orders`;
  submitPurchaseOrderUrl = `${BASE}/submit-a-po`;
  wishlistUrl = `${BASE}/mylists`;
  cartUrl = `${BASE}/cart`;

  // ── Reactive state ──
  selectedState = DEFAULT_STATE;
  accountMenuOpen = false;
  mobileMenuOpen = false;
  searchTerm = "";
  cartCount = 0;

  _boundCloseDropdowns;
  _boundExternalStateHandler;
  _boundStorageHandler;
  _boundUrlHandler;
  _boundCartRefreshHandler;
  _cleanupTimerId;

  // ─────────────────────────────────────────────────────────────
  //  Lifecycle
  // ─────────────────────────────────────────────────────────────
  connectedCallback() {
    this.syncSelectedStateFromUrl();
    this.scheduleUrlCleanupIfNeeded();

    // Inject Lato font once per page (LWC CSS cannot use @import url()
    // and @lwc/lwc/no-document-query forbids document.querySelector)
    if (!_latoFontInjected) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap";
      document.head.appendChild(link);
      _latoFontInjected = true;
    }

    // Global outside-click handler to collapse open dropdowns
    this._boundCloseDropdowns = this._closeDropdowns.bind(this);
    this._boundExternalStateHandler = (event) =>
      this.handleExternalStateChange(event);
    this._boundStorageHandler = (event) => this.handleStorageChange(event);
    this._boundUrlHandler = () => this.syncSelectedStateFromUrl();
    this._boundCartRefreshHandler = () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      this.refreshCartCount();
    };
    document.addEventListener("click", this._boundCloseDropdowns);
    document.addEventListener("visibilitychange", this._boundCartRefreshHandler);
    globalThis.addEventListener(
      "abcstatechange",
      this._boundExternalStateHandler
    );
    globalThis.addEventListener("statechange", this._boundExternalStateHandler);
    globalThis.addEventListener("storage", this._boundStorageHandler);
    globalThis.addEventListener("hashchange", this._boundUrlHandler);
    globalThis.addEventListener("popstate", this._boundUrlHandler);
    globalThis.addEventListener("focus", this._boundCartRefreshHandler);
    globalThis.addEventListener("pageshow", this._boundCartRefreshHandler);
    globalThis.addEventListener(
      CART_UPDATED_EVENT_NAME,
      this._boundCartRefreshHandler
    );
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._boundCloseDropdowns);
    document.removeEventListener(
      "visibilitychange",
      this._boundCartRefreshHandler
    );
    globalThis.removeEventListener(
      "abcstatechange",
      this._boundExternalStateHandler
    );
    globalThis.removeEventListener("statechange", this._boundExternalStateHandler);
    globalThis.removeEventListener("storage", this._boundStorageHandler);
    globalThis.removeEventListener("hashchange", this._boundUrlHandler);
    globalThis.removeEventListener("popstate", this._boundUrlHandler);
    globalThis.removeEventListener("focus", this._boundCartRefreshHandler);
    globalThis.removeEventListener("pageshow", this._boundCartRefreshHandler);
    globalThis.removeEventListener(
      CART_UPDATED_EVENT_NAME,
      this._boundCartRefreshHandler
    );
    globalThis.clearTimeout(this._cleanupTimerId);
  }

  // ─────────────────────────────────────────────────────────────
  //  Getters (template bindings)
  // ─────────────────────────────────────────────────────────────
  get stateOptions() {
    return ALL_STATES.map((name) => ({
      name,
      selected: name === this.selectedState
    }));
  }

  get showCartBadge() {
    return this.cartCount > 0;
  }

  get cartAriaLabel() {
    if (this.cartCount <= 0) {
      return "Cart";
    }

    const itemLabel = this.cartCount === 1 ? "item" : "items";
    return `Cart: ${this.cartCount} ${itemLabel}`;
  }

  get mobileMenuAriaLabel() {
    return this.mobileMenuOpen
      ? "Close navigation menu"
      : "Open navigation menu";
  }

  get mobileDrawerClass() {
    return this.mobileMenuOpen
      ? "abc-mobile-drawer abc-mobile-drawer--open"
      : "abc-mobile-drawer";
  }

  @wire(CartSummaryAdapter)
  wiredCartSummary({ data }) {
    this.cartCount = this.extractCartCount(data);
  }

  async refreshCartCount() {
    try {
      await refreshCartSummary();
    } catch {
      this.cartCount = 0;
    }
  }

  extractCartCount(cartData) {
    const explicitCount = [
      cartData?.totalProductCount,
      cartData?.cartSummary?.totalProductCount,
      cartData?.summary?.totalProductCount,
      cartData?.totalItemCount,
      cartData?.cartSummary?.totalItemCount,
      cartData?.summary?.totalItemCount
    ]
      .map((value) => this.normalizeCartCount(value))
      .find((value) => value !== null);

    if (explicitCount !== undefined) {
      return explicitCount ?? 0;
    }

    const cartItems =
      cartData?.cartItems || cartData?.items || cartData?.cartSummary?.cartItems;
    if (Array.isArray(cartItems)) {
      return cartItems.reduce((total, item) => {
        const quantity = this.normalizeCartCount(
          item?.quantity ?? item?.totalQuantity ?? item?.Quantity ?? 1
        );
        return total + (quantity ?? 0);
      }, 0);
    }

    return 0;
  }

  normalizeCartCount(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  get hamburgerClass() {
    return this.mobileMenuOpen
      ? "abc-hamburger abc-hamburger--open"
      : "abc-hamburger";
  }

  // ─────────────────────────────────────────────────────────────
  //  State filter — native <select> onchange handler
  // ─────────────────────────────────────────────────────────────
  handleStateChange(event) {
    const value = event.target.value;
    if (!value || !ALL_STATES.includes(value)) return;

    this.selectedState = value;
    writeStateToStorage(value);
    dispatchStateChange(value);
    this._applyStateToUrl(value);
  }

  handleExternalStateChange(event) {
    const stateValue = String(
      event?.detail?.state || event?.detail?.selectedState || ""
    ).trim();
    if (!ALL_STATES.includes(stateValue) || stateValue === this.selectedState) {
      return;
    }

    this.selectedState = stateValue;
  }

  handleStorageChange(event) {
    if (event?.key !== STATE_STORAGE_KEY) {
      return;
    }

    this.syncSelectedStateFromUrl();
  }

  syncSelectedStateFromUrl() {
    const currentUrl = new URL(globalThis.location.href);
    this.selectedState = this.resolveSelectedState(currentUrl);
  }

  resolveSelectedState(urlObj) {
    if (this.isResultsPage(urlObj)) {
      return this.getStateFromResults(urlObj) || DEFAULT_STATE;
    }

    const hashState = this.getStateFromHash(urlObj);
    if (this.isHomePage(urlObj)) {
      return hashState || DEFAULT_STATE;
    }

    return this.getStoredState() || hashState || DEFAULT_STATE;
  }

  isResultsPage(urlObj) {
    return RESULTS_PATH_RE.test(urlObj?.pathname || "");
  }

  isHomePage(urlObj) {
    return HOME_PATH_RE.test(urlObj?.pathname || "");
  }

  getStoredState() {
    const storedState = readStateFromStorage();
    return ALL_STATES.includes(storedState) ? storedState : "";
  }

  getStateFromHash(urlObj) {
    const hashValue = (urlObj?.hash || "").replace(/^#/, "").trim();
    if (!hashValue) {
      return "";
    }

    const decodedHash = decodeUrlValue(hashValue);
    return ALL_STATES.includes(decodedHash) ? decodedHash : "";
  }

  getResultsKeyword(urlObj) {
    const pathName = urlObj?.pathname || "";
    if (!pathName.startsWith(RESULTS_BASE)) {
      return "";
    }

    const afterBase = pathName.slice(RESULTS_BASE.length).replace(/^\/+/, "");
    const segment = afterBase.split("/")[0] || "";
    return decodeUrlValue(segment);
  }

  getStateFromResultsPath(urlObj) {
    const resultsKeyword = String(this.getResultsKeyword(urlObj) || "").trim();
    if (!resultsKeyword || resultsKeyword.toLowerCase() === "all") {
      return "";
    }

    return ALL_STATES.includes(resultsKeyword) ? resultsKeyword : "";
  }

  getStateFromRefinementsList(refinementsRaw) {
    const refinementList = JSON.parse(decodeUrlValue(refinementsRaw));
    const stateEntry = Array.isArray(refinementList)
      ? refinementList.find((entry) => entry?.nameOrId === REFINEMENT_KEY)
      : null;

    if (
      stateEntry &&
      Array.isArray(stateEntry.values) &&
      stateEntry.values.length
    ) {
      const selectedState = String(stateEntry.values[0] || "").trim();
      return ALL_STATES.includes(selectedState) ? selectedState : "";
    }
    return "";
  }

  getStateFromParams(urlObj) {
    try {
      const refinementsRaw = urlObj.searchParams.get(REFINEMENTS_PARAM);
      if (refinementsRaw) {
        const result = this.getStateFromRefinementsList(refinementsRaw);
        if (result) return result;
      }

      const singleRefinement = urlObj.searchParams.get(REFINEMENT_PARAM);
      if (singleRefinement) {
        const decodedRefinement = decodeUrlValue(singleRefinement);
        const prefix = `${REFINEMENT_KEY}:`;
        if (decodedRefinement.startsWith(prefix)) {
          const stateValue = decodedRefinement.slice(prefix.length).trim();
          return ALL_STATES.includes(stateValue) ? stateValue : "";
        }
      }
    } catch {
      return "";
    }

    return "";
  }

  getStateFromResults(urlObj) {
    return (
      this.getStateFromParams(urlObj) ||
      this.getStateFromResultsPath(urlObj) ||
      this.getStoredState()
    );
  }

  scheduleUrlCleanupIfNeeded() {
    globalThis.clearTimeout(this._cleanupTimerId);

    const currentUrl = new URL(globalThis.location.href);
    if (this.isResultsPage(currentUrl)) {
      return;
    }

    const searchParams = new URLSearchParams(currentUrl.search);
    const originalSearch = searchParams.toString();

    searchParams.delete(PAGE_PARAM);
    searchParams.delete(REFINEMENT_PARAM);
    searchParams.delete(REFINEMENTS_PARAM);
    searchParams.delete(FACETS_PARAM);
    searchParams.delete(`search-facet-section-${REFINEMENT_KEY}`);

    const cleanedSearch = searchParams.toString();
    const needsSearchCleanup = originalSearch !== cleanedSearch;
    const desiredHash = this.isHomePage(currentUrl)
      ? `#${encodeURIComponent(this.selectedState || DEFAULT_STATE)}`
      : currentUrl.hash;
    const needsHashCleanup =
      this.isHomePage(currentUrl) && currentUrl.hash !== desiredHash;

    if (!needsSearchCleanup && !needsHashCleanup) {
      return;
    }

    this._cleanupTimerId = globalThis.setTimeout(() => {
      const nextUrl =
        currentUrl.pathname +
        (cleanedSearch ? `?${cleanedSearch}` : "") +
        desiredHash;
      globalThis.history.replaceState({}, "", nextUrl);
    }, CLEAN_URL_DELAY_MS);
  }

  /**
   * Mirrors stateFilterLwc.applyToUrl():
   *  • On the search/results page → refreshes results with the new state refinement
   *  • On the home page           → updates the URL hash to #StateName
   *  • On all other pages         → stays on current path, updates URL params
   */
  _applyStateToUrl(stateVal) {
    const current = new URL(globalThis.location.href);
    const params = new URLSearchParams(current.search);

    params.set(PAGE_PARAM, "1");
    params.set(REFINEMENT_PARAM, `${REFINEMENT_KEY}:${stateVal}`);
    params.delete(FACETS_PARAM);
    params.delete(`search-facet-section-${REFINEMENT_KEY}`);

    // Compat-mode refinements JSON (matches stateFilterLwc urlMode='compat')
    const refinementsList = [
      {
        nameOrId: REFINEMENT_KEY,
        type: "DistinctValue",
        attributeType: "Custom",
        values: [stateVal]
      }
    ];
    params.set(
      REFINEMENTS_PARAM,
      encodeURIComponent(JSON.stringify(refinementsList))
    );

    if (this.isResultsPage(current)) {
      // On search/results page: re-run results with new state
      const kw = this.getResultsKeyword(current) || "all";
      const target = `${RESULTS_BASE}/${encodeURIComponent(kw)}`;
      globalThis.location.assign(
        target + (params.toString() ? `?${params.toString()}` : "")
      );
    } else {
      if (this.isHomePage(current)) {
        globalThis.location.hash = encodeURIComponent(stateVal);
        return;
      }

      globalThis.location.assign(
        current.pathname + (params.toString() ? `?${params.toString()}` : "")
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Account menu
  // ─────────────────────────────────────────────────────────────
  toggleAccountMenu(event) {
    event.stopPropagation();
    this.accountMenuOpen = !this.accountMenuOpen;
    if (this.accountMenuOpen) {
      this.mobileMenuOpen = false;
    }
  }

  closeAccountMenu() {
    this.accountMenuOpen = false;
  }

  handleLogout() {
    const retUrl = encodeURIComponent(`${BASE}/`);
    globalThis.location.assign(
      `/AmericanBookCompany/secur/logout.jsp?retUrl=${retUrl}`
    );
  }

  // ─────────────────────────────────────────────────────────────
  //  Search
  // ─────────────────────────────────────────────────────────────
  handleSearchInput(event) {
    this.searchTerm = event.target.value;
  }

  handleSearchKeyDown(event) {
    if (event.key !== "Enter") return;
    const term = (this.searchTerm || "").trim();
    if (!term) return;
    event.preventDefault();
    globalThis.location.assign(
      `${RESULTS_ALL}?term=${encodeURIComponent(term)}`
    );
  }

  // ─────────────────────────────────────────────────────────────
  //  Mobile menu
  // ─────────────────────────────────────────────────────────────
  toggleMobileMenu(event) {
    event.stopPropagation();
    this.mobileMenuOpen = !this.mobileMenuOpen;
    if (this.mobileMenuOpen) {
      this.accountMenuOpen = false;
    }
  }

  closeMobileMenu() {
    this.mobileMenuOpen = false;
  }

  // ─────────────────────────────────────────────────────────────
  //  Outside-click collapse handler
  // ─────────────────────────────────────────────────────────────
  _closeDropdowns(event) {
    // If the click origin is inside this component's DOM, skip
    if (this.template.host.contains(event.target)) return;
    this.accountMenuOpen = false;
    // Leave mobileMenuOpen alone — it has its own toggle button
  }
}