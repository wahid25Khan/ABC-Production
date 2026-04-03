import { LightningElement, api } from 'lwc';

const DEFAULT_STORE_NAME = 'AmericanBookCompany';
const DEFAULT_WEBSTORE_ID = '0ZEam000004dJDNGA2';
const STATE_STORAGE_KEY = 'abc_selected_state';
const PRODUCT_ID_PATTERN = /01t[a-zA-Z0-9]{12,15}/;

export default class SimilarProductsBySubject extends LightningElement {
  @api storeName = DEFAULT_STORE_NAME;
  @api webStoreId = DEFAULT_WEBSTORE_ID;
  @api maxProducts = 18;
  @api visibleCount = 6;
  @api refinementKey = 'State__c';
  @api searchTerm = '';

  products = [];

  loading = false;
  showProducts = false;
  currentIndex = 0;
  currentProductId = '';
  selectedState = '';
  selectedSubject = '';
  _effectiveVisible = 6;
  _resizeHandler = null;

  connectedCallback() {
    this._updateEffectiveVisible();
    this._resizeHandler = () => this._updateEffectiveVisible();
    globalThis.addEventListener('resize', this._resizeHandler);
    this.initialize();
  }

  disconnectedCallback() {
    if (this._resizeHandler) {
      globalThis.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
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

  get baseSearchTerm() {
    const value = String(this.searchTerm || '').trim();
    return value || '*';
  }

  get canGoLeft() {
    return this.currentIndex > 0;
  }

  get canGoRight() {
    return this.currentIndex + this._effectiveVisible < this.products.length;
  }

  _updateEffectiveVisible() {
    const innerWidth = globalThis.innerWidth ?? 1280;
    // Mirror the CSS breakpoints: <=768px caps at 2 cols, <=1200px caps at 4 cols
    let cssMax;
    if (innerWidth <= 768) {
      cssMax = 2;
    } else if (innerWidth <= 1200) {
      cssMax = 4;
    } else {
      cssMax = this.normalizedVisibleColumns;
    }
    this._effectiveVisible = Math.min(cssMax, this.normalizedVisibleColumns);
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
    return 'You might also like';
  }

  async initialize() {
    this.loading = true;

    try {
      this.currentProductId = this.getCurrentProductId();
      this.selectedState = this.getSelectedState();
      this.selectedSubject = this.getSelectedSubject();

      if (!this.selectedSubject) {
        this.resetProducts();
        return;
      }

      const fetchedProducts = await this.fetchProducts();
      this.products = fetchedProducts
        .map((item) => this.normalizeProduct(item))
        .filter(Boolean)
        .filter((item) => !this.isCurrentProduct(item))
        .filter((item) => this.matchesSubject(item))
        .slice(0, this.normalizedMaxProducts);

      this.showProducts = this.products.length > 0;
      this.currentIndex = 0;
      this.scrollToCurrentIndex('auto');
    } catch {
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

  async fetchProducts() {
    try {
      const response = await fetch(this.buildSearchEndpoint(), {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return this.extractProductList(data);
    } catch {
      return [];
    }
  }

  extractProductList(data) {
    // N7 fix: Check all 5 API response shapes (matching customResults/similarProductsByState)
    const list =
      data?.productsPage?.products ||
      data?.productPage?.products ||
      data?.productSearchResult?.products ||
      data?.searchProductResult?.products ||
      data?.products;

    return Array.isArray(list) ? list : [];
  }

  buildSearchEndpoint() {
    const storeName = this.storeName || DEFAULT_STORE_NAME;
    const webStoreId = this.webStoreId || DEFAULT_WEBSTORE_ID;
    const base = `/${storeName}/webruntime/api/services/data/v66.0/commerce/webstores/${webStoreId}/search/products`;
    const state = String(this.selectedState || '').trim();

    const params = new URLSearchParams({
      language: 'en-US',
      asGuest: 'true',
      searchTerm: this.buildSearchTermWithStateAndSubject(),
      page: '0',
      pageSize: String(this.normalizedMaxProducts + this.normalizedVisibleCount)
    });

    if (state) {
      params.set('refinement', `${this.refinementKey}:${state}`);
    }

    return `${base}?${params.toString()}`;
  }

  buildSearchTermWithStateAndSubject() {
    const terms = [];
    const base = this.baseSearchTerm;
    const state = String(this.selectedState || '').trim();
    const subject = String(this.selectedSubject || '').trim();

    if (base && base !== '*') {
      terms.push(base);
    }

    if (state) {
      terms.push(state);
    }

    if (subject) {
      terms.push(subject);
    }

    const deduped = [];
    const seen = new Set();

    for (const entry of terms) {
      const normalized = entry.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        deduped.push(entry);
      }
    }

    if (deduped.length) return deduped.join(' ');
    const fallback = String(this.searchTerm || '').trim();
    return fallback && fallback !== '*' ? fallback : 'all';
  }

  getSelectedState() {
    try {
      return (globalThis.localStorage.getItem(STATE_STORAGE_KEY) || '').trim();
    } catch {
      return '';
    }
  }

  getSelectedSubject() {
    const slug = this.getProductSlugFromPath();
    const match = /-grade-\d+-(.+)$/i.exec(slug);
    const subjectSlug = match?.[1] ?? '';

    if (!subjectSlug) {
      return '';
    }

    return subjectSlug
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ')
      .trim();
  }

  getProductSlugFromPath() {
    if (!globalThis.location?.pathname) {
      return '';
    }

    const parts = globalThis.location.pathname.split('/').filter(Boolean);
    const productIndex = parts.findIndex((segment) => segment.toLowerCase() === 'product');

    if (productIndex === -1 || productIndex + 1 >= parts.length) {
      return '';
    }

    try {
      return decodeURIComponent(parts[productIndex + 1]).trim();
    } catch {
      return parts[productIndex + 1].trim();
    }
  }

  getCurrentProductId() {
    if (!globalThis.location?.href) {
      return '';
    }

    const fromQuery = new URLSearchParams(globalThis.location.search || '').get('pid');
    if (fromQuery) {
      return fromQuery;
    }

    const fullUrl = globalThis.location.href;
    const sfProductId = PRODUCT_ID_PATTERN.exec(fullUrl);
    if (sfProductId?.[0]) {
      return sfProductId[0];
    }

    const parts = (globalThis.location?.pathname ?? '').split('/').filter(Boolean);
    const lastSegment = parts.length ? decodeURIComponent(parts.at(-1)) : '';
    return PRODUCT_ID_PATTERN.test(lastSegment) ? lastSegment : '';
  }

  normalizeProduct(item) {
    const id = String(item?.id || '').trim();
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
    const productId = String(product?.id || '').trim().toLowerCase();

    if (!currentId || !productId) {
      return false;
    }

    return currentId === productId;
  }

  matchesSubject(product) {
    const subject = String(this.selectedSubject || '').trim().toLowerCase();
    if (!subject) {
      return true;
    }

    const name = String(product?.name || '').toLowerCase();
    return name.includes(subject);
  }

  resolveProductImageUrl(item) {
    const imageUrl = item?.defaultImage?.url || item?.image?.url || item?.imageUrl || '';
    return typeof imageUrl === 'string' ? imageUrl.trim() : '';
  }

  buildProductDetailPath(product) {
    const nameSource = product.urlName || product.name || 'detail';
    const recordName = String(nameSource)
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/^-+|-+$/g, '');

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

    globalThis.location.href = this.buildProductDetailPath(product);
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

    const maxStart = Math.max(0, this.products.length - this._effectiveVisible);
    this.currentIndex = Math.min(maxStart, this.currentIndex + 1);
    this.scrollToCurrentIndex('smooth');
  }

  scrollToCurrentIndex(behavior = 'smooth') {
    globalThis.requestAnimationFrame(() => {
      const viewport = this.template.querySelector('.products-viewport');
      const track = this.template.querySelector('.products-track');
      const firstCard = this.template.querySelector('.product-card');

      if (!viewport || !track || !firstCard) {
        return;
      }

      const style = globalThis.getComputedStyle(track);
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