import { LightningElement, api, track } from "lwc";

const STORAGE_KEY = "abc_selected_state";
const HEADER_CSS_ID = "abc-header-responsive-css";

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

const HEADER_CSS = `
/* === ALL VIEWPORTS: Nav tabs on top row, State+Search+Cart on second row === */
[data-component-id="columns-47c9"]>.columns-content>.columns>dxp_layout-column:nth-of-type(3)>.column-content{flex-direction:column!important}
[data-component-id="columns-47c9"]>.columns-content>.columns{align-items:stretch!important}
/* Push state dropdown to bottom of its column so it aligns with search row */
[data-component-id="columns-47c9"]>.columns-content>.columns>dxp_layout-column:nth-of-type(2)>.column-content{display:flex!important;flex-direction:column!important;justify-content:flex-end!important;padding-bottom:0!important}
/* Logo stays at top aligned with nav row */
[data-component-id="columns-47c9"] dxp_content_layout-site-logo{margin-top:0!important}
[data-component-id="columns-47c9"] c-state-filter-lwc{margin-top:0!important;padding-top:0!important}
/* Align search+cart row items at bottom */
[data-component-id="columns-3835"]>.columns-content>.columns{align-items:flex-end!important}
[data-component-id="columns-3835"] dxp_layout-column .column-content{justify-content:flex-end!important}
[data-component-id="columns-3835"] dxp_layout-column:first-of-type webruntime-component-container{display:flex!important;flex-direction:column!important;justify-content:flex-end!important}
[data-component-id="columns-3835"] commerce_builder-search-input{margin-bottom:0!important}
[data-component-id="columns-3835"]{padding-bottom:0!important}

/* === CART PAGE === */
commerce_builder-b2b-cart-contents{padding-left:60px!important}
commerce_builder-cart-summary{padding-right:24px!important}
commerce_cart-header h1{font-size:36px!important;font-weight:700!important;font-style:normal!important;margin-bottom:24px!important;line-height:1.4!important;color:#1e2a3a!important}
commerce_cart-header .header-labels{align-items:center!important}
commerce_cart-managed-contents article{padding:20px 0!important;border-bottom:1px solid #d4d8dc!important}
commerce_cart-managed-contents .container.image{grid-template-columns:160px 1fr auto auto!important;column-gap:20px!important}
commerce_cart-managed-contents figure{margin-left:0!important}
commerce_cart-managed-contents figure img{max-width:150px!important;border-radius:0!important;border:1px solid #d4d8dc!important;box-shadow:0 4px 6px -1px rgba(120,120,120,0.15),0 2px 4px -2px rgba(120,120,120,0.15)!important}
commerce_cart-managed-contents .item-name a,commerce_cart-managed-contents .item-name a p{font-size:20px!important;font-weight:700!important;color:#1e2a3a!important;text-decoration:none!important;line-height:1.25!important}
commerce_cart-managed-contents .item-name a:hover,commerce_cart-managed-contents .item-name a:hover p{text-decoration:underline!important}
commerce_cart-managed-contents .product-sku{font-size:13px!important;color:#76716b!important}
commerce_cart-managed-contents .item-unit-price{font-size:16px!important;font-weight:700!important;color:#1e2a3a!important}
commerce_cart-managed-contents .item-prices{font-size:16px!important;font-weight:700!important;color:#1e2a3a!important}
commerce_cart-managed-contents .item-actions button{color:#2e609c!important;font-size:14px!important}
commerce_builder-cart-summary>div{background:#f4f7fa!important;padding:20px!important;border-radius:4px!important}
commerce_builder-cart-summary h2{font-size:24px!important;font-weight:700!important;color:#1e2a3a!important;margin-bottom:12px!important}
commerce_builder-cart-summary dt p{font-size:15px!important}
commerce_builder-cart-summary dd{font-size:15px!important}
commerce_builder-cart-summary button,button.checkout-btn{border-radius:9999px!important;font-size:16px!important;padding:12px 24px!important}
commerce_builder-cart-summary a{font-size:14px!important;color:#2e609c!important}
commerce_cart-managed-contents .item-unit-price .visually-hidden~span,commerce_cart-managed-contents .item-prices .visually-hidden~span{font-size:16px!important;font-weight:700!important}

/* === TABLET (768px – 1024px) === */
@media only screen and (min-width:48em) and (max-width:64em){
[data-component-id="columns-47c9"] .columns{flex-direction:row!important;flex-wrap:nowrap!important}
[data-component-id="columns-47c9"] dxp_layout-column-spacer{display:none!important}
[data-component-id="columns-47c9"]>.columns-content>.columns>dxp_layout-column:first-of-type{flex:0 0 auto!important;width:auto!important;max-width:90px!important;padding:0 6px!important}
[data-component-id="columns-47c9"]>.columns-content>.columns>dxp_layout-column:first-of-type img{max-height:50px!important;width:auto!important}
[data-component-id="columns-47c9"]>.columns-content>.columns>dxp_layout-column:nth-of-type(2){flex:0 0 auto!important;width:auto!important;max-width:155px!important;padding:0 4px!important}
[data-component-id="columns-47c9"] c-state-filter-lwc .wrap{max-width:140px!important}
[data-component-id="columns-47c9"]>.columns-content>.columns>dxp_layout-column:nth-of-type(3){flex:1 1 0%!important;width:auto!important;min-width:0!important;padding:0!important}
[data-component-id="columns-47c9"] nav ul{flex-wrap:nowrap!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch;scrollbar-width:none}
[data-component-id="columns-47c9"] nav ul::-webkit-scrollbar{display:none}
[data-component-id="columns-47c9"] nav ul li a,[data-component-id="columns-47c9"] nav ul li button{font-size:11px!important;padding:6px 8px!important;white-space:nowrap!important}
[data-component-id="columns-3835"] .columns{flex-direction:row!important;flex-wrap:nowrap!important;align-items:center!important}
[data-component-id="columns-3835"] dxp_layout-column-spacer{display:none!important}
[data-component-id="columns-3835"]>.columns-content>.columns>dxp_layout-column:first-of-type{flex:1 1 0%!important;width:auto!important;min-width:0!important}
[data-component-id="columns-3835"]>.columns-content>.columns>dxp_layout-column:last-of-type{flex:0 0 auto!important;width:auto!important;max-width:50px!important}
[data-layout-site-region="header"]{padding:4px 12px!important}
}

/* === MOBILE (< 768px) === */
@media only screen and (max-width:47.9375em){
[data-layout-site-region="header"]{padding:10px 16px 14px!important;background:#fff!important;border-bottom:1px solid #e5e7eb!important}
[data-component-id="columns-47c9"]>.columns-content>.columns{display:grid!important;grid-template-columns:minmax(128px,1fr) minmax(110px,auto) minmax(92px,1fr)!important;align-items:center!important;column-gap:8px!important;row-gap:10px!important}
[data-component-id="columns-47c9"] .columns{flex-direction:row!important;flex-wrap:nowrap!important}
[data-component-id="columns-47c9"] dxp_layout-column-spacer{display:none!important}
[data-component-id="columns-47c9"]>.columns-content>.columns>dxp_layout-column:first-of-type{grid-column:2!important;grid-row:1!important;justify-self:center!important;display:flex!important;justify-content:center!important;align-items:center!important;width:100%!important;max-width:none!important;padding:0!important}
[data-component-id="columns-47c9"]>.columns-content>.columns>dxp_layout-column:first-of-type>.column-content{display:flex!important;justify-content:center!important;align-items:center!important;width:100%!important}
[data-component-id="columns-47c9"]>.columns-content>.columns>dxp_layout-column:first-of-type img{max-height:56px!important;width:auto!important;max-width:96px!important}
[data-component-id="columns-47c9"]>.columns-content>.columns>dxp_layout-column:nth-of-type(2){grid-column:1!important;grid-row:1!important;justify-self:start!important;display:flex!important;align-items:center!important;width:100%!important;max-width:none!important;padding:0!important}
[data-component-id="columns-47c9"]>.columns-content>.columns>dxp_layout-column:nth-of-type(2)>.column-content{display:flex!important;justify-content:flex-start!important;align-items:center!important;gap:10px!important;width:100%!important;padding:0!important}
[data-component-id="columns-47c9"]>.columns-content>.columns>dxp_layout-column:nth-of-type(2)>.column-content:before{content:"";display:block!important;flex:0 0 auto!important;width:24px!important;height:18px!important;border-top:2.5px solid #263143!important;border-bottom:2.5px solid #263143!important;background:linear-gradient(#263143,#263143) center/100% 2.5px no-repeat;border-radius:1px!important}
[data-component-id="columns-47c9"] c-state-filter-lwc .wrap{max-width:84px!important}
[data-component-id="columns-47c9"]>.columns-content>.columns>dxp_layout-column:nth-of-type(3){grid-column:3!important;grid-row:1 / span 2!important;justify-self:end!important;display:flex!important;align-items:center!important;width:100%!important;min-width:0!important;padding:0!important}
[data-component-id="columns-47c9"]>.columns-content>.columns>dxp_layout-column:nth-of-type(3)>.column-content{display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;width:100%!important;gap:12px!important}
[data-component-id="columns-47c9"] nav{display:none!important}
[data-component-id="columns-47c9"] nav ul{flex-wrap:nowrap!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch;scrollbar-width:none;gap:0!important;padding:2px 0!important}
[data-component-id="columns-47c9"] nav ul::-webkit-scrollbar{display:none}
[data-component-id="columns-47c9"] nav ul li a,[data-component-id="columns-47c9"] nav ul li button{font-size:10px!important;padding:3px 5px!important;white-space:nowrap!important}
[data-component-id="columns-3835"]{width:100%!important}
[data-component-id="columns-3835"]>.columns-content>.columns{display:grid!important;grid-template-columns:repeat(3,max-content)!important;grid-auto-flow:column!important;justify-content:end!important;align-items:center!important;column-gap:14px!important;row-gap:10px!important;width:100%!important}
[data-component-id="columns-3835"] .columns{flex-direction:row!important;flex-wrap:nowrap!important;align-items:center!important}
[data-component-id="columns-3835"] dxp_layout-column-spacer{display:none!important}
[data-component-id="columns-3835"]>.columns-content>.columns>dxp_layout-column:first-of-type{grid-column:1 / -1!important;grid-row:2!important;order:3!important;flex:1 1 100%!important;width:100%!important;min-width:0!important;max-width:none!important}
[data-component-id="columns-3835"]>.columns-content>.columns>dxp_layout-column:first-of-type>.column-content{width:100%!important}
[data-component-id="columns-3835"]>.columns-content>.columns>dxp_layout-column:first-of-type commerce_builder-search-input{display:block!important;width:100%!important}
[data-component-id="columns-3835"]>.columns-content>.columns>dxp_layout-column:first-of-type input,
[data-component-id="columns-3835"]>.columns-content>.columns>dxp_layout-column:first-of-type lightning-input::part(input),
[data-component-id="columns-3835"]>.columns-content>.columns>dxp_layout-column:first-of-type [type="search"]{min-height:52px!important;border-radius:999px!important;border:1px solid #d5dbe3!important;background:#fff!important;padding-left:20px!important;padding-right:52px!important;font-size:16px!important;box-shadow:0 1px 0 rgba(15,23,42,0.03)!important}
[data-component-id="columns-3835"]>.columns-content>.columns>dxp_layout-column:nth-of-type(n+2){grid-row:1!important;flex:0 0 auto!important;width:auto!important;max-width:none!important}
[data-component-id="columns-3835"]>.columns-content>.columns>dxp_layout-column:nth-of-type(n+2) .column-content{display:flex!important;align-items:center!important;justify-content:flex-end!important}
[data-component-id="columns-3835"]>.columns-content>.columns>dxp_layout-column:nth-of-type(n+2) a,
[data-component-id="columns-3835"]>.columns-content>.columns>dxp_layout-column:nth-of-type(n+2) button{transform:scale(1.08)!important;transform-origin:center!important}
}
`;

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

  connectedCallback() {
    // eslint-disable-next-line @lwc/lwc/no-document-query
    if (!document.getElementById(HEADER_CSS_ID)) {
      const style = document.createElement("style");
      style.id = HEADER_CSS_ID;
      style.textContent = HEADER_CSS;
      document.head.appendChild(style);
    }

    const url = new URL(window.location.href);

    if (this.isResultsPage(url)) {
      this.ensureResultsAllIfMissing(url);

      const st = this.getStateFromResults(url) || this.defaultState;
      this.selectedValue = st;
      this.safeSetStorage(STORAGE_KEY, st);

      const refreshedUrl = new URL(window.location.href);
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

      const refreshedUrl = new URL(window.location.href);
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

    // eslint-disable-next-line @lwc/lwc/no-async-operation
    window.setTimeout(() => {
      this.clearVisibleSearchInputIfAll();
    }, 250);

    // eslint-disable-next-line @lwc/lwc/no-async-operation
    window.setTimeout(() => {
      this.clearVisibleSearchInputIfAll();
    }, 800);
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._docClickHandler);
    this.stopUrlWatcher();
    this.stopSearchInputWatcher();
    window.clearTimeout(this._cleanT1);
    window.clearTimeout(this._cleanT2);
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
    this._lastHref = window.location.href;
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._watchId = window.setInterval(() => {
      const href = window.location.href;
      if (href !== this._lastHref) {
        this._lastHref = href;
        window.clearTimeout(this._watchDebounce);
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._watchDebounce = window.setTimeout(() => {
          this.onUrlChanged();
        }, this.watchDebounceMs);
      }
    }, this.watchIntervalMs);
  }

  stopUrlWatcher() {
    window.clearInterval(this._watchId);
    window.clearTimeout(this._watchDebounce);
    this._watchId = null;
    this._watchDebounce = null;
  }

  startSearchInputWatcher() {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._searchInputWatchId = window.setInterval(() => {
      try {
        const url = new URL(window.location.href);
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
            window.location.pathname + window.location.search;

          if (currentPathAndSearch !== target) {
            window.location.assign(target);
          }
        }
      } catch {
        // ignore
      }
    }, this.searchInputWatchMs);
  }

  stopSearchInputWatcher() {
    window.clearInterval(this._searchInputWatchId);
    this._searchInputWatchId = null;
  }

  clearVisibleSearchInputIfAll() {
    try {
      const url = new URL(window.location.href);
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

    for (let i = 0; i < selectors.length; i += 1) {
      // eslint-disable-next-line @lwc/lwc/no-document-query
      const el = document.querySelector(selectors[i]);
      if (el) return el;
    }
    return null;
  }

  onUrlChanged() {
    try {
      const url = new URL(window.location.href);

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
      window.setTimeout(() => {
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
      const v = window.localStorage.getItem(STORAGE_KEY) || "";
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
      window.localStorage.setItem(key, val);
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
      const url = new URL(window.location.href);
      const desiredHash = `#${encodeURIComponent(stateVal)}`;
      if (url.hash !== desiredHash) {
        window.history.replaceState(
          {},
          "",
          url.pathname + url.search + desiredHash
        );
        this._lastHref = window.location.href;
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
          ? list.find((r) => r && r.nameOrId === this.refinementKey)
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
        window.history.replaceState(
          {},
          "",
          this.resultsAllPath + urlObj.search
        );
        this._lastHref = window.location.href;
        return;
      }

      if (urlObj.hash) {
        window.history.replaceState({}, "", urlObj.pathname + urlObj.search);
        this._lastHref = window.location.href;
      }
    } catch {
      // ignore
    }
  }

  cleanUrlAfterDelay() {
    window.clearTimeout(this._cleanT1);
    window.clearTimeout(this._cleanT2);

    const tryClean = () => {
      try {
        const url = new URL(window.location.href);

        if (this.isResultsPage(url)) {
          const kw = this.getResultsKeyword(url) || "all";
          const desiredPath = `${this.resultsBasePath}/${encodeURIComponent(kw)}`;
          window.history.replaceState({}, "", desiredPath);
          this._lastHref = window.location.href;
          this.clearVisibleSearchInputIfAll();
        } else if (this.isHomePage(url)) {
          const st =
            this.getStateFromHash(url) ||
            this.selectedValue ||
            this.defaultState;
          const desiredHash = `#${encodeURIComponent(st)}`;
          window.history.replaceState({}, "", url.pathname + desiredHash);
          this._lastHref = window.location.href;
        } else {
          window.history.replaceState({}, "", url.pathname);
          this._lastHref = window.location.href;
        }
      } catch {
        // ignore
      }
    };

    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._cleanT1 = window.setTimeout(tryClean, this.cleanDelayFastMs);
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._cleanT2 = window.setTimeout(tryClean, this.cleanDelaySlowMs);
  }

  applyToUrl(stateVal) {
    const current = new URL(window.location.href);
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
      window.location.assign(newUrl);
    } else {
      const targetPath = current.pathname;
      const hash = this.isHomePage(current)
        ? `#${encodeURIComponent(stateVal)}`
        : "";
      const newUrl =
        targetPath + (params.toString() ? `?${params.toString()}` : "") + hash;
      window.location.assign(newUrl);
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
