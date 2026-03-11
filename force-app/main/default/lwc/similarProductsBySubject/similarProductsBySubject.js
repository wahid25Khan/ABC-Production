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

  get baseSearchTerm() {
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
        .filter((item) => Boolean(item))
        .filter((item) => !this.isCurrentProduct(item))
        .filter((item) => this.matchesSubject(item))
        .slice(0, this.normalizedMaxProducts);

      this.showProducts = this.products.length > 0;
      this.currentIndex = 0;
      this.scrollToCurrentIndex('auto');
    } catch (e) {
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
    } catch (e) {
      return [];
    }
  }

  extractProductList(data) {
    const list = data?.productsPage?.products || data?.productPage?.products;

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

    return deduped.length ? deduped.join(' ') : '*';
  }

  getSelectedState() {
    try {
      return (window.localStorage.getItem(STATE_STORAGE_KEY) || '').trim();
    } catch (e) {
      return '';
    }
  }

  getSelectedSubject() {
    const slug = this.getProductSlugFromPath();
    const match = slug.match(/-grade-[0-9]+-(.+)$/i);
    const subjectSlug = match && match[1] ? match[1] : '';

    if (!subjectSlug) {
      return '';
    }

    return subjectSlug
      .split('-')
      .filter((part) => Boolean(part))
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ')
      .trim();
  }

  getProductSlugFromPath() {
    if (typeof window === 'undefined' || !window.location || !window.location.pathname) {
      return '';
    }

    const parts = window.location.pathname.split('/').filter((segment) => Boolean(segment));
    const productIndex = parts.findIndex((segment) => segment.toLowerCase() === 'product');

    if (productIndex === -1 || productIndex + 1 >= parts.length) {
      return '';
    }

    try {
      return decodeURIComponent(parts[productIndex + 1]).trim();
    } catch (e) {
      return parts[productIndex + 1].trim();
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