import { LightningElement, track } from "lwc";
import isGuestUser from "@salesforce/user/isGuest";
import logoResource from "@salesforce/resourceUrl/ABCLogo";
import getCartItemCount from "@salesforce/apex/CustomHeaderController.getCartItemCount";

// Module-level flag: ensures Lato <link> is injected only once per page lifetime
// (avoids document.querySelector which is forbidden by @lwc/lwc/no-document-query)
let _latoFontInjected = false;

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

// 7 nav links matching live site (no CERTIFICATION, no ORDERING DOCS)
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
    this._closeDropdowns = this._closeDropdowns.bind(this);
    document.addEventListener("click", this._closeDropdowns);
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._closeDropdowns);
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
    return this.cartCount > 0 ? `Cart: ${this.cartCount} items` : "Cart";
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
