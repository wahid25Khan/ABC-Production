import { LightningElement } from "lwc";
import { normalizeImageUrl, normalizeInternalUrl } from "c/utils";

const API_VERSION = "v66.0";
const SITE_TARGET_ID = "0DMam000001PhUEGA0";
const COLLECTION_KEY = "MC3QSJKYKVFBGVXDFJ4LZZQTTSVA";
const PAGE_SIZE = 4;
const LANGUAGE = "en-US";
const NEWS_PATH = "/news";
const CMS_IMAGE_VERSION = "1.1";
const CMS_IMAGE_WIDTH = "1920";
const FALLBACK_ERROR =
  "We couldn't load recent posts right now. Please try again.";

export default class RecentBlogs extends LightningElement {
  blogs = [];
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  isLoading = false;
  isSearchLoading = false;
  errorMessage = "";
  searchTerm = "";
  allBlogs = [];
  browseBlogs = [];
  browsePage = 1;
  browseTotalPages = 1;
  browseTotalItems = 0;
  isSearchCacheReady = false;

  pageCache = new Map();
  activeRequestId = 0;
  activeSearchRequestId = 0;
  searchCachePromise = null;

  connectedCallback() {
    this.loadPage(1);
  }

  get hasBlogs() {
    return this.blogs.length > 0;
  }

  get isSearchActive() {
    return this.getNormalizedSearchTerm(this.searchTerm).length > 0;
  }

  get showClearSearchButton() {
    return this.isSearchActive;
  }

  get showEmptyState() {
    return (
      !this.isLoading &&
      !this.isSearchLoading &&
      !this.errorMessage &&
      !this.hasBlogs
    );
  }

  get emptyStateMessage() {
    return this.isSearchActive
      ? "No posts match your search."
      : "No recent posts are available yet.";
  }

  get hasPagination() {
    return !this.isSearchLoading && this.totalPages > 1;
  }

  get isPreviousDisabled() {
    return (
      this.isLoading ||
      this.isSearchLoading ||
      this.currentPage <= 1
    );
  }

  get isNextDisabled() {
    return (
      this.isLoading ||
      this.isSearchLoading ||
      this.currentPage >= this.totalPages
    );
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

    if (this.isSearchActive) {
      this.applySearchResults(this.currentPage - 1);
      return;
    }

    await this.loadPage(this.currentPage - 1);
  }

  async handleNextClick() {
    if (this.isNextDisabled) {
      return;
    }

    if (this.isSearchActive) {
      this.applySearchResults(this.currentPage + 1);
      return;
    }

    await this.loadPage(this.currentPage + 1);
  }

  async handleSearchInput(event) {
    this.searchTerm = String(event.target?.value || "");
    await this.runSearch();
  }

  async handleClearSearch() {
    this.searchTerm = "";
    await this.runSearch();
  }

  async handleRetryClick() {
    if (this.isSearchActive) {
      await this.runSearch();
      return;
    }

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
      const normalizedBlogs = this.normalizeBlogs(items, channelId);

      this.browseTotalItems = total;
      this.browseTotalPages = totalPages;
      this.browsePage = safePage;
      this.browseBlogs = normalizedBlogs;

      if (!this.isSearchActive) {
        this.totalItems = total;
        this.totalPages = totalPages;
        this.currentPage = safePage;
        this.blogs = normalizedBlogs;
      }

      this.prefetchAllBlogsForSearch(payload).catch(() => {});
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

  async prefetchAllBlogsForSearch(initialPayload) {
    if (this.isSearchCacheReady) {
      return this.allBlogs;
    }

    if (this.searchCachePromise) {
      return this.searchCachePromise;
    }

    this.searchCachePromise = this.buildSearchCache(initialPayload)
      .then((blogs) => {
        this.allBlogs = blogs;
        this.isSearchCacheReady = true;
        return blogs;
      })
      .finally(() => {
        this.searchCachePromise = null;
      });

    return this.searchCachePromise;
  }

  async buildSearchCache(initialPayload) {
    const payloads = [];
    let payload = initialPayload || (await this.getPagePayload(0));
    const visitedTokens = new Set();

    while (payload) {
      payloads.push(payload);

      const nextPageToken = this.extractPageToken(payload?.nextPageUrl);
      if (nextPageToken === null) {
        break;
      }

      const cacheKey = String(nextPageToken);
      if (visitedTokens.has(cacheKey)) {
        break;
      }

      visitedTokens.add(cacheKey);
      payload = await this.getPagePayload(nextPageToken);
    }

    return this.normalizeAllBlogs(payloads);
  }

  normalizeAllBlogs(payloads) {
    const blogMap = new Map();

    payloads.forEach((payload) => {
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const channelId = this.firstNonBlank(payload?.channelSummary?.id);
      const normalizedBlogs = this.normalizeBlogs(items, channelId);

      normalizedBlogs.forEach((blog) => {
        if (!blogMap.has(blog.id)) {
          blogMap.set(blog.id, blog);
        }
      });
    });

    return Array.from(blogMap.values());
  }

  async runSearch() {
    const normalizedTerm = this.getNormalizedSearchTerm(this.searchTerm);
    const searchRequestId = ++this.activeSearchRequestId;

    this.errorMessage = "";

    if (!normalizedTerm) {
      this.isSearchLoading = false;
      this.restoreBrowseState();
      return;
    }

    this.isSearchLoading = true;

    try {
      await this.prefetchAllBlogsForSearch();
      if (searchRequestId !== this.activeSearchRequestId) {
        return;
      }

      this.applySearchResults(1);
    } catch (error) {
      if (searchRequestId !== this.activeSearchRequestId) {
        return;
      }

      this.errorMessage = error?.message || FALLBACK_ERROR;
      this.blogs = [];
      this.totalItems = 0;
      this.totalPages = 1;
      this.currentPage = 1;
    } finally {
      if (searchRequestId === this.activeSearchRequestId) {
        this.isSearchLoading = false;
      }
    }
  }

  applySearchResults(pageNumber) {
    const normalizedTerm = this.getNormalizedSearchTerm(this.searchTerm);
    if (!normalizedTerm) {
      this.restoreBrowseState();
      return;
    }

    const matches = this.allBlogs.filter((blog) =>
      blog.searchText.includes(normalizedTerm)
    );
    const total = matches.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(Math.max(1, pageNumber), totalPages);
    const startIndex = (safePage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;

    this.totalItems = total;
    this.totalPages = totalPages;
    this.currentPage = safePage;
    this.blogs = matches.slice(startIndex, endIndex);
  }

  restoreBrowseState() {
    this.blogs = this.browseBlogs;
    this.currentPage = this.browsePage;
    this.totalPages = this.browseTotalPages;
    this.totalItems = this.browseTotalItems;
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
      const contentKey = body?.contentKey || "";
      const contentBody = body?.contentBody || {};
      const bannerImage = contentBody?.bannerImage || {};
      const imageContentKey = this.firstNonBlank(
        bannerImage?.source?.ref?.contentKey
      );
      const title = this.firstNonBlank(item?.name, body?.title, "Recent Post");
      // const urlName = this.firstNonBlank(body?.urlName, item?.urlName);
      const href = contentKey
        ? normalizeInternalUrl(`${NEWS_PATH}/${contentKey}`)
        : "";
      const imageUrl = this.buildCmsImageUrl(imageContentKey, channelId);
      const imageAlt = this.firstNonBlank(
        bannerImage?.altText,
        title,
        "Recent post image"
      );
      const excerpt = this.normalizeExcerpt(contentBody?.excerpt || "");
      const bodyText = this.normalizeExcerpt(contentBody?.body || "");

      return {
        id: this.firstNonBlank(item?.id, body?.contentKey, `blog-${index}`),
        title,
        href,
        excerpt,
        imageUrl,
        imageAlt,
        publishedDateLabel: this.formatPublishedDate(body?.publishedDate),
        hasImage: Boolean(imageUrl),
        searchText: this.buildSearchText(title, excerpt, bodyText)
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

  normalizeExcerpt(value) {
    return String(value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  buildSearchText(...values) {
    return values
      .filter((value) => typeof value === "string" && value.trim())
      .join(" ")
      .toLowerCase();
  }

  getNormalizedSearchTerm(value) {
    return String(value || "").trim().toLowerCase();
  }

  extractPageToken(pageUrl) {
    const normalizedUrl = this.firstNonBlank(pageUrl);
    if (!normalizedUrl) {
      return null;
    }

    try {
      const parsedUrl = new URL(normalizedUrl, globalThis.location.origin);
      const pageToken = parsedUrl.searchParams.get("pageToken");
      const normalizedToken = Number.parseInt(pageToken, 10);
      return Number.isFinite(normalizedToken) ? normalizedToken : null;
    } catch {
      return null;
    }
  }

  formatPublishedDate(value) {
    if (!value) {
      return "";
    }

    try {
      return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      }).format(new Date(value));
    } catch {
      return "";
    }
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