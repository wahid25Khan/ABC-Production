import { LightningElement, api, track } from 'lwc';

const DEFAULT_STORE_NAME = 'AmericanBookCompany';
const DEFAULT_WEBSTORE_ID = '0ZEam000004dJDNGA2';
const STATE_STORAGE_KEY = 'abc_selected_state';
const PRODUCT_ID_PATTERN = /01t[a-zA-Z0-9]{12,15}/;

export default class SimilarProductsByState extends LightningElement {
  @api storeName = DEFAULT_STORE_NAME;
  @api webStoreId = DEFAULT_WEBSTORE_ID;
  @api maxProducts = 18;
  @api visibleCount = 6;
  @api refinementKey = 'State__c';
  @api searchTerm = '';

  @track products = [];

  loading = false;
  showProducts = false;
  currentIndex = 0;
  currentProductId = '';
  selectedState = '';

  connectedCallback() {
    this.initialize();
  }

  get normalizedMaxProducts() {
    const parsed = Number.parseInt(this.maxProducts, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 18;
  }

  get normalizedVisibleCount() {
    const parsed = Number.parseInt(this.visibleCount, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 6;
  }

  get normalizedVisibleColumns() {
    return Math.min(8, Math.max(1, this.normalizedVisibleCount));
  }

  get normalizedSearchTerm() {
    const value = String(this.searchTerm || '').trim();
    return value || '*';
  }

  get canGoLeft() {
    return this.currentIndex > 0;
  }

  get canGoRight() {
    return this.currentIndex + this.normalizedVisibleCount < this.products.length;
  }

  get disablePrev() {
    return !this.canGoLeft;
  }

  get disableNext() {
    return !this.canGoRight;
  }

  get productsTrackClass() {
    return `products-track columns-${this.normalizedVisibleColumns}`;
  }

  get headingText() {
    const state = (this.selectedState || '').trim();
    return state ? `Looking for additional ${state} books?` : 'Looking for additional books?';
  }

  async initialize() {
    this.loading = true;

    try {
      this.currentProductId = this.getCurrentProductId();
      this.selectedState = this.resolveSelectedState();

      if (!this.selectedState) {
        this.resetProducts();
        return;
      }

      const fetchedProducts = await this.fetchProductsByState(this.selectedState);
      this.products = fetchedProducts
        .map((item) => this.normalizeProduct(item))
        .filter((item) => Boolean(item))
        .filter((item) => !this.isCurrentProduct(item))
        .slice(0, this.normalizedMaxProducts);

      this.showProducts = this.products.length > 0;
      this.currentIndex = 0;
      this.scrollToCurrentIndex('auto');
    } catch (error) {
      this.resetProducts();
    } finally {
      this.loading = false;
    }
  }

  resetProducts() {
    this.products = [];
    this.showProducts = false;
    this.currentIndex = 0;
  }

  resolveSelectedState() {
    const fromStorage = this.readStateFromStorage();
    if (fromStorage) {
      return fromStorage;
    }

    return this.getStateFromPath();
  }

  async fetchProductsByState(stateValue) {
    try {
      const response = await fetch(this.buildSearchEndpoint(stateValue), {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return this.extractProductList(data);
    } catch (e) {
      return [];
    }
  }

  extractProductList(data) {
    if (!data || typeof data !== 'object') {
      return [];
    }

    const list =
      data.productsPage?.products ||
      data.productPage?.products ||
      data.productSearchResult?.products ||
      data.searchProductResult?.products ||
      data.products;

    return Array.isArray(list) ? list : [];
  }

  buildSearchEndpoint(stateValue) {
    const storeName = this.storeName || DEFAULT_STORE_NAME;
    const webStoreId = this.webStoreId || DEFAULT_WEBSTORE_ID;
    const base = `/${storeName}/webruntime/api/services/data/v66.0/commerce/webstores/${webStoreId}/search/products`;
    const params = new URLSearchParams({
      language: 'en-US',
      asGuest: 'true',
      searchTerm: this.buildSearchTermWithState(stateValue),
      page: '0',
      pageSize: String(this.normalizedMaxProducts + this.normalizedVisibleCount),
      refinement: `${this.refinementKey}:${stateValue}`
    });

    return `${base}?${params.toString()}`;
  }

  buildSearchTermWithState(stateValue) {
    const state = String(stateValue || '').trim();
    const baseSearchTerm = this.normalizedSearchTerm;

    if (!state) {
      return baseSearchTerm;
    }

    if (baseSearchTerm === '*') {
      return state;
    }

    if (baseSearchTerm.toLowerCase().includes(state.toLowerCase())) {
      return baseSearchTerm;
    }

    return `${baseSearchTerm} ${state}`;
  }

  readStateFromStorage() {
    try {
      return (window.localStorage.getItem(STATE_STORAGE_KEY) || '').trim();
    } catch (e) {
      return '';
    }
  }

  getStateFromPath() {
    if (typeof window === 'undefined' || !window.location || !window.location.pathname) {
      return '';
    }

    const path = window.location.pathname;
    const marker = '/global-search/';
    const markerIndex = path.indexOf(marker);

    if (markerIndex === -1) {
      return '';
    }

    const afterMarker = path.slice(markerIndex + marker.length);
    const firstSegment = afterMarker.split('/')[0] || '';

    if (!firstSegment || firstSegment.toLowerCase() === 'all') {
      return '';
    }

    try {
      return decodeURIComponent(firstSegment).trim();
    } catch (e) {
      return firstSegment.trim();
    }
  }

  getCurrentProductId() {
    if (typeof window === 'undefined' || !window.location || !window.location.href) {
      return '';
    }

    const fromQuery = new URLSearchParams(window.location.search || '').get('pid');
    if (fromQuery) {
      return fromQuery;
    }

    const fullUrl = window.location.href;
    const sfProductId = fullUrl.match(PRODUCT_ID_PATTERN);
    if (sfProductId && sfProductId[0]) {
      return sfProductId[0];
    }

    const parts = (window.location.pathname || '').split('/').filter((segment) => Boolean(segment));
    const lastSegment = parts.length ? decodeURIComponent(parts[parts.length - 1]) : '';
    return PRODUCT_ID_PATTERN.test(lastSegment) ? lastSegment : '';
  }

  normalizeProduct(item) {
    const id = String(item.id || '').trim();
    if (!id) {
      return null;
    }

    const name = String(item.name || '').trim() || 'Untitled';
    const imageUrl = this.resolveProductImageUrl(item);
    const urlName = String(item.urlName || item.slug || '').trim();

    return {
      ...item,
      id,
      name,
      imageUrl,
      urlName
    };
  }

  isCurrentProduct(product) {
    const currentId = String(this.currentProductId || '').trim().toLowerCase();
    const productId = String(product && product.id ? product.id : '').trim().toLowerCase();

    if (!currentId || !productId) {
      return false;
    }

    return currentId === productId;
  }

  resolveProductImageUrl(item) {
    const directCandidates = [
      item.defaultImage && item.defaultImage.url,
      item.image && item.image.url,
      item.imageUrl
    ];

    for (const value of directCandidates) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    const mediaGroups = Array.isArray(item.mediaGroups) ? item.mediaGroups : [];
    for (const group of mediaGroups) {
      const mediaItems = group && Array.isArray(group.mediaItems) ? group.mediaItems : [];
      for (const media of mediaItems) {
        const url = media && (media.url || (media.image && media.image.url));
        if (typeof url === 'string' && url.trim()) {
          return url.trim();
        }
      }
    }

    return '';
  }

  buildProductDetailPath(product) {
    const nameSource = product.urlName || product.name || 'detail';
    const recordName = String(nameSource)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return `/${this.storeName || DEFAULT_STORE_NAME}/product/${recordName || 'detail'}/${product.id}`;
  }

  handleClickProduct(event) {
    const productId = event.currentTarget.dataset.pid;
    if (!productId) {
      return;
    }

    const product = this.products.find((item) => item.id === productId);
    if (!product) {
      return;
    }

    window.location.href = this.buildProductDetailPath(product);
  }

  handlePrev() {
    if (!this.canGoLeft) {
      return;
    }

    this.currentIndex = Math.max(0, this.currentIndex - 1);
    this.scrollToCurrentIndex('smooth');
  }

  handleNext() {
    if (!this.canGoRight) {
      return;
    }

    const maxStart = Math.max(0, this.products.length - this.normalizedVisibleCount);
    this.currentIndex = Math.min(maxStart, this.currentIndex + 1);
    this.scrollToCurrentIndex('smooth');
  }

  scrollToCurrentIndex(behavior = 'smooth') {
    window.requestAnimationFrame(() => {
      const viewport = this.template.querySelector('.products-viewport');
      const track = this.template.querySelector('.products-track');
      const firstCard = this.template.querySelector('.product-card');

      if (!viewport || !track || !firstCard) {
        return;
      }

      const style = window.getComputedStyle(track);
      const gapValue = style.columnGap || style.gap || '0';
      const gap = Number.parseFloat(gapValue) || 0;
      const cardWidth = firstCard.getBoundingClientRect().width;
      const left = Math.max(0, this.currentIndex * (cardWidth + gap));

      viewport.scrollTo({
        left,
        behavior
      });
    });
  }
}