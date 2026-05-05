import { LightningElement, wire } from "lwc";
import isGuestUser from "@salesforce/user/isGuest";
import logoResource from "@salesforce/resourceUrl/ABCLogo";
import bars_light from "@salesforce/resourceUrl/bars_light";
import rectangle_xmark_light from "@salesforce/resourceUrl/rectangle_xmark_light";
import location_dot_light from "@salesforce/resourceUrl/location_dot_light";
import user_light from "@salesforce/resourceUrl/user_light";
import cart_shopping_light from "@salesforce/resourceUrl/cart_shopping_light";
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
  STATE_ABBREVIATIONS,
  STATE_STORAGE_KEY,
  DEFAULT_WEBSTORE_ID,
  DEFAULT_STORE_NAME,
  CART_UPDATED_EVENT_NAME
} from "c/utils";

let _latoFontInjected = false;

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

const NAV_LINKS = [
  {
    id: "shop",
    label: "SHOP ALL",
    mobileLabel: "Shop All",
    url: RESULTS_ALL,
    target: "_self",
    rel: ""
  },
  {
    id: "catalog",
    label: "GET CATALOG",
    mobileLabel: "Get Catalog",
    url: `${BASE}/catalog`,
    target: "_self",
    rel: ""
  },
  {
    id: "about",
    label: "ABOUT ABC",
    mobileLabel: "About ABC",
    url: `${BASE}/about-abc`,
    target: "_self",
    rel: ""
  },
  {
    id: "coursewave",
    label: "COURSEWAVE",
    mobileLabel: "CourseWave",
    url: "https://coursewave.com/",
    target: "_blank",
    rel: "noopener noreferrer"
  },
  {
    id: "certification",
    label: "CERTIFICATION",
    mobileLabel: "Certification",
    url: `${BASE}/certification`,
    target: "_self",
    rel: ""
  },
  {
    id: "ordering-docs",
    label: "ORDERING DOCS",
    mobileLabel: "Ordering Docs",
    url: `${BASE}/ordering-docs`,
    target: "_self",
    rel: ""
  },
  {
    id: "blog",
    label: "BLOG",
    mobileLabel: "Blog",
    url: `${BASE}/blog`,
    target: "_self",
    rel: ""
  },
  {
    id: "podcast",
    label: "PODCAST",
    mobileLabel: "Podcast",
    url: `${BASE}/podcast`,
    target: "_self",
    rel: ""
  }
];

const DEFAULT_STATE = "Georgia";

export default class CustomHeader extends LightningElement {
  logoUrl = logoResource;
  isGuest = isGuestUser;
  // navLinks = NAV_LINKS;
  storeName = DEFAULT_STORE_NAME;
  webStoreId = DEFAULT_WEBSTORE_ID;
  barslight = bars_light;
  rectangleXmarkLight = rectangle_xmark_light;
  locationDotLight = location_dot_light;
  userLight = user_light;
  cartShoppingLight = cart_shopping_light;

  loginUrl = `${BASE}/login`;
  createAccountUrl = `${BASE}/create-account`;
  accountUrl = `${BASE}/myprofile`;
  ordersUrl = `${BASE}/my-orders`;
  submitPurchaseOrderUrl = `${BASE}/submit-a-po`;
  wishlistUrl = `${BASE}/mylists`;
  cartUrl = `${BASE}/cart`;

  selectedState = DEFAULT_STATE;
  accountMenuOpen = false;
  mobileMenuOpen = false;
  mobileAccountMenuOpen = false;
  searchTerm = "";
  cartCount = 0;

  _boundCloseDropdowns;
  _boundExternalStateHandler;
  _boundStorageHandler;
  _boundUrlHandler;
  _boundCartRefreshHandler;
  _cleanupTimerId;

  connectedCallback() {
    this.mobileMenuOpen = false;
    this.mobileAccountMenuOpen = false;
    this.syncSelectedStateFromUrl();
    this.scheduleUrlCleanupIfNeeded();

    if (!_latoFontInjected) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap";
      document.head.appendChild(link);
      _latoFontInjected = true;
    }

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

  get navLinks() {
    const wishlistNavLink = {
      id: "wishlist",
      label: "My Wishlist",
      mobileLabel: "My Wishlist",
      url: this.wishlistUrl,
      target: "_self",
      rel: ""
    }

    return this.isGuest ? NAV_LINKS : [
      ...NAV_LINKS, 
      wishlistNavLink
    ];
  }

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

  get mobileAccountDrawerClass() {
    return this.mobileAccountMenuOpen
      ? "abc-mobile-account-drawer abc-mobile-account-drawer--open"
      : "abc-mobile-account-drawer";
  }

  get mobileAccountButtonClass() {
    return this.mobileAccountMenuOpen
      ? "abc-mob-account-btn abc-mob-account-btn--active"
      : "abc-mob-account-btn";
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
    return "abc-hamburger";
  }

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

    if (ALL_STATES.includes(resultsKeyword)) return resultsKeyword;

    const kwLower = resultsKeyword.toLowerCase();
    const fromAbbrev = ALL_STATES.find(
      (s) => (STATE_ABBREVIATIONS[s] || "").toLowerCase() === kwLower
    );
    return fromAbbrev || "";
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

  _applyStateToUrl(stateVal) {
    const current = new URL(globalThis.location.href);
    const params = new URLSearchParams(current.search);

    params.set(PAGE_PARAM, "1");
    params.set(REFINEMENT_PARAM, `${REFINEMENT_KEY}:${stateVal}`);
    params.delete(FACETS_PARAM);
    params.delete(`search-facet-section-${REFINEMENT_KEY}`);

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
      const pathToken = (STATE_ABBREVIATIONS[stateVal] || stateVal).toLowerCase();
      const target = `${RESULTS_BASE}/${encodeURIComponent(pathToken)}`;
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

  toggleAccountMenu(event) {
    event.stopPropagation();
    this.accountMenuOpen = !this.accountMenuOpen;
    if (this.accountMenuOpen) {
      this.mobileMenuOpen = false;
      this.mobileAccountMenuOpen = false;
    }
  }

  closeAccountMenu() {
    this.accountMenuOpen = false;
  }

  toggleMobileMenu(event) {
    event.stopPropagation();
    this.mobileMenuOpen = !this.mobileMenuOpen;
    if (this.mobileMenuOpen) {
      this.accountMenuOpen = false;
      this.mobileAccountMenuOpen = false;
    }
  }

  closeMobileMenu() {
    this.mobileMenuOpen = false;
  }

  toggleMobileAccountMenu(event) {
    event.stopPropagation();
    this.mobileAccountMenuOpen = !this.mobileAccountMenuOpen;
    if (this.mobileAccountMenuOpen) {
      this.mobileMenuOpen = false;
      this.accountMenuOpen = false;
    }
  }

  closeMobileAccountMenu() {
    this.mobileAccountMenuOpen = false;
  }

  handleLogout() {
    const retUrl = encodeURIComponent(`${BASE}/`);
    globalThis.location.assign(
      `/AmericanBookCompany/secur/logout.jsp?retUrl=${retUrl}`
    );
  }

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

    // globalThis.location.assign(
    //   `${RESULTS_BASE}/${encodeURIComponent(term)}`
    // );
  }

  _closeDropdowns(event) {
    if (this.template.host.contains(event.target)) return;
    this.accountMenuOpen = false;
    this.mobileAccountMenuOpen = false;
  }

  get stateAbbreviation() {
    const state = this.selectedState || "Georgia";
    const mapping = {
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
    return mapping[state] || state.slice(0, 2).toUpperCase();
  }
}