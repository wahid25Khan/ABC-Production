import { LightningElement, api } from 'lwc';

const PLAN = {
    COLOR: "COLOR",
    BW: "BW"
};

export default class QuickShopModal extends LightningElement {

    //  @api isOpen = false;
    // isOpen = false;
    // bookImageUrl = abc_image;

    // pass from parent if you want
    @api title = "Georgia K-12 Standards Success Grade 2 ELA";
    @api isbn = "";
    @api bookImageUrl;
    @api colorPrice;
    @api colorPriceBulk;
    @api bwPrice;
    @api bwPriceBulk;
    @api currencyIsoCode = 'USD';
    @api minimumQuantity = 10;
    @api maximumQuantity = 50;
    @api incrementQuantity = 1;

    // default tab
    selectedPlan = PLAN.COLOR;
    quantity = 10;

    isFavorite = false;
    isOpen = true;

    // features layout as screenshot
    featuresLeft = ["Answer Key", "Posttest", "Pretest"];
    featuresRight = ["eBook"];

    get minQty() {
        const parsed = Number.parseInt(this.minimumQuantity, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
    }

    get maxQty() {
        const parsed = Number.parseInt(this.maximumQuantity, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
    }

    get incrementQty() {
        const parsed = Number.parseInt(this.incrementQuantity, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    }

    get formattedUnitPrice() {
        return this.formatPrice(this.selectedUnitPrice);
    }

    get normalizedColorPrice() {
        return this.toNumber(this.colorPrice) ?? this.toNumber(this.bwPrice);
    }

    get normalizedColorPriceBulk() {
        return this.toNumber(this.colorPriceBulk) ?? this.normalizedColorPrice;
    }

    get normalizedBwPrice() {
        return this.toNumber(this.bwPrice) ?? this.normalizedColorPrice;
    }

    get normalizedBwPriceBulk() {
        return this.toNumber(this.bwPriceBulk) ?? this.normalizedBwPrice;
    }

    get isColorSelected() {
        return this.selectedPlan === PLAN.COLOR;
    }
    get isBwSelected() {
        return this.selectedPlan === PLAN.BW;
    }

    get ariaColorSelected() {
        return this.isColorSelected ? 'true' : 'false';
    }

    get ariaBwSelected() {
        return this.isBwSelected ? 'true' : 'false';
    }

    get planClassColor() {
        return `plan-option ${this.isColorSelected ? "active" : ""}`;
    }
    get planClassBw() {
        return `plan-option ${this.isBwSelected ? "active" : ""}`;
    }

    get heartIcon() {
        return this.isFavorite ? "utility:favorite" : "utility:favorite_alt";
    }

    get selectedUnitPrice() {
        const isBw = this.selectedPlan === PLAN.BW;
        const primary = isBw ? this.normalizedBwPrice : this.normalizedColorPrice;
        const secondary = isBw ? this.normalizedBwPriceBulk : this.normalizedColorPriceBulk;
        return primary ?? secondary;
    }

    // Live order total: unitPrice × (qty / increment)
    // e.g. $41 unit price, increment=10, qty=20 → 41 × (20/10) = $82
    get totalPrice() {
        const unit = this.selectedUnitPrice;
        const qty = Number(this.quantity) || this.minQty;
        const inc = this.incrementQty;
        if (!unit || !inc) return '';
        return this.formatPrice(unit * (qty / inc));
    }

    // ---------- open/close ----------

    @api open() {
        this.isOpen = true;
    }

    @api close() {
        this.isOpen = false;
        this.dispatchEvent(new CustomEvent("close"));
    }

    handleClose() {
        this.close();
    }

    handleBackdropClick() {
        this.close();
    }

    // ---------- tab selection ----------
    selectColorPlan() {
        this.applyPlan(PLAN.COLOR);
    }
    selectBwPlan() {
        this.applyPlan(PLAN.BW);
    }

    applyPlan(plan) {
        this.selectedPlan = plan;
        const qty = Number.parseInt(this.quantity, 10);
        const min = this.minQty;
        const max = this.maxQty;
        if (!Number.isFinite(qty) || qty < min) {
            this.quantity = min;
        } else if (qty > max) {
            this.quantity = max;
        }
        this.dispatchEvent(new CustomEvent("planchange", { detail: { plan } }));
    }

    // ---------- qty ----------
    handleQtyChange(e) {
        let val = Number.parseInt(e.target.value, 10);
        if (Number.isNaN(val)) val = this.minQty;

        const min = this.minQty;
        const max = this.maxQty;
        const inc = this.incrementQty;

        if (val < min) val = min;
        if (val > max) val = max;

        // Snap to nearest valid increment step
        if (inc > 1) {
            const steps = Math.round((val - min) / inc);
            val = min + (steps * inc);
            if (val > max) val = min + (Math.floor((max - min) / inc) * inc);
            if (val < min) val = min;
        }

        this.quantity = val;
    }

    // ---------- actions ----------
    handleAddToCart() {
        this.dispatchEvent(
            new CustomEvent("addtocart", {
                detail: {
                    plan: this.selectedPlan,
                    quantity: this.quantity,
                    isbn: this.isbn,
                    title: this.title,
                    unitPrice: this.selectedUnitPrice,
                    currencyIsoCode: this.currencyIsoCode || 'USD'
                }
            })
        );
    }

    handleTrial() {
        this.dispatchEvent(
            new CustomEvent("trial", {
                detail: { plan: this.selectedPlan, isbn: this.isbn, title: this.title }
            })
        );
    }

    handleViewDetails() {
        this.dispatchEvent(
            new CustomEvent("viewdetails", { detail: { isbn: this.isbn, title: this.title } })
        );
    }

    toggleFavorite() {
        this.isFavorite = !this.isFavorite;
        this.dispatchEvent(new CustomEvent("favoritechange", { detail: { favorite: this.isFavorite } }));
    }

    // ESC close
    connectedCallback() {
        this.quantity = this.minQty;
        this._handleKeydown = (evt) => {
            if (this.isOpen && evt.key === "Escape") this.close();
        };
        globalThis.window.addEventListener("keydown", this._handleKeydown);
    }

    disconnectedCallback() {
        globalThis.window.removeEventListener("keydown", this._handleKeydown);
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

        const normalized = Number(String(value).replaceAll(/[^0-9.-]/g, ''));
        return Number.isFinite(normalized) ? normalized : null;
    }

    formatPrice(value) {
        const normalized = this.toNumber(value);
        if (normalized === null) {
            return '—';
        }

        const currency = this.currencyIsoCode || 'USD';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(normalized);
    }
}