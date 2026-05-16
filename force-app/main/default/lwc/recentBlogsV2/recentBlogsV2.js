import { LightningElement } from "lwc";
import { normalizeImageUrl } from "c/utils";

const API_VERSION = "v66.0";
const SITE_TARGET_ID = "0DMam000001PhUEGA0";
const COLLECTION_KEY = "MC3QSJKYKVFBGVXDFJ4LZZQTTSVA";
const PAGE_SIZE = 4;
const LANGUAGE = "en-US";
const CMS_IMAGE_VERSION = "1.1";
const CMS_IMAGE_WIDTH = "1920";
const FALLBACK_ERROR =
  "We couldn't load recent posts right now. Please try again.";

export default class RecentBlogsV2 extends LightningElement {
  blogs = [];
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  isLoading = false;
  errorMessage = "";

  pageCache = new Map();
  activeRequestId = 0;

  connectedCallback() {
    this.loadPage(1);
  }

  get hasBlogs() {
    return this.blogs.length > 0;
  }

  get showEmptyState() {
    return !this.isLoading && !this.errorMessage && !this.hasBlogs;
  }

  get hasPagination() {
    return this.totalPages > 1;
  }

  get isPreviousDisabled() {
    return this.isLoading || this.currentPage <= 1;
  }

  get isNextDisabled() {
    return this.isLoading || this.currentPage >= this.totalPages;
  }

  get previousButtonClass() {
    return `pagination-arrow${this.isPreviousDisabled ? " disabled" : ""}`;
  }

  get nextButtonClass() {
    return `pagination-arrow${this.isNextDisabled ? " disabled" : ""}`;
  }

  get pageLabel() {
    return `Page ${this.currentPage} of ${this.totalPages}`;
  }

  async handlePreviousClick() {
    if (this.isPreviousDisabled) {
      return;
    }

    await this.loadPage(this.currentPage - 1);
  }

  async handleNextClick() {
    if (this.isNextDisabled) {
      return;
    }

    await this.loadPage(this.currentPage + 1);
  }

  async handleRetryClick() {
    await this.loadPage(this.currentPage || 1);
  }

  async loadPage(pageNumber) {
    const normalizedPage = Number.parseInt(pageNumber, 10);
    if (!Number.isFinite(normalizedPage) || normalizedPage < 1) {
      return;
    }

    const requestId = ++this.activeRequestId;
    const pageToken = normalizedPage - 1;

    this.isLoading = true;
    this.errorMessage = "";

    try {
      const payload = await this.getPagePayload(pageToken);
      if (requestId !== this.activeRequestId) {
        return;
      }

      const total = Math.max(0, Number(payload?.total) || 0);
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const safePage = Math.min(normalizedPage, totalPages);
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const channelId = this.firstNonBlank(payload?.channelSummary?.id);

      this.totalItems = total;
      this.totalPages = totalPages;
      this.currentPage = safePage;
      this.blogs = this.normalizeBlogs(items, channelId);
    } catch (error) {
      if (requestId !== this.activeRequestId) {
        return;
      }

      this.errorMessage = error?.message || FALLBACK_ERROR;
      this.blogs = [];
      this.totalItems = 0;
      this.totalPages = 1;
    } finally {
      if (requestId === this.activeRequestId) {
        this.isLoading = false;
      }
    }
  }

  async getPagePayload(pageToken) {
    const cacheKey = String(pageToken);
    if (this.pageCache.has(cacheKey)) {
      return this.pageCache.get(cacheKey);
    }

    const response = await fetch(this.buildCollectionUrl(pageToken), {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(FALLBACK_ERROR);
    }

    const payload = await response.json();
    this.pageCache.set(cacheKey, payload);
    return payload;
  }

  buildCollectionUrl(pageToken) {
    const params = new URLSearchParams({
      pageSize: String(PAGE_SIZE),
      pageToken: String(pageToken),
      language: LANGUAGE,
      asGuest: "true",
      htmlEncode: "false"
    });

    return `${this.getSiteBasePath()}/webruntime/api/services/data/${API_VERSION}/connect/sites/${SITE_TARGET_ID}/cms/delivery/collections/${COLLECTION_KEY}?${params.toString()}`;
  }

  getSiteBasePath() {
    const currentPath = String(globalThis.location?.pathname || "").trim();
    const segments = currentPath.split("/").filter(Boolean);
    return segments.length ? `/${segments[0]}` : "";
  }

  normalizeBlogs(items, channelId) {
    return items.map((item, index) => {
      const body = item?.body || {};
      const contentBody = body?.contentBody || {};
      const bannerImage = contentBody?.bannerImage || {};
      const imageContentKey = this.firstNonBlank(
        bannerImage?.source?.ref?.contentKey
      );
      const title = this.firstNonBlank(item?.name, body?.title, "Recent Post");
      const urlName = this.firstNonBlank(body?.urlName, item?.urlName);
      const imageUrl = this.buildCmsImageUrl(imageContentKey, channelId);

      return {
        id: this.firstNonBlank(item?.id, body?.contentKey, `blog-${index}`),
        title,
        urlName,
        excerpt: contentBody?.excerpt || "",
        bodyHtml: contentBody?.body || "",
        imageUrl,
        hasImage: Boolean(imageUrl)
      };
    });
  }

  buildCmsImageUrl(contentKey, channelId) {
    if (!contentKey || !channelId) {
      return "";
    }

    const siteBasePath = this.getSiteBasePath();
    const params = new URLSearchParams({
      version: CMS_IMAGE_VERSION,
      channelId
    });

    const rawUrl = `${globalThis.location.origin}/cdn-cgi/image/fit=scale-down,format=auto,onerror=redirect,width=${CMS_IMAGE_WIDTH}${siteBasePath}/sfsites/c/cms/delivery/media/${contentKey}?${params.toString()}`;
    return normalizeImageUrl(rawUrl);
  }

  firstNonBlank(...values) {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    return "";
  }
}