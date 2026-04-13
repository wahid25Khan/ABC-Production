/**
 * Shared state-management utilities for ABC B2B Commerce LWCs.
 * Centralizes the localStorage-backed selected-state pattern used across components.
 */

const STATE_STORAGE_KEY = "abc_selected_state";
const STATE_CHANGE_EVENT_NAMES = Object.freeze(["abcstatechange", "statechange"]);

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
 * Publish the shared selected-state event contract used across storefront LWCs.
 * @param {string} state - The selected state name.
 */
export function dispatchStateChange(state) {
  const normalizedState = String(state || "").trim();
  if (!normalizedState || typeof globalThis === "undefined") {
    return;
  }

  STATE_CHANGE_EVENT_NAMES.forEach((eventName) => {
    globalThis.dispatchEvent(
      new CustomEvent(eventName, {
        detail: {
          state: normalizedState,
          selectedState: normalizedState
        }
      })
    );
  });
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

const DEFAULT_WEBSTORE_ID = "0ZEam000004dJDNGA2";

const ALL_STATES = Object.freeze([
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "District of Columbia",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming"
]);

const STATE_ABBREVIATIONS = Object.freeze({
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  "District of Columbia": "DC",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY"
});

export { STATE_STORAGE_KEY };
export { STATE_CHANGE_EVENT_NAMES };
export { DEFAULT_WEBSTORE_ID };
export { ALL_STATES };
export { STATE_ABBREVIATIONS };