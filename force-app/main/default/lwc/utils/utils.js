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
  readStateFromStorage,
  writeStateToStorage,
  dispatchStateChange,
  decodeUrlValue,
  getCurrentProductId
} from "./stateHelper";

export {
  DEFAULT_STORE_NAME,
  STOREFRONT_GUEST_REQUEST_PARAMS,
  applyStorefrontGuestParams,
  normalizeProduct,
  resolveProductImageUrl,
  extractProductList,
  buildProductDetailPath,
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
  resolveUnitPriceForQuantity
} from "./productHelper";

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
  syncFavoriteState,
  doToggleFavorite
} from "./wishlistHelper";
