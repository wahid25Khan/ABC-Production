/**
 * Barrel export for ABC shared utilities.
 * Import via: import { readStateFromStorage, normalizeProduct } from 'c/utils';
 */
export {
  STATE_STORAGE_KEY,
  STATE_CHANGE_EVENT_NAMES,
  DEFAULT_WEBSTORE_ID,
  ALL_STATES,
  STATE_ABBREVIATIONS,
  ABBREVIATION_TO_STATE,
  normalizeStateName,
  readStateFromStorage,
  writeStateToStorage,
  dispatchStateChange,
  decodeUrlValue,
  getCurrentProductId,
  resolveSelectedStateFromLocation
} from "./stateHelper";

export {
  DEFAULT_STORE_NAME,
  CART_UPDATED_EVENT_NAME,
  STOREFRONT_GUEST_REQUEST_PARAMS,
  STOREFRONT_REQUEST_PARAMS,
  applyStorefrontGuestParams,
  applyStorefrontRequestParams,
  normalizeProduct,
  resolveProductImageUrl,
  extractProductList,
  buildProductDetailPath,
  buildCartPath,
  buildAddToCartSuccessModalData,
  buildAddToCartEndpoint,
  scrollCarouselToIndex,
  resolveByPath,
  toNumber,
  firstString,
  resolvePrice,
  extractPricingMap,
  formatCurrency,
  normalizeImageUrl,
  resolveStockKeepingUnit,
  resolveCurrencyIsoCode,
  parsePositiveInteger,
  enforceWebsiteMinimumQuantity,
  filterWebsitePricingTiers,
  resolveUnitPriceForQuantity,
  addProductToCart,
  dispatchCartUpdated
} from "./productHelper";

export {
  buildCartFormatLines,
  splitCartItemName,
  normalizeCartQuantityRule,
  normalizeQuantityToRule,
  buildCartIncludesLines,
  buildCartOrderSummaryLines,
  extractCartItems,
  normalizeCartSummary,
  normalizeCartItem,
  fetchStorefrontProductDetails
} from "./cartPageHelper";

export {
  openAuthPopup,
  startAuthPopupMonitor,
  stopAuthPopupMonitor,
  resolveAbsoluteUrl,
  normalizeInternalUrl,
  appendHiddenInput,
  isPopupLoginErrorUrl,
  getPopupWindowFeatures
} from "./authPopupHelper";

export {
  dispatchWishlistUpdated,
  WISHLIST_UPDATED_EVENT_NAME,
  syncFavoriteState,
  doToggleFavorite
} from "./wishlistHelper";