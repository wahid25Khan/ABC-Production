/**
 * Shared OAuth popup authentication utilities.
 * Used by accountLoginFormPopupFlow and createAccountRegistration.
 */
import { decodeUrlValue } from "./stateHelper";

const AUTH_POPUP_WIDTH = 560;
const AUTH_POPUP_HEIGHT = 720;
const AUTH_POPUP_POLL_INTERVAL = 500;

/**
 * Open a centered OAuth popup and start monitoring for completion.
 * Falls back to full-page redirect if the popup is blocked.
 *
 * @param {object} host — The LWC component instance (provides authPopup / authPopupMonitorId state).
 * @param {string} url — The OAuth URL to open.
 * @param {string} popupName — Window name for the popup.
 * @param {object} options
 * @param {Function} options.buildAuthUrl — (url) => resolved auth URL string.
 * @param {Function} options.onCompletion — (nextUrl) => called when the popup completes.
 * @param {Function} [options.onCloseWithoutCompletion] — called when the popup closes before a completion URL can be read.
 */
export function openAuthPopup(
  host,
  url,
  popupName,
  { buildAuthUrl, onCompletion, onCloseWithoutCompletion }
) {
  const resolvedUrl = buildAuthUrl(url);
  if (!resolvedUrl) {
    return;
  }

  const popup = globalThis.open?.(
    resolvedUrl,
    popupName,
    getPopupWindowFeatures()
  );

  if (popup && typeof popup.focus === "function") {
    startAuthPopupMonitor(host, popup, onCompletion, onCloseWithoutCompletion);
    popup.focus();
    return;
  }

  globalThis.location.assign(resolvedUrl);
}

/**
 * Start polling the popup window for same-origin completion.
 */
export function startAuthPopupMonitor(
  host,
  popup,
  onCompletion,
  onCloseWithoutCompletion
) {
  stopAuthPopupMonitor(host);
  host.authPopup = popup;
  host.authPopupMonitorId = globalThis.setInterval(() => {
    const nextUrl = getAuthPopupCompletionUrl(host, popup);
    if (nextUrl) {
      stopAuthPopupMonitor(host);
      try {
        popup.close?.();
      } catch {
        // ignore
      }
      onCompletion(nextUrl);
      return;
    }

    if (popup.closed) {
      stopAuthPopupMonitor(host);
      onCloseWithoutCompletion?.();
    }
  }, AUTH_POPUP_POLL_INTERVAL);
}

/**
 * Stop the popup polling monitor and clean up references.
 */
export function stopAuthPopupMonitor(host) {
  if (host.authPopupMonitorId) {
    globalThis.clearInterval(host.authPopupMonitorId);
    host.authPopupMonitorId = null;
  }
  host.authPopup = null;
}

/**
 * Resolve a possibly-relative URL to an absolute URL.
 */
export function resolveAbsoluteUrl(url) {
  if (!url) {
    return "";
  }

  try {
    return new URL(url, globalThis.location.origin).toString();
  } catch {
    return "";
  }
}

/**
 * Normalize a URL to an internal same-origin relative path.
 * Prepends the site base path if missing.
 */
export function normalizeInternalUrl(value) {
  const decodedValue = decodeUrlValue(value);
  if (!decodedValue) {
    return "";
  }

  if (decodedValue.startsWith("/")) {
    const basePath = getSiteBasePath();
    if (
      basePath &&
      decodedValue !== basePath &&
      !decodedValue.startsWith(`${basePath}/`)
    ) {
      return `${basePath}${decodedValue}`;
    }
    return decodedValue;
  }

  try {
    const parsed = new URL(decodedValue, globalThis.location.origin);
    return parsed.origin === globalThis.location.origin
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : "";
  } catch {
    return "";
  }
}

/**
 * Get the first path segment as the site base path.
 */
export function getSiteBasePath() {
  const currentPath = String(globalThis.location?.pathname || "").trim();
  const segments = currentPath.split("/").filter(Boolean);
  return segments.length ? `/${segments[0]}` : "";
}

/**
 * Create a hidden input element and append it to a form.
 */
export function appendHiddenInput(ownerDocument, form, name, value) {
  const input = ownerDocument.createElement("input");
  input.type = "hidden";
  input.name = name;
  input.value = value;
  form.appendChild(input);
}

/**
 * Check if the popup URL has an error param indicating a login failure.
 */
export function isPopupLoginErrorUrl(popupUrl, loginActionUrl) {
  const loginUrl = resolveAbsoluteUrl(loginActionUrl);
  if (!loginUrl) {
    return false;
  }

  const loginPath = new URL(loginUrl).pathname;
  if (popupUrl.pathname !== loginPath) {
    return false;
  }

  const params = popupUrl.searchParams;
  return params.has("error") || params.has("loginError") || params.has("ec");
}

/**
 * Compute centered popup window features string.
 */
export function getPopupWindowFeatures() {
  const screenLeft = globalThis.screenLeft ?? globalThis.screenX ?? 0;
  const screenTop = globalThis.screenTop ?? globalThis.screenY ?? 0;
  const outerWidth =
    globalThis.outerWidth || globalThis.screen?.availWidth || 1280;
  const outerHeight =
    globalThis.outerHeight || globalThis.screen?.availHeight || 800;
  const left = Math.max(
    screenLeft + Math.round((outerWidth - AUTH_POPUP_WIDTH) / 2),
    0
  );
  const top = Math.max(
    screenTop + Math.round((outerHeight - AUTH_POPUP_HEIGHT) / 2),
    0
  );

  return [
    "popup=yes",
    "resizable=yes",
    "scrollbars=yes",
    `width=${AUTH_POPUP_WIDTH}`,
    `height=${AUTH_POPUP_HEIGHT}`,
    `left=${left}`,
    `top=${top}`
  ].join(",");
}

// ── private ──

function getAuthPopupCompletionUrl(host, popup) {
  if (!popup || popup.closed) {
    return "";
  }

  let popupUrl;
  try {
    popupUrl = new URL(popup.location.href);
  } catch {
    return "";
  }

  if (popupUrl.origin !== globalThis.location.origin) {
    return "";
  }

  if (popupUrl.pathname.includes("/services/auth/")) {
    return "";
  }

  return `${popupUrl.pathname}${popupUrl.search}${popupUrl.hash}`;
}
