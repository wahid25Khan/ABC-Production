/**
 * Barrel export for ABC shared utilities.
 * Import via: import { readStateFromStorage, normalizeProduct } from 'c/utils';
 */
export {
  STATE_STORAGE_KEY,
  readStateFromStorage,
  writeStateToStorage,
  decodeUrlValue,
  getCurrentProductId
} from "./stateHelper";

export {
  DEFAULT_STORE_NAME,
  normalizeProduct,
  resolveProductImageUrl,
  extractProductList,
  buildProductDetailPath,
  scrollCarouselToIndex
} from "./productHelper";
