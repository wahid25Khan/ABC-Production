/**
 * Shared state-management utilities for ABC B2B Commerce LWCs.
 * Centralizes the localStorage-backed selected-state pattern used across components.
 */

const STATE_STORAGE_KEY = "abc_selected_state";
const STATE_CHANGE_EVENT_NAMES = Object.freeze([
  "abcstatechange",
  "statechange"
]);
const RESULTS_PATH_MARKER = "/global-search/";
const HOME_PATH_RE = /\/AmericanBookCompany\/?$/;

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

// Reverse map: lowercase abbreviation → full state name (e.g. "ga" → "Georgia")
const ABBREVIATION_TO_STATE = Object.freeze(
  Object.entries(STATE_ABBREVIATIONS).reduce((acc, [full, abbr]) => {
    acc[abbr.toLowerCase()] = full;
    return acc;
  }, {})
);

function isValidState(state) {
  return ALL_STATES.includes(String(state || "").trim());
}

function getStoredStateValue() {
  const storedState = readStateFromStorage();
  return isValidState(storedState) ? storedState : "";
}

function getStateFromHash(urlObj) {
  const hashValue = String(urlObj?.hash || "")
    .replace(/^#/, "")
    .trim();
  if (!hashValue) {
    return "";
  }

  const decodedHash = decodeUrlValue(hashValue);
  return isValidState(decodedHash) ? decodedHash : "";
}

function getStateFromResultsPath(urlObj) {
  const pathName = String(urlObj?.pathname || "");
  const markerIndex = pathName.indexOf(RESULTS_PATH_MARKER);
  if (markerIndex === -1) {
    return "";
  }

  const afterMarker = pathName.slice(markerIndex + RESULTS_PATH_MARKER.length);
  const firstSegment = afterMarker.split("/")[0] || "";
  const decodedSegment = decodeUrlValue(firstSegment);
  if (!decodedSegment || decodedSegment.toLowerCase() === "all") {
    return "";
  }

  if (isValidState(decodedSegment)) {
    return decodedSegment;
  }

  return ABBREVIATION_TO_STATE[decodedSegment.toLowerCase()] || "";
}

function getStateFromRefinementsList(refinementsRaw, refinementKey) {
  try {
    const refinementList = JSON.parse(decodeUrlValue(refinementsRaw));
    const stateEntry = Array.isArray(refinementList)
      ? refinementList.find((entry) => entry?.nameOrId === refinementKey)
      : null;

    if (
      stateEntry &&
      Array.isArray(stateEntry.values) &&
      stateEntry.values.length
    ) {
      const selectedState = String(stateEntry.values[0] || "").trim();
      return isValidState(selectedState) ? selectedState : "";
    }
  } catch {
    return "";
  }

  return "";
}

function getStateFromParams(urlObj, refinementKey) {
  try {
    const refinementsRaw = urlObj.searchParams.get("refinements");
    if (refinementsRaw) {
      const fromList = getStateFromRefinementsList(
        refinementsRaw,
        refinementKey
      );
      if (fromList) {
        return fromList;
      }
    }

    const refinement = urlObj.searchParams.get("refinement");
    if (refinement) {
      const decodedRefinement = decodeUrlValue(refinement);
      const prefix = `${refinementKey}:`;
      if (decodedRefinement.startsWith(prefix)) {
        const stateValue = decodedRefinement.slice(prefix.length).trim();
        return isValidState(stateValue) ? stateValue : "";
      }
    }
  } catch {
    return "";
  }

  return "";
}

export function resolveSelectedStateFromLocation({
  defaultState = "Georgia",
  refinementKey = "State__c",
  url = globalThis.location?.href
} = {}) {
  const fallbackState = isValidState(defaultState) ? defaultState : "Georgia";
  if (!url) {
    return fallbackState;
  }

  let urlObj;
  try {
    urlObj =
      url instanceof URL ? url : new URL(url, globalThis.location?.origin);
  } catch {
    return fallbackState;
  }

  const pathName = String(urlObj.pathname || "");
  const isResultsPage = pathName.includes(RESULTS_PATH_MARKER);
  const isHomePage = HOME_PATH_RE.test(pathName);

  if (isResultsPage) {
    return (
      getStateFromParams(urlObj, refinementKey) ||
      getStateFromResultsPath(urlObj) ||
      getStoredStateValue() ||
      fallbackState
    );
  }

  const hashState = getStateFromHash(urlObj);
  if (isHomePage) {
    return hashState || fallbackState;
  }

  return getStoredStateValue() || hashState || fallbackState;
}

export { STATE_STORAGE_KEY };
export { STATE_CHANGE_EVENT_NAMES };
export { DEFAULT_WEBSTORE_ID };
export { ALL_STATES };
export { STATE_ABBREVIATIONS };
export { ABBREVIATION_TO_STATE };