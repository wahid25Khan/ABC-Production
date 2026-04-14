import { LightningElement, api } from "lwc";
import {
  normalizeProduct as sharedNormalizeProduct,
  resolveProductImageUrl as sharedResolveProductImageUrl,
  normalizeImageUrl,
  extractProductList,
  buildProductDetailPath,
  applyStorefrontGuestParams,
  getCurrentProductId,
  DEFAULT_WEBSTORE_ID,
  DEFAULT_STORE_NAME
} from "c/utils";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const US_STATES = [
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" }, { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" }, { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" }, { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" }, { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" }, { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" }, { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" }, { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" }, { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" }, { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" }, { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" }, { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" }, { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" }, { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" }, { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" }, { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" }, { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" }, { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" }, { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" }, { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" }, { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" }, { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" }, { value: "WY", label: "Wyoming" },
  { value: "DC", label: "District of Columbia" }
];

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export default class FreeTrialPage extends LightningElement {
  @api storeName = DEFAULT_STORE_NAME;
  @api webStoreId = DEFAULT_WEBSTORE_ID;
  @api loginUrl = "/login";

  loading = true;
  product = null;
  errorMessage = "";
  successMessage = "";
  isSubmitting = false;

  form = {
    sampleType: "Physical",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    organizationName: "",
    streetAddress: "",
    city: "",
    stateCode: "",
    postalCode: "",
    referralInfo: "",
    comments: ""
  };

  connectedCallback() {
    this.initialize();
  }

  get productName() {
    return this.product?.name || "";
  }

  get bookImageUrl() {
    return this.product?.imageUrl || "";
  }

  get productDetailUrl() {
    if (!this.product) return "";
    return buildProductDetailPath(this.product, this.storeName || DEFAULT_STORE_NAME);
  }

  get isPhysicalSelected() {
    return this.form.sampleType === "Physical";
  }

  get isDigitalSelected() {
    return this.form.sampleType === "Digital";
  }

  get usStates() {
    return US_STATES.map(st => ({
      ...st,
      selected: st.value === this.form.stateCode
    }));
  }

  // ─── Initialization ───────────────────────────────────────────

  async initialize() {
    this.loading = true;
    try {
      const productId = this.resolveCurrentProductId();
      if (!productId) {
        this.loading = false;
        return;
      }

      const rawProduct = await this.fetchProductDetails(productId);
      if (rawProduct) {
        this.product = this.normalizeProduct(rawProduct);
      }
    } catch {
      // product info is optional; form still works
    } finally {
      this.loading = false;
    }
  }

  resolveCurrentProductId() {
    if (typeof globalThis === "undefined" || !globalThis.location?.href) {
      return "";
    }

    const queryParams = new URLSearchParams(globalThis.location.search || "");
    const fromQuery = queryParams.get("productId") || queryParams.get("pid");
    if (fromQuery) return String(fromQuery).trim();

    return getCurrentProductId();
  }

  async fetchProductDetails(productId) {
    const endpoints = [
      this.buildProductsEndpoint([productId], "ids"),
      this.buildProductsEndpoint([productId], "productIds")
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "GET",
          credentials: "include"
        });
        if (!response.ok) continue;

        const data = await response.json();
        const products = extractProductList(data);
        if (products.length) return products[0];
      } catch {
        // try next endpoint
      }
    }
    return null;
  }

  buildProductsEndpoint(productIds, idParamName) {
    const store = this.storeName || DEFAULT_STORE_NAME;
    const webStore = this.webStoreId || DEFAULT_WEBSTORE_ID;
    const base = `/${store}/webruntime/api/services/data/v66.0/commerce/webstores/${webStore}/products`;
    const params = applyStorefrontGuestParams(
      new URLSearchParams({ [idParamName]: productIds.join(",") })
    );
    params.set("fields", "StockKeepingUnit,Name");
    return `${base}?${params.toString()}`;
  }

  normalizeProduct(item) {
    const base = sharedNormalizeProduct(item);
    if (!base) return null;

    const imageUrl = sharedResolveProductImageUrl(item);
    return {
      ...base,
      imageUrl: imageUrl ? normalizeImageUrl(imageUrl) : ""
    };
  }

  // ─── Form handlers ────────────────────────────────────────────

  handleSampleTypeChange(event) {
    this.form = { ...this.form, sampleType: event.target.value };
  }

  handleFieldChange(event) {
    const { name } = event.target;
    const value = event.target.value;
    this.form = { ...this.form, [name]: value };
    this.errorMessage = "";
    event.target.classList.remove("input-error");
  }

  validateForm() {
    this.clearFieldErrors();

    const required = [
      ["firstName", "First Name is required."],
      ["lastName", "Last Name is required."],
      ["email", "Email is required."],
      ["phone", "Phone is required."],
      ["organizationName", "Organization name is required."],
      ["streetAddress", "Street Address is required."],
      ["city", "City is required."],
      ["stateCode", "State is required."],
      ["postalCode", "ZIP Code is required."]
    ];

    for (const [fieldName, message] of required) {
      if (!normalizeText(this.form[fieldName])) {
        this.markFieldInvalid(fieldName);
        this.errorMessage = message;
        return false;
      }
    }

    if (!EMAIL_PATTERN.test(normalizeText(this.form.email))) {
      this.markFieldInvalid("email");
      this.errorMessage = "Please enter a valid email address.";
      return false;
    }

    return true;
  }

  clearFieldErrors() {
    this.template.querySelectorAll(".field-input").forEach(el => {
      el.classList.remove("input-error");
    });
  }

  markFieldInvalid(fieldName) {
    const field = this.template.querySelector(`[data-field="${fieldName}"]`);
    field?.classList.add("input-error");
    field?.focus();
  }

  async handleSubmit() {
    if (this.isSubmitting) return;
    if (!this.validateForm()) return;

    this.isSubmitting = true;
    this.errorMessage = "";
    this.successMessage = "";

    try {
      // Placeholder: In a production build, wire this to an Apex method
      // that creates a Lead/Case or sends a notification email.
      await new Promise(resolve => {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        globalThis.setTimeout(resolve, 800);
      });

      this.successMessage = "Your free trial request has been submitted! We\u2019ll be in touch shortly.";
    } catch {
      this.errorMessage = "Unable to submit your request. Please try again.";
    } finally {
      this.isSubmitting = false;
    }
  }
}