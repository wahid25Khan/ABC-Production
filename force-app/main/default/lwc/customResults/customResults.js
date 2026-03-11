import { LightningElement, api, track } from 'lwc';

const DEFAULT_STORE_NAME = 'AmericanBookCompany';
const DEFAULT_WEBSTORE_ID = '0ZEam000004dJDNGA2';
const DEFAULT_STATE_STORAGE_KEY = 'abc_selected_state';
const DEFAULT_PAGE_SIZE = 20;
const SEARCH_MARKER = '/global-search/';
const URL_WATCH_INTERVAL_MS = 250;
const URL_WATCH_DEBOUNCE_MS = 120;

const SEARCH_FIELDS = [
  'StockKeepingUnit'
];

const PRODUCT_DETAIL_FIELDS = [
  'StockKeepingUnit',
  'Grade_Level__c',
  'Category__c',
  'Series__c',
  'State__c',
  'purchaseQuantityRule'
];

const PRODUCT_DETAIL_BATCH_SIZE = 20;

const GRADE_FILTER_VALUES = [
  'Kindergarten',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12'
];

const CATEGORY_FILTER_VALUES = [
  'English',
  'Math',
  'Reading',
  'Social Studies',
  'Science',
  'Writing'
];

const SERIES_FILTER_VALUES = [
  'ACAP Success',
  'ACT',
  'ACT Achievement',
  'Adult Basic Curriculum',
  'Basics Made Easy',
  'CCGPS',
  'CCRA Success',
  'Common Core',
  'EXPLORE',
  'Foundations',
  'GSE Success',
  'Gearing Up',
  'ILeap/Leap',
  'K-PREP',
  'K-PREP/QualityCore',
  'KSA Success',
  'LEAP 2025',
  'LEAP Success',
  'Milestones',
  'OCCT/EOI',
  'OSTP Success',
  'PARCC',
  'PLAN',
  'SCPASS',
  'Smarter Balanced',
  'TAS Success',
  'TCAP Success',
  'EOC',
  'MCA',
  'EOG',
  'EOCEP',
  'Get READY',
  'New Mexico Success',
  'K-12 Standards Success',
  'ATLAS Success',
  'EOC Success',
  'SCCCRS Success',
  'SOL'
];

const US_STATES = [
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'District of Columbia',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming'
];

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  return [];
}

function chunkArray(values, chunkSize) {
  const normalizedSize = Number.parseInt(chunkSize, 10);
  const size = Number.isFinite(normalizedSize) && normalizedSize > 0 ? normalizedSize : values.length || 1;
  const chunks = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

export default class CustomResults extends LightningElement {
  @api storeName = DEFAULT_STORE_NAME;
  @api webStoreId = DEFAULT_WEBSTORE_ID;
  @api defaultSearchTerm = 'all';
  @api stateStorageKey = DEFAULT_STATE_STORAGE_KEY;

  @api stateFieldApiName = 'State__c';
  @api filterFieldApiNames = 'Grade_Level__c,Category__c,Series__c';
  @api filterFieldLabels = 'Grade Level,Subject,Series';
  @api searchFieldApiNames = SEARCH_FIELDS.join(',');

  @api pageSizeOptions = '20,40,60';
  @api defaultPageSize = DEFAULT_PAGE_SIZE;
  @api fetchPageSize = 120;
  @api maxFetchPages = 8;
  @api cartStateOrId = 'current';

  @track loading = false;
  @track products = [];
  @track visibleProducts = [];
  @track filterGroups = [];
  @track stateOptions = [];

  @track selectedState = '';
  @track searchText = '';
  @track sortValue = 'relevance';
  @track pageSizeValue = DEFAULT_PAGE_SIZE;
  @track currentPage = 1;
  @track totalResults = 0;
  @track totalPages = 1;
  @track showingStart = 0;
  @track showingEnd = 0;
  @track viewMode = 'grid';

  @track isModalOpen = false;
  @track modalProduct = null;

  stateProducts = [];
  selectedFiltersByField = {};
  collapsedByField = {};
  filterDefinitions = [];
  filterValueCatalog = {};
  productById = new Map();
  filterIndexByField = {};
  productDetailIdParamName = null;
  currentPathSearchToken = '';
  lastObservedHref = '';
  urlWatchId = null;
  urlWatchDebounceId = null;

  connectedCallback() {
    this.captureCurrentRouteState();
    this.initialize();
    this.startUrlWatcher();
  }

  disconnectedCallback() {
    this.stopUrlWatcher();
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
      return 'Showing 0 results';
    }

    return `Showing ${this.showingStart} to ${this.showingEnd} of ${this.totalResults} — Page ${this.currentPage} of ${this.totalPages}`;
  }

  get productsClass() {
    return this.viewMode === 'list' ? 'products products-list' : 'products products-grid';
  }

  get isGridView() {
    return this.viewMode === 'grid';
  }

  get isListView() {
    return this.viewMode === 'list';
  }

  get sortOptions() {
    return [
      { label: 'Relevance', value: 'relevance' },
      { label: 'Name (A-Z)', value: 'name-asc' },
      { label: 'Name (Z-A)', value: 'name-desc' }
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
    return this.modalProduct ? this.modalProduct.name : '';
  }

  get modalIsbn() {
    if (!this.modalProduct) {
      return '';
    }

    return this.firstString([
      this.modalProduct.sku,
      this.modalProduct.isbn,
      this.resolveByPath(this.modalProduct, 'fields.StockKeepingUnit')
    ]);
  }

  get modalImageUrl() {
    return this.modalProduct ? this.modalProduct.imageUrl : '';
  }

  get modalColorPrice() {
    return this.modalProduct ? this.modalProduct.colorPrice : null;
  }

  get modalColorPriceBulk() {
    return this.modalProduct ? this.modalProduct.colorPriceBulk : null;
  }

  get modalBwPrice() {
    return this.modalProduct ? this.modalProduct.bwPrice : null;
  }

  get modalBwPriceBulk() {
    return this.modalProduct ? this.modalProduct.bwPriceBulk : null;
  }

  get modalCurrencyIsoCode() {
    return this.modalProduct ? this.modalProduct.currencyIsoCode || 'USD' : 'USD';
  }

  // Read quantity rules from OOB purchaseQuantityRule returned by the Commerce Products API.
  // Falls back to sensible defaults when no ProductQuantityRule is assigned to the product.
  get modalMinimumQuantity() {
    const rule = this.modalProduct?.purchaseQuantityRule;
    const ruleMin = rule?.minimum ?? rule?.Minimum ?? null;
    if (Number.isFinite(ruleMin) && ruleMin > 0) return ruleMin;
    return 10;
  }

  get modalMaximumQuantity() {
    const rule = this.modalProduct?.purchaseQuantityRule;
    const ruleMax = rule?.maximum ?? rule?.Maximum ?? null;
    // Ignore values > 9999 which indicate "no maximum" in Salesforce (stored as e.g. 100,000,000)
    if (Number.isFinite(ruleMax) && ruleMax > 0 && ruleMax <= 9999) return ruleMax;
    return 50;
  }

  get modalIncrementQuantity() {
    const rule = this.modalProduct?.purchaseQuantityRule;
    const ruleInc = rule?.increment ?? rule?.Increment ?? null;
    if (Number.isFinite(ruleInc) && ruleInc > 0) return ruleInc;
    return 1;
  }

  get normalizedBaseSearchTerm() {
    const value = String(this.defaultSearchTerm || '').trim();
    return !value || value.toLowerCase() === 'all' ? '*' : value;
  }

  async initialize() {
    this.loading = true;

    try {
      this.filterDefinitions = this.buildFilterDefinitions();
      this.pageSizeValue = this.resolveInitialPageSize();
      this.stateOptions = [{ label: 'All States', value: '' }, ...US_STATES.map((value) => ({ label: value, value }))];
      this.selectedState = this.readStateFromStorage();

      const initialResponse = await this.loadStateProducts();
      this.stateProducts = initialResponse.products;
      this.rebuildProductIndexes();

      this.filterValueCatalog = this.buildStaticFilterCatalog(initialResponse.facets);
      this.rebuildFilterGroups();
      this.applyLocalFiltersAndPagination();
    } catch (_error) {
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

    if (normalized === this.normalizeFieldName('Grade_Level__c')) {
      return GRADE_FILTER_VALUES;
    }

    if (normalized === this.normalizeFieldName('Category__c')) {
      return CATEGORY_FILTER_VALUES;
    }

    if (normalized === this.normalizeFieldName('Series__c')) {
      return SERIES_FILTER_VALUES;
    }

    return [];
  }

  getFacetCountMap(facets, fieldApiName) {
    const facetList = toArray(facets);
    const fieldKey = this.normalizeFieldName(fieldApiName);
    const counts = new Map();

    facetList.forEach((facet) => {
      const facetKey = this.normalizeFieldName(facet?.nameOrId || '');
      if (facetKey !== fieldKey) {
        return;
      }

      toArray(facet?.values).forEach((entry) => {
        const value = this.firstString([entry?.displayName, entry?.nameOrId]);
        const count = Number.parseInt(entry?.productCount, 10);
        if (!value) {
          return;
        }

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
      const data = await this.fetchSearchResponse(criteria, page, pageSize);
      const pageProducts = this.extractProductList(data);

      if (page === 0) {
        facets = this.extractFacetList(data);
      }

      if (!pageProducts.length) {
        break;
      }

      pageProducts.forEach((row) => {
        const id = String(row?.id || '').trim();
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
    const response = await this.fetchAllProducts(this.buildStateSearchCriteria());
    const hydratedProducts = await this.hydrateProductsWithFields(response.products);
    const baseProducts = hydratedProducts.map((item) => this.normalizeProduct(item)).filter(Boolean);
    const products = await this.enrichProductsWithPricing(baseProducts);

    return {
      facets: response.facets,
      products
    };
  }

  async fetchSearchResponse(criteria, page, pageSize) {
    try {
      const response = await fetch(this.buildSearchEndpoint(criteria, page, pageSize), {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        return {};
      }

      return await response.json();
    } catch (_error) {
      return {};
    }
  }

  async enrichProductsWithPricing(products) {
    const productIds = products.map((item) => item.id).filter((id) => Boolean(id));
    if (!productIds.length) {
      return products;
    }

    const pricingMap = await this.fetchPricingForProducts(productIds);
    if (!pricingMap.size) {
      return products;
    }

    return products.map((product) => {
      const priceInfo = pricingMap.get(product.id);
      if (!priceInfo) {
        return product;
      }

      const basePrice =
        priceInfo.unitPrice ??
        priceInfo.salesPrice ??
        priceInfo.negotiatedPrice ??
        priceInfo.listPrice ??
        product.listPrice ??
        product.startingPrice;

      return {
        ...product,
        currencyIsoCode: priceInfo.currencyIsoCode || product.currencyIsoCode || 'USD',
        listPrice: priceInfo.listPrice ?? product.listPrice ?? basePrice ?? null,
        startingPrice: basePrice ?? product.startingPrice ?? null,
        colorPrice: basePrice ?? product.colorPrice ?? product.listPrice ?? null,
        colorPriceBulk:
          priceInfo.listPrice ??
          basePrice ??
          product.colorPriceBulk ??
          product.colorPrice ??
          product.listPrice ??
          null,
        bwPrice: basePrice ?? product.bwPrice ?? product.listPrice ?? null,
        bwPriceBulk:
          priceInfo.listPrice ??
          basePrice ??
          product.bwPriceBulk ??
          product.bwPrice ??
          product.listPrice ??
          null
      };
    });
  }

  async fetchPricingForProducts(productIds) {
    try {
      const response = await fetch(this.buildPricingEndpoint(productIds), {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        return new Map();
      }

      const data = await response.json();
      return this.extractPricingMap(data);
    } catch (_error) {
      return new Map();
    }
  }

  buildPricingEndpoint(productIds) {
    const base = `/${this.storeName || DEFAULT_STORE_NAME}/webruntime/api/services/data/v66.0/commerce/webstores/${this.webStoreId || DEFAULT_WEBSTORE_ID}/pricing/products`;
    const params = new URLSearchParams({
      productIds: productIds.join(',')
    });

    return `${base}?${params.toString()}`;
  }

  async hydrateProductsWithFields(products) {
    const ids = toArray(products)
      .map((item) => String(item?.id || '').trim())
      .filter(Boolean);

    if (!ids.length) {
      return toArray(products);
    }

    const hydratedMap = await this.fetchProductFieldMap(ids);
    if (!hydratedMap.size) {
      return toArray(products);
    }

    return toArray(products).map((item) => {
      const hydrated = hydratedMap.get(String(item?.id || '').trim());
      if (!hydrated) {
        return item;
      }

      return {
        ...item,
        ...hydrated,
        fields: hydrated.fields && Object.keys(hydrated.fields).length
          ? hydrated.fields
          : item.fields
      };
    });
  }

  async fetchProductFieldMap(productIds) {
    const ids = [...new Set(toArray(productIds).map((item) => String(item || '').trim()).filter(Boolean))];
    if (!ids.length) {
      return new Map();
    }

    const merged = new Map();
    const batches = chunkArray(ids, PRODUCT_DETAIL_BATCH_SIZE);

    for (const batch of batches) {
      const batchMap = await this.fetchProductFieldBatch(batch);
      batchMap.forEach((value, key) => {
        merged.set(key, value);
      });
    }

    return merged;
  }

  async fetchProductFieldBatch(productIds) {
    const idParamNames = this.productDetailIdParamName
      ? [this.productDetailIdParamName]
      : ['ids', 'productIds'];

    for (const idParamName of idParamNames) {
      try {
        const response = await fetch(this.buildProductsEndpoint(productIds, idParamName), {
          method: 'GET',
          credentials: 'include'
        });

        if (!response.ok) {
          continue;
        }

        const data = await response.json();
        const rows = this.extractProductCollection(data);
        const map = new Map();

        rows.forEach((item) => {
          const id = String(item?.id || '').trim();
          if (id) {
            map.set(id, item);
          }
        });

        if (map.size) {
          this.productDetailIdParamName = idParamName;
          return map;
        }
      } catch (_error) {
        // try the next supported query shape
      }
    }

    return new Map();
  }

  buildProductsEndpoint(productIds, idParamName) {
    const base = `/${this.storeName || DEFAULT_STORE_NAME}/webruntime/api/services/data/v66.0/commerce/webstores/${this.webStoreId || DEFAULT_WEBSTORE_ID}/products`;
    const params = new URLSearchParams({
      [idParamName]: productIds.join(',')
    });

    params.set('fields', PRODUCT_DETAIL_FIELDS.join(','));

    return `${base}?${params.toString()}`;
  }

  buildSearchEndpoint(criteria, page, pageSize) {
    const base = `/${this.storeName || DEFAULT_STORE_NAME}/webruntime/api/services/data/v66.0/commerce/webstores/${this.webStoreId || DEFAULT_WEBSTORE_ID}/search/products`;

    const params = new URLSearchParams({
      language: 'en-US',
      asGuest: 'true',
      searchTerm: criteria.searchTerm,
      page: String(page),
      pageSize: String(pageSize)
    });

    this.applyRefinementsToParams(params, criteria.refinements);

    const fieldList = this.getSearchFields();
    if (fieldList.length) {
      params.set('fields', fieldList.join(','));
    }

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

    if (this.normalizedBaseSearchTerm !== '*') {
      terms.push(this.normalizedBaseSearchTerm);
    }

    if (this.selectedState) {
      terms.push(this.selectedState);
    } else if (this.normalizedBaseSearchTerm === '*') {
      terms.push('all');
    }

    if (!terms.length) {
      terms.push('all');
    }

    const deduped = [];
    const seen = new Set();

    terms.forEach((term) => {
      const normalized = String(term || '').trim();
      if (!normalized) {
        return;
      }

      const key = normalized.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(normalized);
      }
    });

    return deduped.length ? deduped.join(' ') : '*';
  }

  getPathSearchToken() {
    if (typeof window === 'undefined' || !window.location?.pathname) {
      return '';
    }

    const path = window.location.pathname;
    const markerIndex = path.indexOf(SEARCH_MARKER);
    if (markerIndex < 0) {
      return '';
    }

    const after = path.slice(markerIndex + SEARCH_MARKER.length);
    const token = (after.split('/')[0] || '').trim();
    if (!token || token.toLowerCase() === 'all') {
      return '';
    }

    return this.decodeSearchPathSegment(token);
  }

  decodeSearchPathSegment(value) {
    let decoded = String(value || '').replace(/\+/g, ' ').trim();
    if (!decoded) {
      return '';
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const nextValue = decodeURIComponent(decoded);
        if (nextValue === decoded) {
          break;
        }

        decoded = nextValue.replace(/\+/g, ' ').trim();
      } catch (_error) {
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
    const routeSearchText = this.currentPathSearchToken || this.getPathSearchToken();

    if (routeSearchText) {
      tokens.push(...this.tokenizeSearchText(routeSearchText));
    }

    if (this.searchText) {
      tokens.push(...this.tokenizeSearchText(this.searchText));
    }

    return [...new Set(tokens)];
  }

  getCurrentHref() {
    return typeof window === 'undefined' || !window.location?.href ? '' : window.location.href;
  }

  startUrlWatcher() {
    if (typeof window === 'undefined' || this.urlWatchId) {
      return;
    }

    this.captureCurrentRouteState();
    this.urlWatchId = window.setInterval(() => {
      const href = this.getCurrentHref();
      if (!href || href === this.lastObservedHref) {
        return;
      }

      this.lastObservedHref = href;
      window.clearTimeout(this.urlWatchDebounceId);
      this.urlWatchDebounceId = window.setTimeout(() => {
        this.handleObservedUrlChange();
      }, URL_WATCH_DEBOUNCE_MS);
    }, URL_WATCH_INTERVAL_MS);
  }

  stopUrlWatcher() {
    if (typeof window === 'undefined') {
      return;
    }

    window.clearInterval(this.urlWatchId);
    window.clearTimeout(this.urlWatchDebounceId);
    this.urlWatchId = null;
    this.urlWatchDebounceId = null;
  }

  async handleObservedUrlChange() {
    const nextPathSearchToken = this.getPathSearchToken();
    if (nextPathSearchToken === this.currentPathSearchToken) {
      return;
    }

    this.currentPathSearchToken = nextPathSearchToken;
    this.currentPage = 1;
    this.applyLocalFiltersAndPagination();
  }

  buildStateRefinements() {
    const result = {};

    if (this.selectedState) {
      result[this.stateFieldApiName] = [this.selectedState];
    }

    return result;
  }

  applyRefinementsToParams(params, refinementMap) {
    Object.entries(refinementMap || {}).forEach(([field, values]) => {
      const uniqueValues = [...new Set(toArray(values).map((item) => String(item).trim()).filter(Boolean))];
      if (!field || !uniqueValues.length) {
        return;
      }

      uniqueValues.forEach((value) => {
        params.append('refinement', `${field}:${value}`);
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
    const id = String(item?.id || '').trim();
    if (!id) {
      return null;
    }

    const name = String(item?.name || '').trim() || 'Untitled';
    const imageUrl = this.resolveProductImageUrl(item);
    const sku = this.resolveStockKeepingUnit(item);
    const currencyIsoCode = this.resolveCurrencyIsoCode(item);

    const listPrice = this.resolvePrice(item, [
      'prices.listPrice',
      'prices.pricebookPrice',
      'fields.Price__c',
      'price'
    ]);
    const salesPrice = this.resolvePrice(item, [
      'prices.salesPrice',
      'prices.unitPrice',
      'prices.unitAdjustedPrice',
      'price'
    ]);
    const negotiatedPrice = this.resolvePrice(item, [
      'prices.negotiatedPrice',
      'prices.unitPrice',
      'prices.salesPrice'
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
      urlName: String(item?.urlName || item?.slug || '').trim(),
      imageUrl,
      currencyIsoCode,
      listPrice,
      startingPrice,
      colorPrice: startingPrice,
      colorPriceBulk: listPrice ?? startingPrice,
      bwPrice: startingPrice,
      bwPriceBulk: listPrice ?? startingPrice,
      filterValues,
      searchTerms
    };
  }

  buildProductFilterValues(item) {
    const gradeValues = this.resolveProductTextValues(item, [
      'fields.Grade_Level__c'
    ]);
    const categoryValues = this.resolveProductTextValues(item, [
      'fields.Category__c'
    ]);
    const seriesValues = this.resolveProductTextValues(item, [
      'fields.Series__c'
    ]);

    return {
      Grade_Level__c: gradeValues,
      Category__c: categoryValues,
      Series__c: seriesValues
    };
  }

  resolveProductTextValues(item, paths) {
    const values = [];

    paths.forEach((path) => {
      this.collectResolvedText(this.resolveByPath(item, path), values);
    });

    return [...new Set(values)];
  }

  collectResolvedText(value, values) {
    if (value === null || value === undefined || value === '') {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => this.collectResolvedText(entry, values));
      return;
    }

    if (typeof value === 'object') {
      if (typeof value.displayValue === 'string' && value.displayValue.trim()) {
        values.push(value.displayValue.trim().toLowerCase());
        return;
      }

      if (typeof value.value === 'string' && value.value.trim()) {
        values.push(value.value.trim().toLowerCase());
        return;
      }

      Object.values(value).forEach((entry) => this.collectResolvedText(entry, values));
      return;
    }

    const normalized = String(value).trim().toLowerCase();
    if (normalized) {
      values.push(normalized);
    }
  }

  resolveCurrencyIsoCode(item) {
    const resolved = this.firstString([
      this.resolveByPath(item, 'prices.currencyIsoCode'),
      this.resolveByPath(item, 'fields.CurrencyIsoCode'),
      item?.currencyIsoCode
    ]);

    return resolved || 'USD';
  }

  resolveStockKeepingUnit(item) {
    return this.firstString([
      item?.sku,
      item?.stockKeepingUnit,
      this.resolveByPath(item, 'fields.StockKeepingUnit')
    ]);
  }

  buildProductSearchTerms(item, context = {}) {
    const parts = [];
    const filterValues = context?.filterValues || {};
    const categoryValues = toArray(filterValues.Category__c);

    this.collectSearchText(item?.name, parts);
    this.collectSearchText(context?.sku, parts);
    this.collectSearchText(item?.urlName, parts);
    this.collectSearchText(this.resolveByPath(item, 'fields.Name'), parts);
    this.collectSearchText(this.resolveByPath(item, 'fields.State__c'), parts);
    this.collectSearchText(filterValues.Grade_Level__c, parts);
    this.collectSearchText(categoryValues, parts);
    this.collectSearchText(filterValues.Series__c, parts);

    categoryValues.forEach((value) => {
      if (value === 'math') {
        parts.push('mathematics');
      } else if (value === 'english') {
        parts.push('english language arts');
        parts.push('ela');
      }
    });

    return this.tokenizeSearchText(parts.join(' '));
  }

  collectSearchText(value, parts) {
    if (value === null || value === undefined || value === '') {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => this.collectSearchText(entry, parts));
      return;
    }

    if (typeof value === 'object') {
      if (typeof value.displayValue === 'string' && value.displayValue.trim()) {
        parts.push(value.displayValue.trim());
        return;
      }

      if (typeof value.value === 'string' && value.value.trim()) {
        parts.push(value.value.trim());
        return;
      }

      Object.values(value).forEach((entry) => this.collectSearchText(entry, parts));
      return;
    }

    const normalized = String(value).trim();
    if (normalized) {
      parts.push(normalized);
    }
  }

  normalizeSearchText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  tokenizeSearchText(value) {
    const normalized = this.normalizeSearchText(value);
    return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
  }

  rebuildFilterGroups() {
    this.filterGroups = this.filterDefinitions.map((definition) => {
      const selected = new Set(this.selectedFiltersByField[definition.key] || []);
      const options = (this.filterValueCatalog[definition.key] || []).map((entry) => ({
        key: `${definition.key}-${entry.value}`,
        value: entry.value,
        label: entry.value,
        count: entry.count,
        checked: selected.has(entry.value)
      }));

      return {
        key: definition.key,
        label: definition.label,
        collapsed: Boolean(this.collapsedByField[definition.key]),
        expanded: !this.collapsedByField[definition.key],
        toggleSymbol: this.collapsedByField[definition.key] ? '+' : '−',
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
      const productId = String(product?.id || '').trim();
      if (!productId) {
        return;
      }

      this.productById.set(productId, product);

      this.filterDefinitions.forEach((definition) => {
        const fieldMap = this.filterIndexByField[definition.key];
        const values = toArray(product?.filterValues?.[definition.key]).map((value) =>
          String(value || '').trim().toLowerCase()
        ).filter(Boolean);

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
        .map((value) => String(value || '').trim().toLowerCase())
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
        return;
      }

      candidateIds = this.intersectSets(candidateIds, fieldMatches);
    });

    const products = candidateIds === null
      ? [...this.stateProducts]
      : Array.from(candidateIds)
        .map((id) => this.productById.get(id))
        .filter(Boolean);

    if (!searchTokens.length) {
      return products;
    }

    return products.filter((product) => {
      return searchTokens.every((token) => this.productMatchesSearchToken(product, token));
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
      return terms.some((term) => term === normalizedToken || term.startsWith(normalizedToken));
    }

    if (terms.some((term) => term === normalizedToken || term.startsWith(normalizedToken) || term.includes(normalizedToken))) {
      return true;
    }

    return terms.some((term) => this.isFuzzySearchMatch(normalizedToken, term));
  }

  isFuzzySearchMatch(queryToken, candidateToken) {
    const left = this.normalizeSearchText(queryToken);
    const right = this.normalizeSearchText(candidateToken);

    if (!left || !right) {
      return false;
    }

    if (left === right) {
      return true;
    }

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
          matrix[row][col] = Math.min(matrix[row][col], matrix[row - 2][col - 2] + 1);
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

    const [smaller, larger] = left.size <= right.size ? [left, right] : [right, left];
    smaller.forEach((value) => {
      if (larger.has(value)) {
        result.add(value);
      }
    });

    return result;
  }

  applyPaginationAndSort() {
    const sorted = this.sortProducts(this.products);
    this.totalResults = sorted.length;

    const pageSizes = this.getPageSizeValues();
    if (!pageSizes.includes(this.pageSizeValue)) {
      this.pageSizeValue = pageSizes[0] || DEFAULT_PAGE_SIZE;
    }

    this.totalPages = Math.max(1, Math.ceil(this.totalResults / this.pageSizeValue));
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
      priceLabel: this.formatCurrency(product.startingPrice, product.currencyIsoCode),
      cardClass: this.viewMode === 'list' ? 'product-card product-card-list' : 'product-card'
    }));
  }

  sortProducts(products) {
    const sorted = [...products];

    if (this.sortValue === 'name-asc') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (this.sortValue === 'name-desc') {
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
    } catch (_error) {
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
    const nextValue = event?.target?.value ?? event?.detail?.value ?? '';
    this.searchText = String(nextValue);
    if (this.tokenizeSearchText(this.searchText).length) {
      this.clearSelectedFilters();
    }
    this.currentPage = 1;
    this.applyLocalFiltersAndPagination();
  }

  handleSearchKeydown(event) {
    if (event?.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    this.handleSearchInput(event);
  }

  async handleStateChange(event) {
    this.selectedState = String(event?.detail?.value || '').trim();
    this.writeStateToStorage(this.selectedState);
    this.updateResultsUrlForState(this.selectedState);
    this.clearSelectedFilters();
    this.currentPage = 1;
    await this.reloadProducts();
  }

  handleSortChange(event) {
    this.sortValue = event?.detail?.value || 'relevance';
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
    if (!mode || (mode !== 'grid' && mode !== 'list')) {
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
    if (!productId) {
      return null;
    }

    return this.productById.get(productId) || this.products.find((item) => item.id === productId) || null;
  }

  handleQuickShop(event) {
    event.preventDefault();
    event.stopPropagation();

    const productId = event?.currentTarget?.dataset?.pid;
    const product = this.getProductById(productId);
    if (!product) {
      return;
    }

    this.modalProduct = product;
    this.isModalOpen = true;

    window.requestAnimationFrame(() => {
      const modal = this.template.querySelector('c-quick-shop-modal');
      if (modal && typeof modal.open === 'function') {
        modal.open();
      }
    });
  }

  handleModalClose() {
    this.isModalOpen = false;
    this.modalProduct = null;
  }

  handleViewDetails() {
    if (!this.modalProduct) {
      return;
    }

    window.location.href = this.buildProductDetailPath(this.modalProduct);
  }

  async handleAddToCart(event) {
    const productId = this.modalProduct?.id || '';
    if (!productId) {
      return;
    }

    const requestedQty = Number.parseInt(event?.detail?.quantity, 10);
    const quantity = Number.isFinite(requestedQty) && requestedQty > 0 ? requestedQty : 1;

    const added = await this.addProductToCart(productId, quantity);
    if (added) {
      this.handleModalClose();
    }
  }

  async addProductToCart(productId, quantity) {
    const payload = {
      productId,
      quantity,
      type: 'Product'
    };

    try {
      const response = await fetch(this.buildAddToCartEndpoint(this.cartStateOrId || 'current'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      return response.ok;
    } catch (_error) {
      return false;
    }
  }

  buildAddToCartEndpoint(cartStateOrId) {
    return `/${this.storeName || DEFAULT_STORE_NAME}/webruntime/api/services/data/v66.0/commerce/webstores/${this.webStoreId || DEFAULT_WEBSTORE_ID}/carts/${cartStateOrId}/cart-items`;
  }

  resolveProductImageUrl(item) {
    const candidates = [item?.defaultImage?.url, item?.image?.url, item?.imageUrl];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return this.normalizeImageUrl(candidate.trim());
      }
    }

    const groups = toArray(item?.mediaGroups);
    for (const group of groups) {
      const mediaItems = toArray(group?.mediaItems);
      for (const mediaItem of mediaItems) {
        const url = mediaItem?.url || mediaItem?.image?.url;
        if (typeof url === 'string' && url.trim()) {
          return this.normalizeImageUrl(url.trim());
        }
      }
    }

    return '';
  }

  normalizeImageUrl(url) {
    const value = String(url || '').trim().replace(/\s/g, '%20');
    if (!value) {
      return '';
    }

    if (/^(https?:|data:)/i.test(value)) {
      return value;
    }

    if (value.startsWith('//')) {
      return `https:${value}`;
    }

    if (typeof window !== 'undefined' && window.location?.origin) {
      if (value.startsWith('/')) {
        return `${window.location.origin}${value}`;
      }

      return `${window.location.origin}/${value.replace(/^\/+/, '')}`;
    }

    return value;
  }

  readStateFromStorage() {
    try {
      const value = String(window.localStorage.getItem(this.stateStorageKey || DEFAULT_STATE_STORAGE_KEY) || '').trim();
      return US_STATES.includes(value) ? value : '';
    } catch (_error) {
      return '';
    }
  }

  writeStateToStorage(value) {
    try {
      window.localStorage.setItem(this.stateStorageKey || DEFAULT_STATE_STORAGE_KEY, value || '');
    } catch (_error) {
      // no-op
    }
  }

  updateResultsUrlForState(stateValue) {
    if (typeof window === 'undefined' || !window.history) {
      return;
    }

    const nextToken = String(stateValue || '').trim() || 'all';
    const currentPath = window.location?.pathname || '';
    const markerIndex = currentPath.indexOf(SEARCH_MARKER);
    const basePath = markerIndex >= 0
      ? currentPath.slice(0, markerIndex + SEARCH_MARKER.length)
      : `/${this.storeName || DEFAULT_STORE_NAME}${SEARCH_MARKER}`;
    const nextPath = `${basePath}${encodeURIComponent(nextToken)}`;

    if (currentPath === nextPath && !window.location?.search && !window.location?.hash) {
      this.currentPathSearchToken = nextToken === 'all' ? '' : nextToken;
      this.lastObservedHref = this.getCurrentHref();
      return;
    }

    window.history.pushState({}, '', nextPath);
    this.currentPathSearchToken = nextToken === 'all' ? '' : nextToken;
    this.lastObservedHref = this.getCurrentHref();
  }

  buildProductDetailPath(product) {
    const source = product?.urlName || product?.name || 'detail';
    const slug = String(source)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return `/${this.storeName || DEFAULT_STORE_NAME}/product/${slug || 'detail'}/${product.id}`;
  }

  formatCurrency(amount, currencyIsoCode) {
    if (!Number.isFinite(amount)) {
      return '—';
    }

    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyIsoCode || 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (_error) {
      return `$${amount.toFixed(2)}`;
    }
  }

  getPageSizeValues() {
    const values = parseCsv(this.pageSizeOptions)
      .map((item) => Number.parseInt(item, 10))
      .filter((item) => Number.isFinite(item) && item > 0);

    return values.length ? [...new Set(values)].sort((a, b) => a - b) : [20, 40, 60];
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
    const normalized = String(value || '').replace(/__c$/, '');
    return normalized
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Filter';
  }

  normalizeFieldName(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  extractPricingMap(data) {
    const root = data && typeof data === 'object' ? data : {};
    const rows = Array.isArray(root.pricingLineItemResults)
      ? root.pricingLineItemResults
      : Array.isArray(root.pricingResults)
        ? root.pricingResults
        : [];

    const pricingByProductId = new Map();

    for (const row of rows) {
      const productId = String(
        row?.productId ||
          row?.pricingLineItem?.productId ||
          row?.product?.id ||
          row?.product?.productId ||
          ''
      ).trim();

      if (!productId) {
        continue;
      }

      pricingByProductId.set(productId, {
        currencyIsoCode: this.firstString([row?.currencyIsoCode, root?.currencyIsoCode]) || 'USD',
        listPrice: this.resolvePrice(row, ['listPrice', 'pricebookPrice', 'listUnitPrice']),
        salesPrice: this.resolvePrice(row, ['salesPrice', 'unitPrice', 'unitAdjustedPrice', 'price']),
        negotiatedPrice: this.resolvePrice(row, ['negotiatedPrice']),
        unitPrice: this.resolvePrice(row, ['unitPrice', 'salesPrice', 'unitAdjustedPrice', 'price'])
      });
    }

    return pricingByProductId;
  }

  resolvePrice(source, paths) {
    for (const path of paths) {
      const value = this.resolveByPath(source, path);
      const normalized = this.toNumber(value);
      if (normalized !== null) {
        return normalized;
      }
    }

    return null;
  }

  resolveByPath(source, path) {
    if (!source || !path) {
      return undefined;
    }

    return path.split('.').reduce((acc, key) => {
      if (acc && typeof acc === 'object' && key in acc) {
        return acc[key];
      }

      return undefined;
    }, source);
  }

  toNumber(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'object') {
      if (typeof value.amount === 'number' && Number.isFinite(value.amount)) {
        return value.amount;
      }

      if (typeof value.value === 'number' && Number.isFinite(value.value)) {
        return value.value;
      }
    }

    const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  firstString(values) {
    for (const value of values || []) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }

      if (value && typeof value === 'object') {
        if (typeof value.value === 'string' && value.value.trim()) {
          return value.value.trim();
        }

        if (typeof value.displayValue === 'string' && value.displayValue.trim()) {
          return value.displayValue.trim();
        }
      }
    }

    return '';
  }
}