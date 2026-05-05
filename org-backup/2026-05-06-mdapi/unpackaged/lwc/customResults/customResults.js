import { LightningElement, api } from "lwc";
import getVariationPricing from "@salesforce/apex/ProductVariationController.getVariationPricing";
import getProductSearchFields from "@salesforce/apex/ProductVariationController.getProductSearchFields";
import {
  readStateFromStorage,
  writeStateToStorage,
  dispatchStateChange,
  resolveByPath,
  firstString,
  resolvePrice,
  extractPricingMap as sharedExtractPricingMap,
  formatCurrency as sharedFormatCurrency,
  normalizeImageUrl as sharedNormalizeImageUrl,
  resolveProductImageUrl as sharedResolveProductImageUrl,
  normalizeProduct as sharedNormalizeProduct,
  extractProductList as sharedExtractProductList,
  buildProductDetailPath as sharedBuildProductDetailPath,
  buildFreeTrialPath as sharedBuildFreeTrialPath,
  addProductToCart as sharedAddProductToCart,
  buildAddToCartSuccessModalData,
  resolveStockKeepingUnit as sharedResolveStockKeepingUnit,
  resolveCurrencyIsoCode as sharedResolveCurrencyIsoCode,
  applyStorefrontGuestParams,
  ALL_STATES,
  DEFAULT_WEBSTORE_ID,
  DEFAULT_STORE_NAME,
  STATE_STORAGE_KEY
} from "c/utils";

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_STATE = "Georgia";
const SEARCH_MARKER = "/global-search/";
const URL_WATCH_INTERVAL_MS = 250;
const URL_WATCH_DEBOUNCE_MS = 120;
const DEFAULT_REMOTE_SEARCH_TERM = "all";
const SEARCH_FIELDS = ["StockKeepingUnit"];

const ALL_STATES_OPTION_VALUE = "__ALL_STATES__";
const ALL_STATES_OPTION_LABEL = "All States";

const PRODUCT_DETAIL_BATCH_SIZE = 200;
const PRICING_BATCH_SIZE = 200;

const GRADE_FILTER_OPTIONS = [
  {
    label: "Kindergarten",
    value: "Grade K"
  },
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
].map((entry) => {
  return typeof entry === "string" ? { label: entry, value: entry } : entry;
});

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

function buildFilterOptions(values) {
  return values.map((value) => ({
    label: value,
    value
  }));
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseMultiValueString(value) {
  return String(value || "")
    .split(/[;,|]/)
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
  @api stateStorageKey = STATE_STORAGE_KEY;

  @api stateFieldApiName = "State__c";
  @api filterFieldApiNames = "Grade_Level__c,Category__c,Series__c";
  @api filterFieldLabels = "Grade Level,Subject,Series";
  @api searchFieldApiNames = SEARCH_FIELDS.join(",");

  @api pageSizeOptions = "20,40,60";
  @api defaultPageSize = DEFAULT_PAGE_SIZE;
  @api fetchPageSize = 120;
  @api maxFetchPages = 20;
  @api cartStateOrId = "current";

  loading = false;
  products = [];
  visibleProducts = [];
  filterGroups = [];

  selectedState = "";
  searchText = "";
  sortValue = "relevance";
  pageSizeValue = DEFAULT_PAGE_SIZE;
  currentPage = 1;
  totalResults = 0;
  totalPages = 1;
  showingStart = 0;
  showingEnd = 0;
  viewMode = "grid";

  isModalOpen = false;
  isAddingToCart = false;
  modalProduct = null;
  modalVariationPricing = null;
  isModalPricingLoading = false;
  modalPricingLoadError = false;
  modalCartError = "";
  isSuccessModalOpen = false;
  successModalData = null;

  isStateDropdownOpen = false;
  isSortDropdownOpen = false;
  isPageSizeDropdownOpen = false;
  isMobileFiltersOpen = false;

  stateProducts = [];
  selectedFiltersByField = {};
  collapsedByField = {};
  filterDefinitions = [];
  filterValueCatalog = {};
  productById = new Map();
  filterIndexByField = {};
  currentPathSearchToken = "";
  lastObservedHref = "";
  urlWatchId = null;
  urlWatchDebounceId = null;
  docClickHandler = null;
  boundExternalStateHandler = null;
  boundStorageHandler = null;

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

    this.boundExternalStateHandler = (event) => {
      this.handleExternalStateChange(event);
    };
    this.boundStorageHandler = (event) => {
      this.handleStorageStateChange(event);
    };

    globalThis.addEventListener("abcstatechange", this.boundExternalStateHandler);
    globalThis.addEventListener("statechange", this.boundExternalStateHandler);
    globalThis.addEventListener("storage", this.boundStorageHandler);
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

    globalThis.removeEventListener("abcstatechange", this.boundExternalStateHandler);
    globalThis.removeEventListener("statechange", this.boundExternalStateHandler);
    globalThis.removeEventListener("storage", this.boundStorageHandler);

    this.boundExternalStateHandler = null;
    this.boundStorageHandler = null;
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

  get modalProductId() {
    return this.modalProduct?.id || "";
  }

  get modalIsbn() {
    if (!this.modalProduct) return "";

    return firstString([
      this.modalProduct.sku,
      this.modalProduct.isbn,
      resolveByPath(this.modalProduct, "fields.StockKeepingUnit")
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

    if (Number.isFinite(ruleMax) && ruleMax > 0 && ruleMax <= 9999) {
      return ruleMax;
    }

    return 50;
  }

  get modalIncrementQuantity() {
    const rule = this.modalProduct?.purchaseQuantityRule;
    const ruleInc = rule?.increment ?? rule?.Increment ?? null;

    if (Number.isFinite(ruleInc) && ruleInc > 0) return ruleInc;

    return 1;
  }

  get successProductName() {
    return this.successModalData?.productName || "";
  }

  get successProductImageUrl() {
    return this.successModalData?.productImageUrl || "";
  }

  get successProductUrl() {
    return this.successModalData?.productUrl || "";
  }

  get successCartUrl() {
    return this.successModalData?.cartUrl || "";
  }

  get selectedStateLabel() {
    return this.selectedState || ALL_STATES_OPTION_LABEL;
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

  get filtersColumnClass() {
    return this.isMobileFiltersOpen
      ? "filters-column mobile-open"
      : "filters-column";
  }

  get stateOptionsForUi() {
    const options = [
      {
        label: ALL_STATES_OPTION_LABEL,
        value: ALL_STATES_OPTION_VALUE
      },
      ...ALL_STATES.map((value) => ({
        label: value,
        value
      }))
    ];

    return options.map((option) => ({
      ...option,
      className:
        option.value === ALL_STATES_OPTION_VALUE
          ? !this.selectedState
            ? "custom-select-option selected"
            : "custom-select-option"
          : option.value === this.selectedState
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

      const routeState = this.getPathSearchToken();

      if (routeState === ALL_STATES_OPTION_VALUE) {
        this.selectedState = "";
      } else if (ALL_STATES.includes(routeState)) {
        this.selectedState = routeState;
      } else {
        this.selectedState = readStateFromStorage() || DEFAULT_STATE;
      }

      if (this.selectedState) {
        writeStateToStorage(this.selectedState);
      }

      const initialResponse = await this.loadStateProducts();

      this.stateProducts = initialResponse.products;
      this.rebuildProductIndexes();
      this.filterValueCatalog = this.buildFilterCatalogFromIndexes();
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

  buildFilterCatalogFromIndexes() {
    const catalog = {};

    this.filterDefinitions.forEach((definition) => {
      const options = this.getMergedFilterOptions(definition.key);
      const countsByValue = this.getIndexedCountMap(definition.key);

      catalog[definition.key] = options.map((option) => ({
        label: option.label,
        value: option.value,
        count:
          countsByValue.get(
            this.normalizeFilterMatchValue(definition.key, option.value)
          ) || 0
      }));
    });

    return catalog;
  }

  getMergedFilterOptions(fieldApiName) {
    const hardcoded = this.getHardcodedFilterOptions(fieldApiName);
    const hardcodedByNormalized = new Map(
      hardcoded.map((option) => [
        this.normalizeFilterMatchValue(fieldApiName, option.value),
        option
      ])
    );

    const indexedValues = [
      ...(this.filterIndexByField[fieldApiName]?.keys() || [])
    ].filter(Boolean);

    const dynamicOptions = indexedValues
      .filter((value) => !hardcodedByNormalized.has(value))
      .map((value) => ({
        label: this.humanizeFilterValue(value),
        value: this.humanizeFilterValue(value)
      }))
      .sort((left, right) => left.label.localeCompare(right.label));

    return [...hardcoded, ...dynamicOptions];
  }

  getIndexedCountMap(fieldApiName) {
    const counts = new Map();
    const fieldMap = this.filterIndexByField[fieldApiName] || new Map();

    fieldMap.forEach((ids, normalizedValue) => {
      counts.set(normalizedValue, ids?.size || 0);
    });

    return counts;
  }

  humanizeFilterValue(value) {
    return String(value || "")
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  getHardcodedFilterOptions(fieldApiName) {
    const normalized = this.normalizeFieldName(fieldApiName);

    if (normalized === this.normalizeFieldName("Grade_Level__c")) {
      return GRADE_FILTER_OPTIONS;
    }

    if (normalized === this.normalizeFieldName("Category__c")) {
      return buildFilterOptions(CATEGORY_FILTER_VALUES);
    }

    if (normalized === this.normalizeFieldName("Series__c")) {
      return buildFilterOptions(SERIES_FILTER_VALUES);
    }

    return [];
  }

  async fetchAllProducts(criteria) {
    const pageSize = this.normalizePositiveInt(this.fetchPageSize, 120, 200);
    const maxPages = this.normalizePositiveInt(this.maxFetchPages, 20, 20);

    const allProducts = [];
    const seenIds = new Set();
    let facets = [];

    for (let page = 0; page < maxPages; page += 1) {
      // eslint-disable-next-line no-await-in-loop
      const data = await this.fetchSearchResponse(criteria, page, pageSize);
      const pageProducts = sharedExtractProductList(data);

      if (page === 0) {
        facets = this.extractFacetList(data);
      }

      if (!pageProducts.length) {
        break;
      }

      pageProducts.forEach((row) => {
        const id = String(row?.id || "").trim();

        if (!id || seenIds.has(id)) {
          return;
        }

        seenIds.add(id);
        allProducts.push(row);
      });

      const total = Number.parseInt(data?.productsPage?.total, 10);

      if (Number.isFinite(total) && allProducts.length >= total) {
        break;
      }

      if (pageProducts.length < pageSize) {
        break;
      }
    }

    return { products: allProducts, facets };
  }

  async loadStateProducts() {
    let response;

    if (this.selectedState) {
      response = await this.fetchAllProducts(this.buildStateSearchCriteria());
    } else {
      response = await this.fetchAllProducts(this.buildAllProductsSearchCriteria());

      /*
       * Fallback:
       * If Commerce Search API does not return all products for searchTerm=all,
       * fetch by each state and merge unique products.
       */
      if (!toArray(response.products).length) {
        response = await this.fetchProductsAcrossAllStates();
      }
    }

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

      if (!response.ok) {
        return {};
      }

      return await response.json();
    } catch {
      return {};
    }
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

          if (!response.ok) {
            return new Map();
          }

          const data = await response.json();

          return sharedExtractPricingMap(data);
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
    const params = applyStorefrontGuestParams(
      new URLSearchParams({ productIds: productIds.join(",") })
    );

    return `${base}?${params.toString()}`;
  }

  async hydrateProductsWithFields(products) {
    const ids = toArray(products)
      .map((item) => String(item?.id || "").trim())
      .filter(Boolean);

    if (!ids.length) {
      return toArray(products);
    }

    const hydratedMap = await this.fetchProductFieldMap(ids);

    if (!hydratedMap.size) {
      return toArray(products);
    }

    return toArray(products).map((item) => {
      const hydrated = hydratedMap.get(String(item?.id || "").trim());

      if (!hydrated) {
        return item;
      }

      const merged = {
        ...item,
        ...hydrated,
        fields:
          hydrated.fields && Object.keys(hydrated.fields).length
            ? hydrated.fields
            : item.fields
      };

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

    if (!ids.length) {
      return new Map();
    }

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
    try {
      const rows = await getProductSearchFields({
        productIds: toArray(productIds)
      });

      const map = new Map();

      toArray(rows).forEach((item) => {
        const id = String(item?.id || "").trim();

        if (!id) {
          return;
        }

        map.set(id, {
          id,
          fields: {
            StockKeepingUnit: item?.stockKeepingUnit || null,
            Grade_Level__c: item?.gradeLevel || null,
            Category__c: item?.category || null,
            Series__c: item?.series || null,
            State__c: item?.state || null
          }
        });
      });

      return map;
    } catch {
      return new Map();
    }
  }

  buildSearchEndpoint(criteria, page, pageSize) {
    const base = `/${this.storeName || DEFAULT_STORE_NAME}/webruntime/api/services/data/v66.0/commerce/webstores/${this.webStoreId || DEFAULT_WEBSTORE_ID}/search/products`;

    const params = applyStorefrontGuestParams(
      new URLSearchParams({
        searchTerm: criteria.searchTerm,
        page: String(page),
        pageSize: String(pageSize)
      })
    );

    this.applyRefinementsToParams(params, criteria.refinements);

    const fieldList = this.getSearchFields();

    fieldList.forEach((fieldName) => {
      params.append("fields", fieldName);
    });

    return `${base}?${params.toString()}`;
  }

  buildStateSearchCriteria() {
    return {
      searchTerm: this.composeRemoteStateSearchTerm(),
      refinements: this.buildStateRefinements()
    };
  }

  buildAllProductsSearchCriteria() {
    return {
      searchTerm: DEFAULT_REMOTE_SEARCH_TERM,
      refinements: {}
    };
  }

  async fetchProductsAcrossAllStates() {
    const productById = new Map();
    let mergedFacets = [];

    for (const state of ALL_STATES) {
      // eslint-disable-next-line no-await-in-loop
      const response = await this.fetchAllProducts({
        searchTerm: state,
        refinements: {
          [this.stateFieldApiName]: [state]
        }
      });

      if (!mergedFacets.length && response.facets?.length) {
        mergedFacets = response.facets;
      }

      toArray(response.products).forEach((product) => {
        const id = String(product?.id || "").trim();

        if (!id || productById.has(id)) {
          return;
        }

        productById.set(id, product);
      });
    }

    return {
      products: Array.from(productById.values()),
      facets: mergedFacets
    };
  }

  getSearchFields() {
    const configured = parseCsv(this.searchFieldApiNames);

    return configured.length ? configured : SEARCH_FIELDS;
  }

  composeRemoteStateSearchTerm() {
    const selectedState = String(this.selectedState || "").trim();

    if (selectedState) {
      return selectedState;
    }

    const configuredTerm = String(this.defaultSearchTerm || "").trim();

    if (!configuredTerm) {
      return DEFAULT_REMOTE_SEARCH_TERM;
    }

    const normalizedTerm = configuredTerm.toLowerCase();

    if (normalizedTerm === "*") {
      return DEFAULT_REMOTE_SEARCH_TERM;
    }

    return configuredTerm;
  }

  getPathSearchToken() {
    if (!globalThis.window?.location?.pathname) {
      return "";
    }

    const path = globalThis.window.location.pathname;
    const markerIndex = path.indexOf(SEARCH_MARKER);

    if (markerIndex < 0) {
      return "";
    }

    const after = path.slice(markerIndex + SEARCH_MARKER.length);
    const token = (after.split("/")[0] || "").trim();

    if (!token) {
      return "";
    }

    if (token.toLowerCase() === "all") {
      return ALL_STATES_OPTION_VALUE;
    }

    return this.decodeSearchPathSegment(token);
  }

  decodeSearchPathSegment(value) {
    let decoded = String(value || "")
      .replaceAll("+", " ")
      .trim();

    if (!decoded) {
      return "";
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const nextValue = decodeURIComponent(decoded);

        if (nextValue === decoded) {
          break;
        }

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

    const routeLooksLikeState =
      routeSearchText === ALL_STATES_OPTION_VALUE ||
      ALL_STATES.includes(routeSearchText);

    if (routeSearchText && !routeLooksLikeState) {
      tokens.push(...this.tokenizeSearchText(routeSearchText));
    }

    if (this.searchText) {
      tokens.push(...this.tokenizeSearchText(this.searchText));
    }

    return [...new Set(tokens)];
  }

  getCurrentHref() {
    return globalThis.window?.location?.href ?? "";
  }

  startUrlWatcher() {
    if (globalThis.window === undefined || this.urlWatchId) {
      return;
    }

    this.captureCurrentRouteState();

    this.urlWatchId = globalThis.window.setInterval(() => {
      const href = this.getCurrentHref();

      if (!href || href === this.lastObservedHref) {
        return;
      }

      this.lastObservedHref = href;
      globalThis.window.clearTimeout(this.urlWatchDebounceId);

      this.urlWatchDebounceId = globalThis.window.setTimeout(() => {
        this.handleObservedUrlChange();
      }, URL_WATCH_DEBOUNCE_MS);
    }, URL_WATCH_INTERVAL_MS);
  }

  stopUrlWatcher() {
    if (globalThis.window === undefined) {
      return;
    }

    globalThis.window.clearInterval(this.urlWatchId);
    globalThis.window.clearTimeout(this.urlWatchDebounceId);

    this.urlWatchId = null;
    this.urlWatchDebounceId = null;
  }

  async handleObservedUrlChange() {
    const nextPathSearchToken = this.getPathSearchToken();

    if (nextPathSearchToken === this.currentPathSearchToken) {
      return;
    }

    this.currentPathSearchToken = nextPathSearchToken;

    if (nextPathSearchToken === ALL_STATES_OPTION_VALUE) {
      this.selectedState = "";
      this.clearSelectedFilters();
      this.currentPage = 1;
      await this.reloadProducts();
      return;
    }

    if (
      ALL_STATES.includes(nextPathSearchToken) &&
      nextPathSearchToken !== this.selectedState
    ) {
      this.selectedState = nextPathSearchToken;
      writeStateToStorage(nextPathSearchToken);
      this.clearSelectedFilters();
      this.currentPage = 1;
      await this.reloadProducts();
      return;
    }

    this.currentPage = 1;
    this.applyLocalFiltersAndPagination();
  }

  buildStateRefinements() {
    const result = {};
    const selectedState = String(this.selectedState || "").trim();

    if (selectedState) {
      result[this.stateFieldApiName] = [selectedState];
    }

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

      if (!field || !uniqueValues.length) {
        return;
      }

      uniqueValues.forEach((value) => {
        params.append("refinement", `${field}:${value}`);
      });
    });
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
    const base = sharedNormalizeProduct(item);

    if (!base) {
      return null;
    }

    const imageUrl = this.resolveProductImageUrl(item);
    const sku = sharedResolveStockKeepingUnit(item);
    const currencyIsoCode = sharedResolveCurrencyIsoCode(item);

    const listPrice = resolvePrice(item, [
      "prices.listPrice",
      "prices.pricebookPrice",
      "fields.Price__c",
      "price"
    ]);

    const salesPrice = resolvePrice(item, [
      "prices.salesPrice",
      "prices.unitPrice",
      "prices.unitAdjustedPrice",
      "price"
    ]);

    const negotiatedPrice = resolvePrice(item, [
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
      ...base,
      imageUrl,
      sku,
      isbn: sku,
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
      this.collectResolvedText(resolveByPath(item, path), values)
    );

    return [...new Set(values)];
  }

  collectResolvedText(value, values) {
    if (value === null || value === undefined || value === "") {
      return;
    }

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

  buildProductSearchTerms(item, context = {}) {
    const parts = [];
    const filterValues = context?.filterValues || {};
    const gradeValues = toArray(filterValues.Grade_Level__c);
    const categoryValues = toArray(filterValues.Category__c);

    this.collectSearchText(item?.name, parts);
    this.collectSearchText(context?.sku, parts);
    this.collectSearchText(item?.urlName, parts);
    this.collectSearchText(resolveByPath(item, "fields.Name"), parts);
    this.collectSearchText(resolveByPath(item, "fields.State__c"), parts);
    this.collectSearchText(gradeValues, parts);
    this.collectSearchText(categoryValues, parts);
    this.collectSearchText(filterValues.Series__c, parts);

    gradeValues.forEach((value) => {
      if (
        this.normalizeFilterMatchValue("Grade_Level__c", value) ===
        this.normalizeSearchText("Grade K")
      ) {
        parts.push("kindergarten");
      }
    });

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
    if (value === null || value === undefined || value === "") {
      return;
    }

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
          label: entry.label || entry.value,
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

      if (!productId) {
        return;
      }

      this.productById.set(productId, product);

      this.filterDefinitions.forEach((definition) => {
        const fieldMap = this.filterIndexByField[definition.key];
        const values = toArray(product?.filterValues?.[definition.key])
          .map((value) => this.normalizeFilterMatchValue(definition.key, value))
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
        .map((value) => this.normalizeFilterMatchValue(definition.key, value))
        .filter(Boolean);

      if (!selectedValues.length) {
        return;
      }

      const fieldMap = this.filterIndexByField[definition.key] || new Map();
      const fieldMatches = new Set();

      selectedValues.forEach((value) => {
        const ids = fieldMap.get(value);

        if (!ids) {
          return;
        }

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

    if (!searchTokens.length) {
      return products;
    }

    return products.filter((product) => {
      return searchTokens.every((token) =>
        this.productMatchesSearchToken(product, token)
      );
    });
  }

  productMatchesSearchToken(product, token) {
    const normalizedToken = this.normalizeSearchText(token);

    if (!normalizedToken) {
      return true;
    }

    const terms = toArray(product?.searchTerms);

    if (!terms.length) {
      return false;
    }

    if (/^\d{1,2}$/.test(normalizedToken)) {
      return terms.includes(normalizedToken);
    }

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

    if (lengthGap > 2) {
      return false;
    }

    const minLength = Math.min(left.length, right.length);

    if (minLength < 3) {
      return false;
    }

    const distance = this.getDamerauLevenshteinDistance(left, right);
    const allowedDistance = minLength >= 8 ? 2 : 1;

    return distance <= allowedDistance;
  }

  getDamerauLevenshteinDistance(left, right) {
    const rows = left.length + 1;
    const cols = right.length + 1;
    const matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));

    for (let row = 0; row < rows; row += 1) {
      matrix[row][0] = row;
    }

    for (let col = 0; col < cols; col += 1) {
      matrix[0][col] = col;
    }

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

    if (!left || !right || !left.size || !right.size) {
      return result;
    }

    const [smaller, larger] =
      left.size <= right.size ? [left, right] : [right, left];

    smaller.forEach((value) => {
      if (larger.has(value)) {
        result.add(value);
      }
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
      const stateValues = this.resolveProductTextValues(product, [
        "fields.State__c"
      ]);

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
      productUrl: this.getProductDetailPath(product),
      priceLabel: sharedFormatCurrency(
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
      this.filterValueCatalog = this.buildFilterCatalogFromIndexes();
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
    if (event?.key !== "Enter") {
      return;
    }

    event.preventDefault();
    this.handleSearchInput(event);
  }

  async handleStateChange(event) {
    const rawValue = String(event?.detail?.value || "").trim();

    this.selectedState =
      rawValue === ALL_STATES_OPTION_VALUE ? "" : rawValue || DEFAULT_STATE;

    if (this.selectedState) {
      writeStateToStorage(this.selectedState);
      dispatchStateChange(this.selectedState);
    }

    this.updateResultsUrlForState(this.selectedState);
    this.clearSelectedFilters();
    this.currentPage = 1;

    await this.reloadProducts();
  }

  async handleExternalStateChange(event) {
    const nextState = String(
      event?.detail?.state || event?.detail?.selectedState || ""
    ).trim();

    if (!ALL_STATES.includes(nextState) || nextState === this.selectedState) {
      return;
    }

    this.selectedState = nextState;
    writeStateToStorage(nextState);
    this.updateResultsUrlForState(nextState);
    this.clearSelectedFilters();
    this.currentPage = 1;

    await this.reloadProducts();
  }

  async handleStorageStateChange(event) {
    if (event?.key !== this.stateStorageKey) {
      return;
    }

    const nextState = String(readStateFromStorage() || "").trim();

    if (!ALL_STATES.includes(nextState) || nextState === this.selectedState) {
      return;
    }

    this.selectedState = nextState;
    this.updateResultsUrlForState(nextState);
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

    if (!mode || (mode !== "grid" && mode !== "list")) {
      return;
    }

    this.viewMode = mode;
    this.applyPaginationAndSort();
  }

  handleToggleGroup(event) {
    const fieldApiName = event?.currentTarget?.dataset?.field;

    if (!fieldApiName) {
      return;
    }

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

    if (!field || !value) {
      return;
    }

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
    if (this.currentPage <= 1) {
      return;
    }

    this.currentPage -= 1;
    this.applyPaginationAndSort();
  }

  handleNextPage() {
    if (this.currentPage >= this.totalPages) {
      return;
    }

    this.currentPage += 1;
    this.applyPaginationAndSort();
  }

  getProductById(productId) {
    if (!productId) {
      return null;
    }

    return (
      this.productById.get(productId) ||
      this.products.find((item) => item.id === productId) ||
      null
    );
  }

  getProductDetailPath(product) {
    if (!product) {
      return "";
    }

    return sharedBuildProductDetailPath(
      product,
      this.storeName || DEFAULT_STORE_NAME
    );
  }

  handleClickProduct(event) {
    const productId = event?.currentTarget?.dataset?.pid;
    const product = this.getProductById(productId);
    const targetPath = this.getProductDetailPath(product);

    if (targetPath) {
      globalThis.window.location.href = targetPath;
    }
  }

  handleQuickShop(event) {
    event.preventDefault();
    event.stopPropagation();
    this.handleSuccessModalClose();

    const productId = event?.currentTarget?.dataset?.pid;
    const product = this.getProductById(productId);

    if (!product) {
      return;
    }

    this.modalProduct = product;
    this.modalVariationPricing = null;
    this.modalPricingLoadError = false;
    this.modalCartError = "";
    this.isModalPricingLoading = true;
    this.isModalOpen = true;

    this.loadVariationPricing(productId);
  }

  async loadVariationPricing(productId) {
    try {
      this.modalVariationPricing = await getVariationPricing({
        productId,
        webStoreId: this.webStoreId || DEFAULT_WEBSTORE_ID
      });
    } catch {
      this.modalVariationPricing = null;
      this.modalPricingLoadError = true;
    } finally {
      this.isModalPricingLoading = false;
    }
  }

  handleModalClose() {
    this.isModalOpen = false;
    this.modalProduct = null;
    this.modalVariationPricing = null;
    this.isModalPricingLoading = false;
    this.modalPricingLoadError = false;
  }

  handleSuccessModalClose() {
    this.isSuccessModalOpen = false;
    this.successModalData = null;
  }

  showAddToCartSuccessModal(productId) {
    const product = this.getProductById(productId) || this.modalProduct;

    this.successModalData = buildAddToCartSuccessModalData(
      product,
      this.storeName || DEFAULT_STORE_NAME
    );

    this.isSuccessModalOpen = true;
  }

  openModalProductDetails() {
    if (!this.modalProduct) {
      return;
    }

    const targetPath = this.getProductDetailPath(this.modalProduct);

    this.handleModalClose();

    if (targetPath) {
      globalThis.window.location.href = targetPath;
    }
  }

  handleViewDetails() {
    this.openModalProductDetails();
  }

  handleLookInside(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    globalThis.window.open(
      "https://coursewave.com/login",
      "_blank",
      "noopener"
    );
  }

  handleTrial() {
    if (!this.modalProduct) {
      return;
    }

    const trialPath = sharedBuildFreeTrialPath(
      this.modalProduct,
      this.storeName || DEFAULT_STORE_NAME
    );

    this.handleModalClose();

    if (trialPath) {
      globalThis.window.location.href = trialPath;
    }
  }

  async handleAddToCart(event) {
    if (this.isAddingToCart) {
      return;
    }

    const productId = event?.detail?.productId || this.modalProduct?.id || "";

    if (!productId) {
      return;
    }

    const requestedQty = Number.parseInt(event?.detail?.quantity, 10);
    const quantity =
      Number.isFinite(requestedQty) && requestedQty > 0 ? requestedQty : 1;

    this.isAddingToCart = true;
    this.modalCartError = "";

    try {
      const { ok: added, error } = await sharedAddProductToCart({
        productId,
        quantity,
        storeName: this.storeName || DEFAULT_STORE_NAME,
        webStoreId: this.webStoreId || DEFAULT_WEBSTORE_ID
      });

      if (added) {
        this.showAddToCartSuccessModal(productId);
      } else {
        this.modalCartError =
          error?.body?.message ||
          error?.message ||
          "Unable to add item to cart. Please try again.";
      }
    } catch (ex) {
      this.modalCartError =
        ex?.body?.message || ex?.message || "An unexpected error occurred.";
    } finally {
      this.isAddingToCart = false;
    }
  }

  resolveProductImageUrl(item) {
    const url = sharedResolveProductImageUrl(item);

    return url ? sharedNormalizeImageUrl(url) : "";
  }

  updateResultsUrlForState(stateValue) {
    if (!globalThis.window?.history) {
      return;
    }

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
      this.currentPathSearchToken =
        nextToken === "all" ? ALL_STATES_OPTION_VALUE : nextToken;
      this.lastObservedHref = this.getCurrentHref();
      return;
    }

    globalThis.window.history.pushState({}, "", nextPath);
    this.currentPathSearchToken =
      nextToken === "all" ? ALL_STATES_OPTION_VALUE : nextToken;
    this.lastObservedHref = this.getCurrentHref();
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

    if (Number.isFinite(parsed) && allowed.includes(parsed)) {
      return parsed;
    }

    return allowed[0] || DEFAULT_PAGE_SIZE;
  }

  normalizePositiveInt(value, fallback, max) {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

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

  normalizeFilterMatchValue(fieldApiName, value) {
    const normalizedField = this.normalizeFieldName(fieldApiName);
    const normalizedValue = this.normalizeSearchText(value);

    if (
      normalizedField === this.normalizeFieldName("Grade_Level__c") &&
      normalizedValue === this.normalizeSearchText("Kindergarten")
    ) {
      return this.normalizeSearchText("Grade K");
    }

    if (normalizedField === this.normalizeFieldName("Category__c")) {
      if (normalizedValue.includes("social studies")) {
        return this.normalizeSearchText("Social Studies");
      }

      if (
        normalizedValue.includes("english language arts") ||
        normalizedValue === "ela"
      ) {
        return this.normalizeSearchText("English");
      }

      if (normalizedValue.includes("mathematics")) {
        return this.normalizeSearchText("Math");
      }
    }

    return normalizedValue;
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