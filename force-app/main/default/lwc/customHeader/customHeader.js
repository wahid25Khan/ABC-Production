import { LightningElement, track } from "lwc";
import isGuestUser from "@salesforce/user/isGuest";
import logoResource from "@salesforce/resourceUrl/ABCLogo";
import getCartItemCount from "@salesforce/apex/CustomHeaderController.getCartItemCount";

// ─────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────
const BASE = "/AmericanBookCompany";
const STORAGE_KEY = "abc_selected_state";
const RESULTS_BASE = `${BASE}/global-search`;
const RESULTS_ALL = `${BASE}/global-search/all`;
const REFINEMENT_KEY = "State__c";
const REFINEMENT_PARAM = "refinement";
const REFINEMENTS_PARAM = "refinements";
const FACETS_PARAM = "facets";

const RESULTS_PATH_RE = /\/global-search(\/|$)/;
const HOME_PATH_RE = /\/AmericanBookCompany\/?$/;

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
    id: "ordering",
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

const ALL_STATES = [
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

const DEFAULT_STATE = "Georgia";

// ─────────────────────────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────────────────────────
export default class CustomHeader extends LightningElement {
  // ── Public read-only data ──
  logoUrl = logoResource;
  isGuest = isGuestUser;
  navLinks = NAV_LINKS;

  // ── URL helpers ──
  loginUrl = `${BASE}/login`;
  accountUrl = `${BASE}/myprofile`;
  ordersUrl = `${BASE}/my-orders`;
  wishlistUrl = `${BASE}/mylists`;
  cartUrl = `${BASE}/cart`;

  // ── Reactive state ──
  @track selectedState = DEFAULT_STATE;
  @track stateMenuOpen = false;
  @track accountMenuOpen = false;
  @track mobileMenuOpen = false;
  @track searchTerm = "";
  @track cartCount = 0;

  // ─────────────────────────────────────────────────────────────
  //  Lifecycle
  // ─────────────────────────────────────────────────────────────
  connectedCallback() {
    // Restore persisted state selection
    const lsAvailable = typeof localStorage !== "undefined";
    if (lsAvailable) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && ALL_STATES.includes(saved)) {
        this.selectedState = saved;
      }
    }

    // Fetch cart count for authenticated users
    if (!isGuestUser) {
      getCartItemCount()
        .then((count) => {
          this.cartCount = count || 0;
        })
        .catch(() => {
          this.cartCount = 0;
        });
    }

    // Global outside-click handler to collapse open dropdowns
    this._closeDropdowns = this._closeDropdowns.bind(this);
    document.addEventListener("click", this._closeDropdowns);
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._closeDropdowns);
  }

  // ─────────────────────────────────────────────────────────────
  //  Getters (template bindings)
  // ─────────────────────────────────────────────────────────────
  get displayState() {
    return (
      STATE_ABBREVIATIONS[this.selectedState] ||
      this.selectedState.slice(0, 2).toUpperCase()
    );
  }

  get stateOptions() {
    return ALL_STATES.map((name) => ({
      name,
      className:
        name === this.selectedState
          ? "abc-state-option abc-state-option--selected"
          : "abc-state-option"
    }));
  }

  get mobileMenuAriaLabel() {
    return this.mobileMenuOpen
      ? "Close navigation menu"
      : "Open navigation menu";
  }

  get mobileDrawerClass() {
    return this.mobileMenuOpen
      ? "abc-mob-drawer abc-mob-drawer--open"
      : "abc-mob-drawer";
  }

  get hamburgerClass() {
    return this.mobileMenuOpen
      ? "abc-hamburger abc-hamburger--open"
      : "abc-hamburger";
  }

  get hasCartItems() {
    return this.cartCount > 0;
  }

  get cartAriaLabel() {
    return this.cartCount > 0 ? `Cart: ${this.cartCount} items` : "Cart";
  }

  // ─────────────────────────────────────────────────────────────
  //  State filter
  // ─────────────────────────────────────────────────────────────
  toggleStateMenu(event) {
    event.stopPropagation();
    this.stateMenuOpen = !this.stateMenuOpen;
    if (this.stateMenuOpen) {
      this.accountMenuOpen = false;
      this.mobileMenuOpen = false;
    }
  }

  handleStateSelect(event) {
    event.stopPropagation();
    const value = event.currentTarget.dataset.value || "";
    if (!value || !ALL_STATES.includes(value)) return;

    this.selectedState = value;
    this.stateMenuOpen = false;

    // Persist selection
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, value);
    }

    // Navigate with the new state applied to the URL (mirrors stateFilterLwc.applyToUrl)
    this._applyStateToUrl(value);
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

    params.set("page", "1");
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

    if (RESULTS_PATH_RE.test(current.pathname)) {
      // On search/results page: re-run results with new state
      const pathParts = current.pathname.split("/global-search/");
      const kw = (pathParts[1] || "all").replaceAll(/^\/|\/$/gu, "") || "all";
      const target = `${RESULTS_BASE}/${encodeURIComponent(kw)}`;
      globalThis.location.assign(
        target + (params.toString() ? `?${params.toString()}` : "")
      );
    } else {
      const isHome = HOME_PATH_RE.test(current.pathname);
      const hash = isHome ? `#${encodeURIComponent(stateVal)}` : "";
      globalThis.location.assign(
        current.pathname +
          (params.toString() ? `?${params.toString()}` : "") +
          hash
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
      this.stateMenuOpen = false;
      this.mobileMenuOpen = false;
    }
  }

  handleLogout() {
    const retUrl = encodeURIComponent(`${BASE}/`);
    globalThis.location.assign(
      `/AmericanBookCompany/secur/logout.jsp?retUrl=${retUrl}`
    );
  }

  closeAll(event) {
    if (event) event.stopPropagation();
    this.stateMenuOpen = false;
    this.accountMenuOpen = false;
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
      this.stateMenuOpen = false;
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
    this.stateMenuOpen = false;
    this.accountMenuOpen = false;
    // Leave mobileMenuOpen alone — it has its own toggle button
  }
}
