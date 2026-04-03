import { LightningElement, api } from 'lwc';

const DEFAULT_STORE_NAME = 'AmericanBookCompany';
const DEFAULT_WEBSTORE_ID = '0ZEam000004dJDNGA2';

export default class ProductRecommendation extends LightningElement {
  @api storeName = DEFAULT_STORE_NAME;
  @api webStoreId = DEFAULT_WEBSTORE_ID;
  @api recommender = 'RecentlyViewed';
  @api anchorValues = '';
  @api maxProducts = 18;
  @api visibleCount = 6;

  products = [];
  loading = false;
  showProducts = false;
  currentIndex = 0;

  connectedCallback() {
    this.loadProductRecommendations();
  }

  get headingText() {
    return 'Recently Viewed';
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

  async loadProductRecommendations() {
    this.loading = true;

    try {
      const endpoint = this.buildEndpoint();

      const response = await fetch(endpoint, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const fetchedProducts = this.extractProductList(data);

      this.products = fetchedProducts
        .map((item) => this.normalizeProduct(item))
        .filter((item) => Boolean(item))
        .slice(0, this.normalizedMaxProducts);

      this.showProducts = this.products.length > 0;
      this.currentIndex = 0;
      this.scrollToCurrentIndex('auto');
    } catch (error) {
      // N8 fix: Log the error instead of silently discarding it
      console.warn('ProductRecommendation: failed to load recommendations.', error?.message || error);
      this.products = [];
      this.showProducts = false;
      this.currentIndex = 0;
    } finally {
      this.loading = false;
    }
  }

  extractProductList(data) {
    const list =
      data?.productsPage?.products ||
      data?.productPage?.products ||
      data?.productSearchResult?.products ||
      data?.searchProductResult?.products ||
      data?.products;

    return Array.isArray(list) ? list : [];
  }

  normalizeProduct(item) {
    const id = String(item?.id || '').trim();
    if (!id) {
      return null;
    }

    const name = String(item.name || '').trim() || 'Untitled';
    const urlName = String(item.urlName || item.slug || '').trim();
    const imageUrl = this.resolveProductImageUrl(item);

    return {
      ...item,
      id,
      name,
      urlName,
      imageUrl
    };
  }

  resolveProductImageUrl(item) {
    const imageUrl = item?.defaultImage?.url || item?.image?.url || item?.imageUrl || '';
    return typeof imageUrl === 'string' ? imageUrl.trim() : '';
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

  buildProductDetailPath(product) {
    const nameSource = product.urlName || product.name || 'detail';
    const recordName = String(nameSource)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return `/${this.storeName || DEFAULT_STORE_NAME}/product/${recordName || 'detail'}/${product.id}`;
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

  buildEndpoint() {
    const storeName = this.storeName || DEFAULT_STORE_NAME;
    const webStoreId = this.webStoreId || DEFAULT_WEBSTORE_ID;
    const baseUrl = `/${storeName}/webruntime/api/services/data/v66.0/commerce/webstores/${webStoreId}/ai/recommendations`;
    const recommendersToSend = this.recommender || 'RecentlyViewed';
    const params = new URLSearchParams({
      language: 'en-US',
      asGuest: 'true',
      recommender: recommendersToSend
    });

    if (this.anchorValues) {
      params.append('anchorValues', this.anchorValues);
    }

    return `${baseUrl}?${params.toString()}`;
  }
}