import { LightningElement, api } from "lwc";

const DEFAULT_ARTICLES_URL = "https://americanbookcompany.com/articles";
const LIVE_ARTICLE_BASE_URL = `${DEFAULT_ARTICLES_URL}/`;
const OPAQUE_SUFFIX_PATTERN = /-[A-Z0-9]{12,}$/;

export default class BlogArticleRedirect extends LightningElement {
  @api fallbackUrl = DEFAULT_ARTICLES_URL;

  // connectedCallback() {
  //   const destination = this.resolveDestinationUrl();
  //   const currentUrl = globalThis.location?.href || "";

  //   if (!destination || destination === currentUrl) {
  //     return;
  //   }

  //   globalThis.location.replace(destination);
  // }

  // resolveDestinationUrl() {
  //   const slug = this.extractArticleSlug(globalThis.location?.pathname || "");
  //   if (!slug) {
  //     return this.normalizeFallbackUrl();
  //   }

  //   return `${LIVE_ARTICLE_BASE_URL}${slug}`;
  // }

  // extractArticleSlug(pathname) {
  //   const segments = String(pathname || "")
  //     .split("/")
  //     .map((segment) => segment.trim())
  //     .filter(Boolean);

  //   const newsIndex = segments.findIndex((segment) => segment.toLowerCase() === "news");
  //   const rawSlug = newsIndex >= 0 ? segments[newsIndex + 1] : "";
  //   const normalizedSlug = this.decodeSegment(rawSlug).toLowerCase();

  //   return normalizedSlug.replace(OPAQUE_SUFFIX_PATTERN, "");
  // }

  // decodeSegment(value) {
  //   const candidate = String(value || "").trim();
  //   if (!candidate) {
  //     return "";
  //   }

  //   try {
  //     return decodeURIComponent(candidate);
  //   } catch {
  //     return candidate;
  //   }
  // }

  // normalizeFallbackUrl() {
  //   const candidate = String(this.fallbackUrl || "").trim();
  //   return candidate || DEFAULT_ARTICLES_URL;
  // }
}