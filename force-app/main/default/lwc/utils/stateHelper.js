/**
 * Shared state-management utilities for ABC B2B Commerce LWCs.
 * Centralizes the localStorage-backed selected-state pattern used across components.
 */

const STATE_STORAGE_KEY = "abc_selected_state";

/**
 * Read the user-selected US state from localStorage.
 * @returns {string} The trimmed state value, or empty string if unavailable.
 */
export function readStateFromStorage() {
  try {
    return (globalThis.localStorage.getItem(STATE_STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

/**
 * Write the selected US state to localStorage.
 * @param {string} state — The state name to persist.
 */
export function writeStateToStorage(state) {
  try {
    globalThis.localStorage.setItem(
      STATE_STORAGE_KEY,
      String(state || "").trim()
    );
  } catch {
    // Storage unavailable — silently fail.
  }
}

/**
 * Decode a URL-encoded value, iterating up to 3 rounds of decoding.
 * @param {string} value — The potentially-encoded string.
 * @returns {string} The decoded string, or empty string if falsy.
 */
export function decodeUrlValue(value) {
  let decoded = String(value || "").trim();
  if (!decoded) {
    return "";
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const nextValue = decodeURIComponent(decoded);
      if (nextValue === decoded) {
        break;
      }
      decoded = nextValue.trim();
    } catch {
      break;
    }
  }

  return decoded;
}

/**
 * Extract a Salesforce Product2 ID from the current page URL.
 * Checks query param `pid`, regex match in URL, and last path segment.
 * @returns {string} The product ID or empty string.
 */
const PRODUCT_ID_PATTERN = /01t[a-zA-Z0-9]{12,15}/;

export function getCurrentProductId() {
  if (typeof globalThis === "undefined" || !globalThis.location?.href) {
    return "";
  }

  const fromQuery = new URLSearchParams(globalThis.location.search || "").get(
    "pid"
  );
  if (fromQuery) {
    return fromQuery;
  }

  const sfProductId = PRODUCT_ID_PATTERN.exec(globalThis.location.href);
  if (sfProductId?.[0]) {
    return sfProductId[0];
  }

  const parts = (globalThis.location.pathname || "").split("/").filter(Boolean);
  const lastSegment = parts.length ? decodeURIComponent(parts.at(-1)) : "";
  return PRODUCT_ID_PATTERN.test(lastSegment) ? lastSegment : "";
}

export { STATE_STORAGE_KEY };
