import { LightningElement, api } from 'lwc';
import getOrders from '@salesforce/apex/OrderHistoryController.getOrders';
import {
    DEFAULT_STORE_NAME,
    DEFAULT_WEBSTORE_ID,
    formatCurrency,
    resolveProductImageUrl,
    normalizeImageUrl
} from 'c/utils';

const RANGE_OPTIONS = [
    { label: 'Last 3 months', value: '3' },
    { label: 'Last 6 months', value: '6' },
    { label: 'Last 12 months', value: '12' },
    { label: 'Last 24 months', value: '24' },
    { label: 'All orders', value: 'all' }
];

const PRODUCT_BATCH_SIZE = 20;
const PRODUCT_FIELDS = ['StockKeepingUnit', 'Name'];

export default class AccountOrdersPage extends LightningElement {
    @api heading = 'My Orders';
    @api storeName = DEFAULT_STORE_NAME;
    @api webStoreId = DEFAULT_WEBSTORE_ID;

    isLoading = true;
    isHydrating = false;
    errorMessage = '';
    orders = [];
    selectedRange = '3';
    _productIdParamName = '';

    connectedCallback() {
        this.loadOrders();
    }

    get subtitle() {
        return 'To check the status of your school or district order please contact our Customer Service team at 888-264-5877';
    }

    get rangeOptions() {
        return RANGE_OPTIONS.map((opt) => ({
            ...opt,
            selected: opt.value === this.selectedRange
        }));
    }

    get hasOrders() {
        return this.orders.length > 0;
    }

    get showEmptyState() {
        return !this.isLoading && !this.errorMessage && !this.hasOrders;
    }

    get continueShoppingUrl() {
        return `/${this.storeName}/global-search/all`;
    }

    async handleRangeChange(event) {
        this.selectedRange = event.target.value;
        await this.loadOrders();
    }

    /* ── Phase 1: Apex + Phase 2: Commerce REST hydration ── */

    async loadOrders() {
        this.isLoading = true;
        this.errorMessage = '';

        try {
            const monthsBack = this.selectedRange === 'all' ? null : Number(this.selectedRange);
            const result = await getOrders({ monthsBack });
            const rawOrders = result || [];

            if (!rawOrders.length) {
                this.orders = [];
                return;
            }

            const allProductIds = [];

            const baseOrders = rawOrders.map((order) => {
                const items = (order.lineItems || []).map((item, idx, arr) => {
                    if (item.productId) {
                        allProductIds.push(item.productId);
                    }
                    return {
                        itemId: item.id,
                        name: item.name || 'Product',
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        displayUnitPrice: item.unitPrice != null
                            ? formatCurrency(item.unitPrice, 'USD')
                            : '$0.00',
                        productId: item.productId,
                        imageUrl: '',
                        isLast: idx === arr.length - 1
                    };
                });

                return {
                    ...order,
                    displayDate: this.formatDate(order.orderedDate),
                    displayTotal: order.grandTotalAmount != null
                        ? formatCurrency(order.grandTotalAmount, 'USD')
                        : 'Total unavailable',
                    displayStatus: this.mapStatus(order.status),
                    detailPath: `/${this.storeName}/OrderSummary/${order.id}`,
                    lineItems: items
                };
            });

            this.orders = baseOrders;
            this.isLoading = false;
            this.isHydrating = true;

            /* Phase 2: hydrate product images */
            const productMap = await this.fetchProductDetails(allProductIds);

            this.orders = baseOrders.map((order) => ({
                ...order,
                lineItems: order.lineItems.map((item) => {
                    const detail = productMap.get(item.productId);
                    let imageUrl = '';
                    if (detail) {
                        const rawUrl = resolveProductImageUrl(detail);
                        imageUrl = rawUrl ? normalizeImageUrl(rawUrl) : '';
                    }
                    return { ...item, imageUrl };
                })
            }));
        } catch (error) {
            this.orders = [];
            this.errorMessage = this.normalizeError(error);
        } finally {
            this.isLoading = false;
            this.isHydrating = false;
        }
    }

    /* ── Commerce REST: product details (images) ── */

    async fetchProductDetails(productIds) {
        const uniqueIds = [...new Set(productIds)];
        if (!uniqueIds.length) return new Map();

        const batches = this.chunkArray(uniqueIds, PRODUCT_BATCH_SIZE);
        const merged = new Map();

        const batchMaps = await Promise.all(
            batches.map((batch) => this.fetchProductBatch(batch))
        );

        for (const batchMap of batchMaps) {
            batchMap.forEach((value, key) => merged.set(key, value));
        }
        return merged;
    }

    async fetchProductBatch(productIds) {
        const paramNames = this._productIdParamName
            ? [this._productIdParamName]
            : ['ids', 'productIds'];

        for (const paramName of paramNames) {
            try {
                // eslint-disable-next-line no-await-in-loop
                const response = await fetch(
                    this.buildProductsEndpoint(productIds, paramName),
                    { method: 'GET', credentials: 'include' }
                );

                if (!response.ok) continue;

                // eslint-disable-next-line no-await-in-loop
                const data = await response.json();
                const rows =
                    data?.products ||
                    data?.productCollection?.products ||
                    data?.productPage?.products ||
                    data?.productsPage?.products ||
                    [];

                const map = new Map();
                for (const item of (Array.isArray(rows) ? rows : [])) {
                    const id = String(item?.id || '').trim();
                    if (id) map.set(id, item);
                }

                if (map.size) {
                    this._productIdParamName = paramName;
                    return map;
                }
            } catch {
                /* try next param name */
            }
        }
        return new Map();
    }

    buildProductsEndpoint(productIds, idParamName) {
        const store = this.storeName || DEFAULT_STORE_NAME;
        const wsId = this.webStoreId || DEFAULT_WEBSTORE_ID;
        const base = `/${store}/webruntime/api/services/data/v66.0/commerce/webstores/${wsId}/products`;
        const params = new URLSearchParams({ [idParamName]: productIds.join(',') });
        params.set('fields', PRODUCT_FIELDS.join(','));
        return `${base}?${params.toString()}`;
    }

    /* ── Helpers ── */

    mapStatus(status) {
        if (status === 'Activated' || status === 'Approved') {
            return 'Quote Placed';
        }
        return status || 'Processing';
    }

    formatDate(value) {
        if (!value) {
            return 'Date unavailable';
        }
        try {
            return new Intl.DateTimeFormat('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }).format(new Date(value));
        } catch {
            return 'Date unavailable';
        }
    }

    chunkArray(values, chunkSize) {
        const chunks = [];
        for (let i = 0; i < values.length; i += chunkSize) {
            chunks.push(values.slice(i, i + chunkSize));
        }
        return chunks;
    }

    normalizeError(error) {
        if (error?.body?.message) {
            return error.body.message;
        }
        if (error?.message) {
            return error.message;
        }
        return 'Please try again, or contact us for assistance.';
    }
}
