import { LightningElement, api, track } from "lwc";
import getVariationPricing from "@salesforce/apex/ProductVariationController.getVariationPricing";

const DEFAULT_STORE_NAME = "AmericanBookCompany";
const DEFAULT_WEBSTORE_ID = "0ZEam000004dJDNGA2";
const DEFAULT_STATE_STORAGE_KEY = "abc_selected_state";
const DEFAULT_PAGE_SIZE = 20;
const SEARCH_MARKER = "/global-search/";
const URL_WATCH_INTERVAL_MS = 250;
const URL_WATCH_DEBOUNCE_MS = 120;
const CART_REQUEST_PARAMS = Object.freeze({
  language: "en-US",
  asGuest: "true",
  htmlEncode: "false"
});

const SEARCH_FIELDS = ["StockKeepingUnit"];

const PRODUCT_DETAIL_FIELDS = [
  "StockKeepingUnit",
  "Grade_Level__c",
  "Category__c",
  "Series__c",
  "State__c",
  "purchaseQuantityRule"
];

const PRODUCT_DETAIL_BATCH_SIZE = 20;
const PRICING_BATCH_SIZE = 200;

const GRADE_FILTER_VALUES = [
  "Kindergarten",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12"
];

const CATEGORY_FILTER_VALUES = [
  "English",
  "Math",
  "Reading",
  "Social Studies",
  "Science",
  "Writing"
];

const SERIES_FILTER_VALUES = [
  "ACAP Success",
  "ACT",
  "ACT Achievement",
  "Adult Basic Curriculum",
  "Basics Made Easy",
  "CCGPS",
  "CCRA Success",
  "Common Core",
  "EXPLORE",
  "Foundations",
  "GSE Success",
  "Gearing Up",
  "ILeap/Leap",
  "K-PREP",
  "K-PREP/QualityCore",
  "KSA Success",
  "LEAP 2025",
  "LEAP Success",
  "Milestones",
  "OCCT/EOI",
  "OSTP Success",
  "PARCC",
  "PLAN",
  "SCPASS",
  "Smarter Balanced",
  "TAS Success",
  "TCAP Success",
  "EOC",
  "MCA",
  "EOG",
  "EOCEP",
  "Get READY",
  "New Mexico Success",
  "K-12 Standards Success",
  "ATLAS Success",
  "EOC Success",
  "SCCCRS Success",
  "SOL"
];

const US_STATES = [
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

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseMultiValueString(value) {
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function chunkArray(values, chunkSize) {
  const normalizedSize = Number.parseInt(chunkSize, 10);
  const size =
    Number.isFinite(normalizedSize) && normalizedSize > 0
      ? normalizedSize
      : values.length || 1;
  const chunks = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

export default class CustomResults extends LightningElement {
  @api storeName = DEFAULT_STORE_NAME;
  @api webStoreId = DEFAULT_WEBSTORE_ID;
  @api defaultSearchTerm = "";
  @api stateStorageKey = DEFAULT_STATE_STORAGE_KEY;

  @api stateFieldApiName = "State__c";
  @api filterFieldApiNames = "Grade_Level__c,Category__c,Series__c";
  @api filterFieldLabels = "Grade Level,Subject";
  @api searchFieldApiNames = SEARCH_FIELDS.join(",");

  @api pageSizeOptions = "20,40,60";
  @api defaultPageSize = DEFAULT_PAGE_SIZE;
  @api fetchPageSize = 120;
  @api maxFetchPages = 8;
  @api cartStateOrId = "current";

  @track loading = false;
  @track products = [];
  @track visibleProducts = [];
  @track filterGroups = [];
  @track stateOptions = [];

  @track selectedState = "";
  @track searchText = "";
  @track sortValue = "relevance";
  @track pageSizeValue = DEFAULT_PAGE_SIZE;
  @track currentPage = 1;
  @track totalResults = 0;
  @track totalPages = 1;
  @track showingStart = 0;
  @track showingEnd = 0;
  @track viewMode = "grid";

  @track isModalOpen = false;
  isAddingToCart = false;
  @track modalProduct = null;
  @track modalVariationPricing = null;

  @track isStateDropdownOpen = false;
  @track isSortDropdownOpen = false;
  @track isPageSizeDropdownOpen = false;
  @track isMobileFiltersOpen = false;

  stateProducts = [];
  selectedFiltersByField = {};
  collapsedByField = {};
  filterDefinitions = [];
  filterValueCatalog = {};
  productById = new Map();
  filterIndexByField = {};
  productDetailIdParamName = null;
  currentPathSearchToken = "";
  lastObservedHref = "";
  urlWatchId = null;
  urlWatchDebounceId = null;
  docClickHandler = null;

  connectedCallback() {
    this.captureCurrentRouteState();
    this.initialize();
    this.startUrlWatcher();

    this.docClickHandler = (event) => {
      if (!this.template.contains(event.target)) {
        this.closeAllDropdowns();
      }
    };
    document.addEventListener("click", this.docClickHandler);
  }

  disconnectedCallback() {
    this.stopUrlWatcher();
    if (this.docClickHandler) {
      document.removeEventListener("click", this.docClickHandler);
      this.docClickHandler = null;
    }
    if (globalThis.document?.body) {
      globalThis.document.body.style.overflow = "";
    }
  }

  get hasResults() {
    return this.totalResults > 0;
  }

  get showEmptyState() {
    return !this.loading && !this.hasResults;
  }

  get disablePrev() {
    return this.currentPage <= 1;
  }

  get disableNext() {
    return this.currentPage >= this.totalPages;
  }

  get showPagination() {
    return this.totalPages > 1;
  }

  get resultsSummary() {
    if (!this.totalResults) {
      return "Showing 0 results";
    }
    return `Showing ${this.showingStart} to ${this.showingEnd} of ${this.totalResults} — Page ${this.currentPage} of ${this.totalPages}`;
  }

  get productsClass() {
    return this.viewMode === "list"
      ? "products products-list"
      : "products products-grid";
  }

  get isGridView() {
    return this.viewMode === "grid";
  }

  get isListView() {
    return this.viewMode === "list";
  }

  get ariaGridPressed() {
    return this.isGridView;
  }

  get ariaListPressed() {
    return this.isListView;
  }

  get sortOptions() {
    return [
      { label: "Most Relevant", value: "relevance" },
      { label: "A - Z", value: "name-asc" },
      { label: "Z - A", value: "name-desc" }
    ];
  }

  get pageSizeOptionsList() {
    return this.getPageSizeValues().map((value) => ({
      label: `View ${value} per page`,
      value: String(value)
    }));
  }

  get pageSizeValueString() {
    return String(this.pageSizeValue);
  }

  get modalTitle() {
    return this.modalProduct ? this.modalProduct.name : "";
  }

  get modalIsbn() {
    if (!this.modalProduct) return "";
    return this.firstString([
      this.modalProduct.sku,
      this.modalProduct.isbn,
      this.resolveByPath(this.modalProduct, "fields.StockKeepingUnit")
    ]);
  }

  get modalImageUrl() {
    return this.modalProduct ? this.modalProduct.imageUrl : "";
  }

  get modalCurrencyIsoCode() {
    return this.modalProduct
      ? this.modalProduct.currencyIsoCode || "USD"
      : "USD";
  }

  get modalMinimumQuantity() {
    const rule = this.modalProduct?.purchaseQuantityRule;
    const ruleMin = rule?.minimum ?? rule?.Minimum ?? null;
    if (Number.isFinite(ruleMin) && ruleMin > 0) return ruleMin;
    return 10;
  }

  get modalMaximumQuantity() {
    const rule = this.modalProduct?.purchaseQuantityRule;
    const ruleMax = rule?.maximum ?? rule?.Maximum ?? null;
    if (Number.isFinite(ruleMax) && ruleMax > 0 && ruleMax <= 9999)
      return ruleMax;
    return 50;
  }

  get modalIncrementQuantity() {
    const rule = this.modalProduct?.purchaseQuantityRule;
    const ruleInc = rule?.increment ?? rule?.Increment ?? null;
    if (Number.isFinite(ruleInc) && ruleInc > 0) return ruleInc;
    return 1;
  }

  get selectedStateLabel() {
    return this.selectedState || "All States";
  }

  get selectedPageSizeLabel() {
    return `View ${this.pageSizeValue} per page`;
  }

  get stateDisplayClass() {
    return this.selectedState ? "" : "placeholder";
  }

  get stateChevronClass() {
    return this.isStateDropdownOpen
      ? "custom-select-chevron open"
      : "custom-select-chevron";
  }

  get sortChevronClass() {
    return this.isSortDropdownOpen
      ? "custom-select-chevron open"
      : "custom-select-chevron";
  }

  get pageSizeChevronClass() {
    return this.isPageSizeDropdownOpen
      ? "custom-select-chevron open"
      : "custom-select-chevron";
  }

  get allStatesOptionClass() {
    return this.selectedState
      ? "custom-select-option"
      : "custom-select-option selected";
  }

  get filtersColumnClass() {
    return this.isMobileFiltersOpen
      ? "filters-column mobile-open"
      : "filters-column";
  }

  get mobileFilterPanelClass() {
    return "mobile-filter-panel";
  }

  get stateOptionsForUi() {
    return US_STATES.map((value) => ({
      label: value,
      value,
      className:
        value === this.selectedState
          ? "custom-select-option selected"
          : "custom-select-option"
    }));
  }

  get sortOptionsForUi() {
    return this.sortOptions.map((item) => ({
      ...item,
      className:
        item.value === this.sortValue
          ? "custom-select-option selected"
          : "custom-select-option"
    }));
  }

  get pageSizeOptionsForUi() {
    return this.pageSizeOptionsList.map((item) => ({
      ...item,
      className:
        item.value === String(this.pageSizeValue)
          ? "custom-select-option selected"
          : "custom-select-option"
    }));
  }

  async initialize() {
    this.loading = true;
    try {
      this.filterDefinitions = this.buildFilterDefinitions();
      this.pageSizeValue = this.resolveInitialPageSize();
      this.stateOptions = [
        { label: "All States", value: "" },
        ...US_STATES.map((value) => ({ label: value, value }))
      ];
      this.selectedState = this.readStateFromStorage();

      const initialResponse = await this.loadStateProducts();
      this.stateProducts = initialResponse.products;
      this.rebuildProductIndexes();
      this.filterValueCatalog = this.buildStaticFilterCatalog(
        initialResponse.facets
      );
      this.rebuildFilterGroups();
      this.applyLocalFiltersAndPagination();
    } catch {
      this.resetResults();
    } finally {
      this.loading = false;
    }
  }

  buildFilterDefinitions() {
    const keys = parseCsv(this.filterFieldApiNames);
    const labels = parseCsv(this.filterFieldLabels);

    return keys.map((key, index) => ({
      key,
      label: labels[index] || this.humanizeApiName(key)
    }));
  }

  buildStaticFilterCatalog(facets) {
    const catalog = {};
    this.filterDefinitions.forEach((definition) => {
      const values = this.getHardcodedFilterValues(definition.key);
      const countsByValue = this.getFacetCountMap(facets, definition.key);

      catalog[definition.key] = values.map((value) => ({
        value,
        count: countsByValue.get(value) || 0
      }));
    });
    return catalog;
  }

  getHardcodedFilterValues(fieldApiName) {
    const normalized = this.normalizeFieldName(fieldApiName);
    if (normalized === this.normalizeFieldName("Grade_Level__c"))
      return GRADE_FILTER_VALUES;
    if (normalized === this.normalizeFieldName("Category__c"))
      return CATEGORY_FILTER_VALUES;
    if (normalized === this.normalizeFieldName("Series__c"))
      return SERIES_FILTER_VALUES;
    return [];
  }

  getFacetCountMap(facets, fieldApiName) {
    const facetList = toArray(facets);
    const fieldKey = this.normalizeFieldName(fieldApiName);
    const counts = new Map();

    facetList.forEach((facet) => {
      const facetKey = this.normalizeFieldName(facet?.nameOrId || "");
      if (facetKey !== fieldKey) return;

      toArray(facet?.values).forEach((entry) => {
        const value = this.firstString([entry?.displayName, entry?.nameOrId]);
        const count = Number.parseInt(entry?.productCount, 10);
        if (!value) return;
        counts.set(value, Number.isFinite(count) && count > 0 ? count : 0);
      });
    });

    return counts;
  }

  async fetchAllProducts(criteria) {
    const pageSize = this.normalizePositiveInt(this.fetchPageSize, 120, 200);
    const maxPages = this.normalizePositiveInt(this.maxFetchPages, 8, 20);

    const allProducts = [];
    const seenIds = new Set();
    let facets = [];

    for (let page = 0; page < maxPages; page += 1) {
      // eslint-disable-next-line no-await-in-loop
      const data = await this.fetchSearchResponse(criteria, page, pageSize);
      const pageProducts = this.extractProductList(data);

      if (page === 0) facets = this.extractFacetList(data);
      if (!pageProducts.length) break;

      pageProducts.forEach((row) => {
        const id = String(row?.id || "").trim();
        if (!id || seenIds.has(id)) return;
        seenIds.add(id);
        allProducts.push(row);
      });

      const total = Number.parseInt(data?.productsPage?.total, 10);
      if (Number.isFinite(total) && allProducts.length >= total) break;
      if (pageProducts.length < pageSize) break;
    }

    return { products: allProducts, facets };
  }

  async loadStateProducts() {
    const response = await this.fetchAllProducts(
      this.buildStateSearchCriteria()
    );
    const productIds = toArray(response.products)
      .map((item) => String(item?.id || "").trim())
      .filter(Boolean);

    const [hydratedProducts, pricingMap] = await Promise.all([
      this.hydrateProductsWithFields(response.products),
      this.fetchPricingForProducts(productIds)
    ]);

    const baseProducts = hydratedProducts
      .map((item) => this.normalizeProduct(item))
      .filter(Boolean);
    const products = this.applyPricingMapToProducts(baseProducts, pricingMap);

    return {
      facets: response.facets,
      products
    };
  }

  async fetchSearchResponse(criteria, page, pageSize) {
    try {
      const response = await fetch(
        this.buildSearchEndpoint(criteria, page, pageSize),
        {
          method: "GET",
          credentials: "include"
        }
      );

      if (!response.ok) return {};
      return await response.json();
    } catch {
      return {};
    }
  }

  async enrichProductsWithPricing(products) {
    const productIds = products.map((item) => item.id).filter(Boolean);
    if (!productIds.length) return products;

    const pricingMap = await this.fetchPricingForProducts(productIds);
    return this.applyPricingMapToProducts(products, pricingMap);
  }

  applyPricingMapToProducts(products, pricingMap) {
    if (!pricingMap?.size) return products;

    return products.map((product) => {
      const priceInfo = pricingMap.get(product.id);
      if (!priceInfo) return product;

      const basePrice =
        priceInfo.unitPrice ??
        priceInfo.salesPrice ??
        priceInfo.negotiatedPrice ??
        priceInfo.listPrice ??
        product.listPrice ??
        product.startingPrice;

      return {
        ...product,
        currencyIsoCode:
          priceInfo.currencyIsoCode || product.currencyIsoCode || "USD",
        listPrice:
          priceInfo.listPrice ?? product.listPrice ?? basePrice ?? null,
        startingPrice: basePrice ?? product.startingPrice ?? null
      };
    });
  }

  async fetchPricingForProducts(productIds) {
    const batches = chunkArray(productIds, PRICING_BATCH_SIZE);

    const merged = new Map();
    const batchMaps = await Promise.all(
      batches.map(async (batch) => {
        try {
          const response = await fetch(this.buildPricingEndpoint(batch), {
            method: "GET",
            credentials: "include"
          });

          if (!response.ok) return new Map();
          const data = await response.json();
          return this.extractPricingMap(data);
        } catch {
          return new Map();
        }
      })
    );

    batchMaps.forEach((batchMap) => {
      batchMap.forEach((value, key) => merged.set(key, value));
    });

    return merged;
  }

  buildPricingEndpoint(productIds) {
    const base = `/${this.storeName || DEFAULT_STORE_NAME}/webruntime/api/services/data/v66.0/commerce/webstores/${this.webStoreId || DEFAULT_WEBSTORE_ID}/pricing/products`;
    const params = new URLSearchParams({ productIds: productIds.join(",") });
    return `${base}?${params.toString()}`;
  }

  async hydrateProductsWithFields(products) {
    const ids = toArray(products)
      .map((item) => String(item?.id || "").trim())
      .filter(Boolean);

    if (!ids.length) return toArray(products);

    const hydratedMap = await this.fetchProductFieldMap(ids);
    if (!hydratedMap.size) return toArray(products);

    return toArray(products).map((item) => {
      const hydrated = hydratedMap.get(String(item?.id || "").trim());
      if (!hydrated) return item;

      const merged = {
        ...item,
        ...hydrated,
        fields:
          hydrated.fields && Object.keys(hydrated.fields).length
            ? hydrated.fields
            : item.fields
      };

      /* Preserve search-API image when product-detail overrides with empty */
      if (!merged.defaultImage?.url && item.defaultImage?.url) {
        merged.defaultImage = item.defaultImage;
      }
      if (!merged.imageUrl && item.imageUrl) {
        merged.imageUrl = item.imageUrl;
      }
      if (!merged.mediaGroups?.length && item.mediaGroups?.length) {
        merged.mediaGroups = item.mediaGroups;
      }

      return merged;
    });
  }

  async fetchProductFieldMap(productIds) {
    const ids = [
      ...new Set(
        toArray(productIds)
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      )
    ];
    if (!ids.length) return new Map();

    const batches = chunkArray(ids, PRODUCT_DETAIL_BATCH_SIZE);

    const merged = new Map();
    const batchMaps = await Promise.all(
      batches.map((batch) => this.fetchProductFieldBatch(batch))
    );

    batchMaps.forEach((batchMap) => {
      batchMap.forEach((value, key) => merged.set(key, value));
    });

    return merged;
  }

  async fetchProductFieldBatch(productIds) {
    const idParamNames = this.productDetailIdParamName
      ? [this.productDetailIdParamName]
      : ["ids", "productIds"];

    for (const idParamName of idParamNames) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(
          this.buildProductsEndpoint(productIds, idParamName),
          {
            method: "GET",
            credentials: "include"
          }
        );

        if (!response.ok) continue;

        // eslint-disable-next-line no-await-in-loop
        const data = await response.json();
        const rows = this.extractProductCollection(data);
        const map = new Map();

        rows.forEach((item) => {
          const id = String(item?.id || "").trim();
          if (id) map.set(id, item);
        });

        if (map.size) {
          this.productDetailIdParamName = idParamName;
          return map;
        }
      } catch {
        // ignore
      }
    }

    return new Map();
  }

  buildProductsEndpoint(productIds, idParamName) {
    const base = `/${this.storeName || DEFAULT_STORE_NAME}/webruntime/api/services/data/v66.0/commerce/webstores/${this.webStoreId || DEFAULT_WEBSTORE_ID}/products`;
    const params = new URLSearchParams({
      [idParamName]: productIds.join(",")
    });

    params.set("fields", PRODUCT_DETAIL_FIELDS.join(","));
    return `${base}?${params.toString()}`;
  }

  buildSearchEndpoint(criteria, page, pageSize) {
    const base = `/${this.storeName || DEFAULT_STORE_NAME}/webruntime/api/services/data/v66.0/commerce/webstores/${this.webStoreId || DEFAULT_WEBSTORE_ID}/search/products`;

    const params = new URLSearchParams({
      language: "en-US",
      asGuest: "true",
      searchTerm: criteria.searchTerm,
      page: String(page),
      pageSize: String(pageSize)
    });

    this.applyRefinementsToParams(params, criteria.refinements);

    const fieldList = this.getSearchFields();
    if (fieldList.length) params.set("fields", fieldList.join(","));

    return `${base}?${params.toString()}`;
  }

  buildStateSearchCriteria() {
    return {
      searchTerm: this.composeRemoteStateSearchTerm(),
      refinements: this.buildStateRefinements()
    };
  }

  getSearchFields() {
    const configured = parseCsv(this.searchFieldApiNames);
    return configured.length ? configured : SEARCH_FIELDS;
  }

  composeRemoteStateSearchTerm() {
    const terms = [];

    const configuredTerm = String(this.defaultSearchTerm || "").trim();
    if (configuredTerm && configuredTerm.toLowerCase() !== "all") {
      terms.push(configuredTerm);
    }

    if (this.selectedState) {
      terms.push(this.selectedState);
    }

    const deduped = [];
    const seen = new Set();

    terms.forEach((term) => {
      const normalized = String(term || "").trim();
      if (!normalized) return;

      const key = normalized.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(normalized);
      }
    });

    if (deduped.length) return deduped.join(" ");
    const fallback = String(this.defaultSearchTerm || "").trim();
    return fallback || "all";
  }

  getPathSearchToken() {
    if (!globalThis.window?.location?.pathname) return "";

    const path = globalThis.window.location.pathname;
    const markerIndex = path.indexOf(SEARCH_MARKER);
    if (markerIndex < 0) return "";

    const after = path.slice(markerIndex + SEARCH_MARKER.length);
    const token = (after.split("/")[0] || "").trim();
    if (!token || token.toLowerCase() === "all") return "";

    return this.decodeSearchPathSegment(token);
  }

  decodeSearchPathSegment(value) {
    let decoded = String(value || "")
      .replaceAll("+", " ")
      .trim();
    if (!decoded) return "";

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const nextValue = decodeURIComponent(decoded);
        if (nextValue === decoded) break;
        decoded = nextValue.replaceAll("+", " ").trim();
      } catch {
        break;
      }
    }

    return decoded;
  }

  captureCurrentRouteState() {
    this.currentPathSearchToken = this.getPathSearchToken();
    this.lastObservedHref = this.getCurrentHref();
  }

  getCombinedSearchTokens() {
    const tokens = [];
    const routeSearchText =
      this.currentPathSearchToken || this.getPathSearchToken();

    if (routeSearchText)
      tokens.push(...this.tokenizeSearchText(routeSearchText));
    if (this.searchText)
      tokens.push(...this.tokenizeSearchText(this.searchText));

    return [...new Set(tokens)];
  }

  getCurrentHref() {
    return globalThis.window?.location?.href ?? "";
  }

  startUrlWatcher() {
    if (globalThis.window === undefined || this.urlWatchId) return;

    this.captureCurrentRouteState();
    this.urlWatchId = globalThis.window.setInterval(() => {
      const href = this.getCurrentHref();
      if (!href || href === this.lastObservedHref) return;

      this.lastObservedHref = href;
      globalThis.window.clearTimeout(this.urlWatchDebounceId);
      this.urlWatchDebounceId = globalThis.window.setTimeout(() => {
        this.handleObservedUrlChange();
      }, URL_WATCH_DEBOUNCE_MS);
    }, URL_WATCH_INTERVAL_MS);
  }

  stopUrlWatcher() {
    if (globalThis.window === undefined) return;

    globalThis.window.clearInterval(this.urlWatchId);
    globalThis.window.clearTimeout(this.urlWatchDebounceId);
    this.urlWatchId = null;
    this.urlWatchDebounceId = null;
  }

  async handleObservedUrlChange() {
    const nextPathSearchToken = this.getPathSearchToken();
    if (nextPathSearchToken === this.currentPathSearchToken) return;

    this.currentPathSearchToken = nextPathSearchToken;
    this.currentPage = 1;
    this.applyLocalFiltersAndPagination();
  }

  buildStateRefinements() {
    const result = {};
    if (this.selectedState)
      result[this.stateFieldApiName] = [this.selectedState];
    return result;
  }

  applyRefinementsToParams(params, refinementMap) {
    Object.entries(refinementMap || {}).forEach(([field, values]) => {
      const uniqueValues = [
        ...new Set(
          toArray(values)
            .map((item) => String(item).trim())
            .filter(Boolean)
        )
      ];
      if (!field || !uniqueValues.length) return;

      uniqueValues.forEach((value) => {
        params.append("refinement", `${field}:${value}`);
      });
    });
  }

  extractProductList(data) {
    const list =
      data?.productsPage?.products ||
      data?.productPage?.products ||
      data?.productSearchResult?.products ||
      data?.searchProductResult?.products ||
      data?.products;

    return toArray(list);
  }

  extractFacetList(data) {
    return toArray(data?.facets);
  }

  extractProductCollection(data) {
    const list =
      data?.products ||
      data?.productCollection?.products ||
      data?.productPage?.products ||
      data?.productsPage?.products;

    return toArray(list);
  }

  normalizeProduct(item) {
    const id = String(item?.id || "").trim();
    if (!id) return null;

    const name = String(item?.name || "").trim() || "Untitled";
    const imageUrl = this.resolveProductImageUrl(item);
    const sku = this.resolveStockKeepingUnit(item);
    const currencyIsoCode = this.resolveCurrencyIsoCode(item);

    const listPrice = this.resolvePrice(item, [
      "prices.listPrice",
      "prices.pricebookPrice",
      "fields.Price__c",
      "price"
    ]);
    const salesPrice = this.resolvePrice(item, [
      "prices.salesPrice",
      "prices.unitPrice",
      "prices.unitAdjustedPrice",
      "price"
    ]);
    const negotiatedPrice = this.resolvePrice(item, [
      "prices.negotiatedPrice",
      "prices.unitPrice",
      "prices.salesPrice"
    ]);
    const startingPrice = negotiatedPrice ?? salesPrice ?? listPrice ?? null;
    const filterValues = this.buildProductFilterValues(item);
    const searchTerms = this.buildProductSearchTerms(item, {
      sku,
      filterValues
    });

    return {
      ...item,
      id,
      name,
      sku,
      isbn: sku,
      urlName: String(item?.urlName || item?.slug || "").trim(),
      imageUrl,
      currencyIsoCode,
      listPrice,
      startingPrice,
      filterValues,
      searchTerms
    };
  }

  buildProductFilterValues(item) {
    return {
      Grade_Level__c: this.resolveProductTextValues(item, [
        "fields.Grade_Level__c"
      ]),
      Category__c: this.resolveProductTextValues(item, ["fields.Category__c"]),
      Series__c: this.resolveProductTextValues(item, ["fields.Series__c"])
    };
  }

  resolveProductTextValues(item, paths) {
    const values = [];
    paths.forEach((path) =>
      this.collectResolvedText(this.resolveByPath(item, path), values)
    );
    return [...new Set(values)];
  }

  collectResolvedText(value, values) {
    if (value === null || value === undefined || value === "") return;

    if (Array.isArray(value)) {
      value.forEach((entry) => this.collectResolvedText(entry, values));
      return;
    }

    if (typeof value === "object") {
      if (typeof value.displayValue === "string" && value.displayValue.trim()) {
        values.push(value.displayValue.trim().toLowerCase());
        return;
      }

      if (typeof value.value === "string" && value.value.trim()) {
        values.push(value.value.trim().toLowerCase());
        return;
      }

      Object.values(value).forEach((entry) =>
        this.collectResolvedText(entry, values)
      );
      return;
    }

    parseMultiValueString(value).forEach((entry) => {
      values.push(entry.toLowerCase());
    });
  }

  resolveCurrencyIsoCode(item) {
    const resolved = this.firstString([
      this.resolveByPath(item, "prices.currencyIsoCode"),
      this.resolveByPath(item, "fields.CurrencyIsoCode"),
      item?.currencyIsoCode
    ]);

    return resolved || "USD";
  }

  resolveStockKeepingUnit(item) {
    return this.firstString([
      item?.sku,
      item?.stockKeepingUnit,
      this.resolveByPath(item, "fields.StockKeepingUnit")
    ]);
  }

  buildProductSearchTerms(item, context = {}) {
    const parts = [];
    const filterValues = context?.filterValues || {};
    const categoryValues = toArray(filterValues.Category__c);

    this.collectSearchText(item?.name, parts);
    this.collectSearchText(context?.sku, parts);
    this.collectSearchText(item?.urlName, parts);
    this.collectSearchText(this.resolveByPath(item, "fields.Name"), parts);
    this.collectSearchText(this.resolveByPath(item, "fields.State__c"), parts);
    this.collectSearchText(filterValues.Grade_Level__c, parts);
    this.collectSearchText(categoryValues, parts);
    this.collectSearchText(filterValues.Series__c, parts);

    categoryValues.forEach((value) => {
      if (value === "math") {
        parts.push("mathematics");
      } else if (value === "english") {
        parts.push("english language arts", "ela");
      }
    });

    return this.tokenizeSearchText(parts.join(" "));
  }

  collectSearchText(value, parts) {
    if (value === null || value === undefined || value === "") return;

    if (Array.isArray(value)) {
      value.forEach((entry) => this.collectSearchText(entry, parts));
      return;
    }

    if (typeof value === "object") {
      if (typeof value.displayValue === "string" && value.displayValue.trim()) {
        parts.push(value.displayValue.trim());
        return;
      }

      if (typeof value.value === "string" && value.value.trim()) {
        parts.push(value.value.trim());
        return;
      }

      Object.values(value).forEach((entry) =>
        this.collectSearchText(entry, parts)
      );
      return;
    }

    parseMultiValueString(value).forEach((entry) => {
      parts.push(entry);
    });
  }

  normalizeSearchText(value) {
    return String(value || "")
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, " ")
      .trim();
  }

  tokenizeSearchText(value) {
    const normalized = this.normalizeSearchText(value);
    return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
  }

  rebuildFilterGroups() {
    this.filterGroups = this.filterDefinitions.map((definition) => {
      const selected = new Set(
        this.selectedFiltersByField[definition.key] || []
      );
      const options = (this.filterValueCatalog[definition.key] || []).map(
        (entry) => ({
          key: `${definition.key}-${entry.value}`,
          value: entry.value,
          label: entry.value,
          count: entry.count,
          checked: selected.has(entry.value),
          pillClass: selected.has(entry.value)
            ? "filter-option-row filter-option-checked"
            : "filter-option-row"
        })
      );

      const isExpanded = !this.collapsedByField[definition.key];
      return {
        key: definition.key,
        label: definition.label,
        collapsed: Boolean(this.collapsedByField[definition.key]),
        expanded: isExpanded,
        toggleSymbol: this.collapsedByField[definition.key] ? "+" : "−",
        options,
        showEmpty: !options.length
      };
    });
  }

  rebuildProductIndexes() {
    this.productById = new Map();
    this.filterIndexByField = {};

    this.filterDefinitions.forEach((definition) => {
      this.filterIndexByField[definition.key] = new Map();
    });

    this.stateProducts.forEach((product) => {
      const productId = String(product?.id || "").trim();
      if (!productId) return;

      this.productById.set(productId, product);

      this.filterDefinitions.forEach((definition) => {
        const fieldMap = this.filterIndexByField[definition.key];
        const values = toArray(product?.filterValues?.[definition.key])
          .map((value) =>
            String(value || "")
              .trim()
              .toLowerCase()
          )
          .filter(Boolean);

        values.forEach((value) => {
          const existing = fieldMap.get(value) || new Set();
          existing.add(productId);
          fieldMap.set(value, existing);
        });
      });
    });
  }

  applyLocalFiltersAndPagination() {
    this.products = this.filterStateProducts();
    this.applyPaginationAndSort();
  }

  filterStateProducts() {
    const searchTokens = this.getCombinedSearchTokens();
    let candidateIds = null;

    this.filterDefinitions.forEach((definition) => {
      const selectedValues = (this.selectedFiltersByField[definition.key] || [])
        .map((value) =>
          String(value || "")
            .trim()
            .toLowerCase()
        )
        .filter(Boolean);

      if (!selectedValues.length) return;

      const fieldMap = this.filterIndexByField[definition.key] || new Map();
      const fieldMatches = new Set();

      selectedValues.forEach((value) => {
        const ids = fieldMap.get(value);
        if (!ids) return;
        ids.forEach((id) => fieldMatches.add(id));
      });

      if (candidateIds === null) {
        candidateIds = fieldMatches;
      } else {
        candidateIds = this.intersectSets(candidateIds, fieldMatches);
      }
    });

    const products =
      candidateIds === null
        ? [...this.stateProducts]
        : Array.from(candidateIds)
            .map((id) => this.productById.get(id))
            .filter(Boolean);

    if (!searchTokens.length) return products;

    return products.filter((product) => {
      return searchTokens.every((token) =>
        this.productMatchesSearchToken(product, token)
      );
    });
  }

  productMatchesSearchToken(product, token) {
    const normalizedToken = this.normalizeSearchText(token);
    if (!normalizedToken) return true;

    const terms = toArray(product?.searchTerms);
    if (!terms.length) return false;

    if (/^\d{1,2}$/.test(normalizedToken))
      return terms.includes(normalizedToken);

    if (normalizedToken.length <= 2) {
      return terms.some(
        (term) => term === normalizedToken || term.startsWith(normalizedToken)
      );
    }

    if (
      terms.some(
        (term) =>
          term === normalizedToken ||
          term.startsWith(normalizedToken) ||
          term.includes(normalizedToken)
      )
    ) {
      return true;
    }

    return terms.some((term) => this.isFuzzySearchMatch(normalizedToken, term));
  }

  isFuzzySearchMatch(queryToken, candidateToken) {
    const left = this.normalizeSearchText(queryToken);
    const right = this.normalizeSearchText(candidateToken);

    if (!left || !right) return false;
    if (left === right) return true;

    const lengthGap = Math.abs(left.length - right.length);
    if (lengthGap > 2) return false;

    const minLength = Math.min(left.length, right.length);
    if (minLength < 3) return false;

    const distance = this.getDamerauLevenshteinDistance(left, right);
    const allowedDistance = minLength >= 8 ? 2 : 1;
    return distance <= allowedDistance;
  }

  getDamerauLevenshteinDistance(left, right) {
    const rows = left.length + 1;
    const cols = right.length + 1;
    const matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));

    for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
    for (let col = 0; col < cols; col += 1) matrix[0][col] = col;

    for (let row = 1; row < rows; row += 1) {
      for (let col = 1; col < cols; col += 1) {
        const cost = left[row - 1] === right[col - 1] ? 0 : 1;

        matrix[row][col] = Math.min(
          matrix[row - 1][col] + 1,
          matrix[row][col - 1] + 1,
          matrix[row - 1][col - 1] + cost
        );

        if (
          row > 1 &&
          col > 1 &&
          left[row - 1] === right[col - 2] &&
          left[row - 2] === right[col - 1]
        ) {
          matrix[row][col] = Math.min(
            matrix[row][col],
            matrix[row - 2][col - 2] + 1
          );
        }
      }
    }

    return matrix[left.length][right.length];
  }

  intersectSets(left, right) {
    const result = new Set();
    if (!left || !right || !left.size || !right.size) return result;

    const [smaller, larger] =
      left.size <= right.size ? [left, right] : [right, left];
    smaller.forEach((value) => {
      if (larger.has(value)) result.add(value);
    });

    return result;
  }

  getRelevanceScore(product) {
    let score = 0;

    const state = String(this.selectedState || "")
      .trim()
      .toLowerCase();
    const searchTokens = this.getCombinedSearchTokens();
    const terms = Array.isArray(product?.searchTerms)
      ? product.searchTerms
      : [];
    const filterValues = product?.filterValues || {};

    if (state) {
      const stateValues = Array.isArray(
        this.resolveProductTextValues(product, ["fields.State__c"])
      )
        ? this.resolveProductTextValues(product, ["fields.State__c"])
        : [];

      if (stateValues.includes(state)) {
        score += 100;
      }

      if (terms.includes(state)) {
        score += 40;
      }
    }

    searchTokens.forEach((token) => {
      if (terms.includes(token)) {
        score += 20;
      } else if (terms.some((term) => term.startsWith(token))) {
        score += 10;
      }
    });

    const gradeValues = Array.isArray(filterValues.Grade_Level__c)
      ? filterValues.Grade_Level__c
      : [];
    const categoryValues = Array.isArray(filterValues.Category__c)
      ? filterValues.Category__c
      : [];
    const seriesValues = Array.isArray(filterValues.Series__c)
      ? filterValues.Series__c
      : [];

    score += gradeValues.length ? 2 : 0;
    score += categoryValues.length ? 2 : 0;
    score += seriesValues.length ? 1 : 0;

    return score;
  }

  applyPaginationAndSort() {
    const sorted = this.sortProducts(this.products);
    this.totalResults = sorted.length;

    const pageSizes = this.getPageSizeValues();
    if (!pageSizes.includes(this.pageSizeValue)) {
      this.pageSizeValue = pageSizes[0] || DEFAULT_PAGE_SIZE;
    }

    this.totalPages = Math.max(
      1,
      Math.ceil(this.totalResults / this.pageSizeValue)
    );
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);

    if (!this.totalResults) {
      this.showingStart = 0;
      this.showingEnd = 0;
      this.visibleProducts = [];
      return;
    }

    const start = (this.currentPage - 1) * this.pageSizeValue;
    const end = Math.min(start + this.pageSizeValue, this.totalResults);

    this.showingStart = start + 1;
    this.showingEnd = end;

    this.visibleProducts = sorted.slice(start, end).map((product) => ({
      ...product,
      productUrl: this.buildProductDetailPath(product),
      priceLabel: this.formatCurrency(
        product.startingPrice,
        product.currencyIsoCode
      ),
      cardClass:
        this.viewMode === "list"
          ? "product-card product-card-list"
          : "product-card"
    }));
  }

  sortProducts(products) {
    const sorted = [...products];

    if (this.sortValue === "relevance") {
      sorted.sort((a, b) => {
        const scoreA = this.getRelevanceScore(a);
        const scoreB = this.getRelevanceScore(b);

        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }

        return a.name.localeCompare(b.name);
      });
    } else if (this.sortValue === "name-asc") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (this.sortValue === "name-desc") {
      sorted.sort((a, b) => b.name.localeCompare(a.name));
    }

    return sorted;
  }

  async reloadProducts() {
    this.loading = true;
    try {
      const response = await this.loadStateProducts();
      this.stateProducts = response.products;
      this.rebuildProductIndexes();
      this.filterValueCatalog = this.buildStaticFilterCatalog(response.facets);
      this.rebuildFilterGroups();
      this.applyLocalFiltersAndPagination();
    } catch {
      this.resetResults();
    } finally {
      this.loading = false;
    }
  }

  resetResults() {
    this.stateProducts = [];
    this.products = [];
    this.visibleProducts = [];
    this.totalResults = 0;
    this.totalPages = 1;
    this.showingStart = 0;
    this.showingEnd = 0;
    this.filterValueCatalog = {};
    this.productById = new Map();
    this.filterIndexByField = {};
  }

  clearSelectedFilters() {
    this.selectedFiltersByField = {};
    this.rebuildFilterGroups();
  }

  handleSearchInput(event) {
    const nextValue = event?.target?.value ?? event?.detail?.value ?? "";
    this.searchText = String(nextValue);
    if (this.tokenizeSearchText(this.searchText).length) {
      this.clearSelectedFilters();
    }
    this.currentPage = 1;
    this.applyLocalFiltersAndPagination();
  }

  handleSearchKeydown(event) {
    if (event?.key !== "Enter") return;
    event.preventDefault();
    this.handleSearchInput(event);
  }

  async handleStateChange(event) {
    this.selectedState = String(event?.detail?.value || "").trim();
    this.writeStateToStorage(this.selectedState);
    this.updateResultsUrlForState(this.selectedState);
    this.clearSelectedFilters();
    this.currentPage = 1;
    await this.reloadProducts();
  }

  handleSortChange(event) {
    this.sortValue = event?.detail?.value || "relevance";
    this.currentPage = 1;
    this.applyPaginationAndSort();
  }

  handlePageSizeChange(event) {
    const next = Number.parseInt(event?.detail?.value, 10);
    if (Number.isFinite(next) && next > 0) {
      this.pageSizeValue = next;
    }
    this.currentPage = 1;
    this.applyPaginationAndSort();
  }

  handleViewMode(event) {
    const mode = event?.currentTarget?.dataset?.mode;
    if (!mode || (mode !== "grid" && mode !== "list")) return;

    this.viewMode = mode;
    this.applyPaginationAndSort();
  }

  handleToggleGroup(event) {
    const fieldApiName = event?.currentTarget?.dataset?.field;
    if (!fieldApiName) return;

    this.collapsedByField = {
      ...this.collapsedByField,
      [fieldApiName]: !this.collapsedByField[fieldApiName]
    };

    this.rebuildFilterGroups();
  }

  handleFilterChange(event) {
    const field = event?.target?.dataset?.field;
    const value = event?.target?.dataset?.value;
    const checked = Boolean(event?.target?.checked);

    if (!field || !value) return;

    const existing = new Set(this.selectedFiltersByField[field] || []);
    if (checked) {
      existing.add(value);
    } else {
      existing.delete(value);
    }

    this.selectedFiltersByField = {
      ...this.selectedFiltersByField,
      [field]: Array.from(existing)
    };

    this.currentPage = 1;
    this.loading = true;
    try {
      this.rebuildFilterGroups();
      this.applyLocalFiltersAndPagination();
    } finally {
      this.loading = false;
    }
  }

  handlePrevPage() {
    if (this.currentPage <= 1) return;
    this.currentPage -= 1;
    this.applyPaginationAndSort();
  }

  handleNextPage() {
    if (this.currentPage >= this.totalPages) return;
    this.currentPage += 1;
    this.applyPaginationAndSort();
  }

  getProductById(productId) {
    if (!productId) return null;
    return (
      this.productById.get(productId) ||
      this.products.find((item) => item.id === productId) ||
      null
    );
  }

  handleQuickShop(event) {
    event.preventDefault();
    event.stopPropagation();

    const productId = event?.currentTarget?.dataset?.pid;
    const product = this.getProductById(productId);
    if (!product) return;

    this.modalProduct = product;
    this.modalVariationPricing = null;
    this.isModalOpen = true;

    globalThis.window.requestAnimationFrame(() => {
      const modal = this.template.querySelector("c-quick-shop-modal");
      if (modal && typeof modal.open === "function") {
        modal.open();
      }
    });

    this.loadVariationPricing(productId);
  }

  async loadVariationPricing(productId) {
    try {
      this.modalVariationPricing = await getVariationPricing({
        productId,
        webStoreId: this.webStoreId || DEFAULT_WEBSTORE_ID
      });
    } catch (error) {
      console.warn("Failed to load variation pricing.", error);
    }
  }

  handleModalClose() {
    this.isModalOpen = false;
    this.modalProduct = null;
    this.modalVariationPricing = null;
  }

  handleViewDetails() {
    if (!this.modalProduct) return;
    globalThis.window.location.href = this.buildProductDetailPath(
      this.modalProduct
    );
  }

  handleTrial() {
    if (!this.modalProduct) return;
    globalThis.window.location.href = this.buildProductDetailPath(
      this.modalProduct
    );
  }

  async handleAddToCart(event) {
    if (this.isAddingToCart) return;
    const productId = event?.detail?.productId || this.modalProduct?.id || "";
    if (!productId) return;

    const requestedQty = Number.parseInt(event?.detail?.quantity, 10);
    const quantity =
      Number.isFinite(requestedQty) && requestedQty > 0 ? requestedQty : 1;

    this.isAddingToCart = true;
    try {
      const added = await this.addProductToCart(productId, quantity);
      if (added) {
        this.handleModalClose();
        globalThis.window.location.href = `/${this.storeName || DEFAULT_STORE_NAME}/cart`;
      }
    } finally {
      this.isAddingToCart = false;
    }
  }

  async addProductToCart(productId, quantity) {
    const payload = { productId, quantity, type: "Product" };

    try {
      const response = await fetch(
        this.buildAddToCartEndpoint(this.cartStateOrId || "current"),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  buildAddToCartEndpoint(cartStateOrId) {
    const targetCart = String(cartStateOrId || "current").trim() || "current";
    const params = new URLSearchParams(CART_REQUEST_PARAMS);

    return `/${this.storeName || DEFAULT_STORE_NAME}/webruntime/api/services/data/v66.0/commerce/webstores/${this.webStoreId || DEFAULT_WEBSTORE_ID}/carts/${targetCart}/cart-items?${params.toString()}`;
  }

  resolveProductImageUrl(item) {
    const candidates = [
      item?.defaultImage?.url,
      item?.image?.url,
      item?.imageUrl
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return this.normalizeImageUrl(candidate.trim());
      }
    }

    const groups = toArray(item?.mediaGroups);
    for (const group of groups) {
      const mediaItems = toArray(group?.mediaItems);
      for (const mediaItem of mediaItems) {
        const url = mediaItem?.url || mediaItem?.image?.url;
        if (typeof url === "string" && url.trim()) {
          return this.normalizeImageUrl(url.trim());
        }
      }
    }

    return "";
  }

  normalizeImageUrl(url) {
    const value = String(url || "")
      .trim()
      .replaceAll(/\s/g, "%20");
    if (!value) return "";

    if (/^(https?:|data:)/i.test(value)) return value;
    if (value.startsWith("//")) return `https:${value}`;

    if (globalThis.window?.location?.origin) {
      if (value.startsWith("/")) {
        return `${globalThis.window.location.origin}${value}`;
      }
      return `${globalThis.window.location.origin}/${value.replace(/^\/+/, "")}`;
    }

    return value;
  }

  readStateFromStorage() {
    try {
      const value = String(
        globalThis.window.localStorage.getItem(
          this.stateStorageKey || DEFAULT_STATE_STORAGE_KEY
        ) || ""
      ).trim();
      return US_STATES.includes(value) ? value : "";
    } catch {
      return "";
    }
  }

  writeStateToStorage(value) {
    try {
      globalThis.window.localStorage.setItem(
        this.stateStorageKey || DEFAULT_STATE_STORAGE_KEY,
        value || ""
      );
    } catch {
      // ignore
    }
  }

  updateResultsUrlForState(stateValue) {
    if (!globalThis.window?.history) return;

    const nextToken = String(stateValue || "").trim() || "all";
    const currentPath = globalThis.window.location?.pathname || "";
    const markerIndex = currentPath.indexOf(SEARCH_MARKER);
    const basePath =
      markerIndex >= 0
        ? currentPath.slice(0, markerIndex + SEARCH_MARKER.length)
        : `/${this.storeName || DEFAULT_STORE_NAME}${SEARCH_MARKER}`;
    const nextPath = `${basePath}${encodeURIComponent(nextToken)}`;

    if (
      currentPath === nextPath &&
      !globalThis.window.location?.search &&
      !globalThis.window.location?.hash
    ) {
      this.currentPathSearchToken = nextToken === "all" ? "" : nextToken;
      this.lastObservedHref = this.getCurrentHref();
      return;
    }

    globalThis.window.history.pushState({}, "", nextPath);
    this.currentPathSearchToken = nextToken === "all" ? "" : nextToken;
    this.lastObservedHref = this.getCurrentHref();
  }

  buildProductDetailPath(product) {
    const productIdForUrl = product?.id;
    const source = product?.urlName || product?.name || "detail";
    const slug = String(source)
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-+|-+$/g, "");

    return `/${this.storeName || DEFAULT_STORE_NAME}/product/${slug || "detail"}/${productIdForUrl}`;
  }

  formatCurrency(amount, currencyIsoCode) {
    if (!Number.isFinite(amount)) return "—";

    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyIsoCode || "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    } catch {
      return `$${amount.toFixed(2)}`;
    }
  }

  getPageSizeValues() {
    const values = parseCsv(this.pageSizeOptions)
      .map((item) => Number.parseInt(item, 10))
      .filter((item) => Number.isFinite(item) && item > 0);

    return values.length
      ? [...new Set(values)].sort((a, b) => a - b)
      : [20, 40, 60];
  }

  resolveInitialPageSize() {
    const allowed = this.getPageSizeValues();
    const parsed = Number.parseInt(this.defaultPageSize, 10);
    if (Number.isFinite(parsed) && allowed.includes(parsed)) return parsed;
    return allowed[0] || DEFAULT_PAGE_SIZE;
  }

  normalizePositiveInt(value, fallback, max) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Number.isFinite(max) ? Math.min(parsed, max) : parsed;
  }

  humanizeApiName(value) {
    const normalized = String(value || "").replace(/__c$/, "");
    return (
      normalized
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ") || "Filter"
    );
  }

  normalizeFieldName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9]/g, "");
  }

  extractPricingMap(data) {
    const root = data && typeof data === "object" ? data : {};
    let rows = [];
    if (Array.isArray(root.pricingLineItemResults)) {
      rows = root.pricingLineItemResults;
    } else if (Array.isArray(root.pricingResults)) {
      rows = root.pricingResults;
    }

    const pricingByProductId = new Map();

    for (const row of rows) {
      const productId = String(
        row?.productId ||
          row?.pricingLineItem?.productId ||
          row?.product?.id ||
          row?.product?.productId ||
          ""
      ).trim();

      if (!productId) continue;

      pricingByProductId.set(productId, {
        currencyIsoCode:
          this.firstString([row?.currencyIsoCode, root?.currencyIsoCode]) ||
          "USD",
        listPrice: this.resolvePrice(row, [
          "listPrice",
          "pricebookPrice",
          "listUnitPrice"
        ]),
        salesPrice: this.resolvePrice(row, [
          "salesPrice",
          "unitPrice",
          "unitAdjustedPrice",
          "price"
        ]),
        negotiatedPrice: this.resolvePrice(row, ["negotiatedPrice"]),
        unitPrice: this.resolvePrice(row, [
          "unitPrice",
          "salesPrice",
          "unitAdjustedPrice",
          "price"
        ])
      });
    }

    return pricingByProductId;
  }

  resolvePrice(source, paths) {
    for (const path of paths) {
      const value = this.resolveByPath(source, path);
      const normalized = this.toNumber(value);
      if (normalized !== null) return normalized;
    }
    return null;
  }

  resolveByPath(source, path) {
    if (!source || !path) return undefined;

    return path.split(".").reduce((acc, key) => {
      if (acc && typeof acc === "object" && key in acc) return acc[key];
      return undefined;
    }, source);
  }

  toNumber(value) {
    if (value === null || value === undefined || value === "") return null;

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === "object") {
      if (typeof value.amount === "number" && Number.isFinite(value.amount))
        return value.amount;
      if (typeof value.value === "number" && Number.isFinite(value.value))
        return value.value;
    }

    const parsed = Number(String(value).replaceAll(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  firstString(values) {
    for (const value of values || []) {
      if (typeof value === "string" && value.trim()) return value.trim();

      if (value && typeof value === "object") {
        if (typeof value.value === "string" && value.value.trim())
          return value.value.trim();
        if (typeof value.displayValue === "string" && value.displayValue.trim())
          return value.displayValue.trim();
      }
    }

    return "";
  }

  closeAllDropdowns() {
    this.isStateDropdownOpen = false;
    this.isSortDropdownOpen = false;
    this.isPageSizeDropdownOpen = false;
  }

  toggleStateDropdown(event) {
    event.stopPropagation();
    const next = !this.isStateDropdownOpen;
    this.closeAllDropdowns();
    this.isStateDropdownOpen = next;
  }

  toggleSortDropdown(event) {
    event.stopPropagation();
    const next = !this.isSortDropdownOpen;
    this.closeAllDropdowns();
    this.isSortDropdownOpen = next;
  }

  togglePageSizeDropdown(event) {
    event.stopPropagation();
    const next = !this.isPageSizeDropdownOpen;
    this.closeAllDropdowns();
    this.isPageSizeDropdownOpen = next;
  }

  async handleStateOptionClick(event) {
    event.stopPropagation();
    const value = String(event.currentTarget.dataset.value || "").trim();
    this.closeAllDropdowns();
    await this.handleStateChange({ detail: { value } });
  }

  handleSortOptionClick(event) {
    event.stopPropagation();
    const value = String(event.currentTarget.dataset.value || "relevance");
    this.closeAllDropdowns();
    this.handleSortChange({ detail: { value } });
  }

  handleToggleMobileFilters() {
    this.isMobileFiltersOpen = !this.isMobileFiltersOpen;
    if (globalThis.document?.body) {
      globalThis.document.body.style.overflow = this.isMobileFiltersOpen
        ? "hidden"
        : "";
    }
  }

  handleClearAllFilters() {
    this.selectedFiltersByField = {};
    this.searchText = "";
    this.currentPage = 1;
    this.rebuildFilterGroups();
    this.applyLocalFiltersAndPagination();
  }

  handlePageSizeOptionClick(event) {
    event.stopPropagation();
    const value = String(
      event.currentTarget.dataset.value || this.pageSizeValueString
    );
    this.closeAllDropdowns();
    this.handlePageSizeChange({ detail: { value } });
  }
}
