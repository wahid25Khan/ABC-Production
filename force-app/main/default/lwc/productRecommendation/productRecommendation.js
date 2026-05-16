import { LightningElement, api, wire } from "lwc";
import { CurrentPageReference } from 'lightning/navigation';
import { ProductRecommendationsAdapter, ANCHOR_TYPES } from 'commerce/recommendationsApi';
import {
  normalizeProduct,
  extractProductList,
  buildProductDetailPath,
  scrollCarouselToIndex,
  DEFAULT_WEBSTORE_ID,
  DEFAULT_STORE_NAME
} from "c/utils";

export default class ProductRecommendation extends LightningElement {
  @api storeName = DEFAULT_STORE_NAME;
  @api webStoreId = DEFAULT_WEBSTORE_ID;
  @api recommender = "RecentlyViewed";
  @api anchorValues = "";
  @api maxProducts = 18;
  @api visibleCount = 6;

  currentRecordId = null;
  products = [];
  loading = true;
  loadError = false;
  currentIndex = 0;

  @wire(CurrentPageReference)
  getStateParameters(currentPageReference) {
    if (currentPageReference?.attributes?.recordId) {
      this.currentRecordId = currentPageReference.attributes.recordId;
    }
  }

  @wire(ProductRecommendationsAdapter, {
    recommenderName: 'recently-viewed',
    anchorType: ANCHOR_TYPES.NO_CONTEXT,
    anchorValue: null
  })
  async loadRecommendation({ data, error }) {
    try {
      if (data?.products?.length > 0) {
        const fetchedProducts = extractProductList(data);

        this.products = fetchedProducts
          .map((item) => normalizeProduct({
            ...item,
            "name": item?.fields?.Name || "",
            "productClass": item?.fields?.ProductClass || "",
            "sku": item?.fields?.StockKeepingUnit || "",
            "success": true
          }))
          .filter(item => (!this.currentRecordId || this.currentRecordId !== item.id))
          .slice(0, this.normalizedMaxProducts);

        this.currentIndex = 0;

        if (this.showProducts) 
          scrollCarouselToIndex(this.template, this.currentIndex, "auto");
      } else if (error) {
        console.log('RECENTLY VIEWED ERROR: ', error?.message);
      }
    } catch (ex) {
      console.log('RECENTLY VIEWED ERROR: ', ex?.message);
    } finally {
      this.loading = false;
    }
  }

  get showProducts() {
    return (this.products || []).length > 0;
  }

  get headingText() {
    const count = this.products.length;
    return `Recently Viewed (${count})`;
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
    return (
      this.currentIndex + this.normalizedVisibleCount < this.products.length
    );
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

  get showEmptyState() {
    return !this.loading && !this.showProducts;
  }

  get emptyStateText() {
    return this.loadError
      ? "We couldn't load your recently viewed books right now."
      : "Browse a few books and your recently viewed books will appear here.";
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

    globalThis.location.href = buildProductDetailPath(product, this.storeName || DEFAULT_STORE_NAME);
  }

  handlePrev() {
    if (!this.canGoLeft) {
      return;
    }

    this.currentIndex = Math.max(0, this.currentIndex - 1);
    scrollCarouselToIndex(this.template, this.currentIndex, "smooth");
  }

  handleNext() {
    if (!this.canGoRight) {
      return;
    }

    const maxStart = Math.max(
      0,
      this.products.length - this.normalizedVisibleCount
    );
    this.currentIndex = Math.min(maxStart, this.currentIndex + 1);
    scrollCarouselToIndex(this.template, this.currentIndex, "smooth");
  }
}