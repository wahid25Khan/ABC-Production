import { LightningElement, wire } from "lwc";
import { CurrentPageReference } from "lightning/navigation";
import { getContent } from "experience/cmsDeliveryApi";
import siteId from "@salesforce/site/Id";
import { normalizeImageUrl } from "c/utils";

const CMS_IMAGE_VERSION = "1.1";
const CMS_IMAGE_WIDTH = "1920";
const FALLBACK_ERROR =
  "We couldn't load this post right now. Please try again.";
const INJECTED_STYLE_ID = "blog-post-detail-rich-text-overrides";
const INJECTED_STYLE_CSS = `
  .blog-post-detail-body .ql-indent-3 {
    padding-left: 0 !important;
  }
  .blog-post-detail-body lightning-formatted-rich-text {
    display: flex !important;
    justify-content: center !important;
  }
`;

export default class BlogPostDetail extends LightningElement {
  article = null;
  contentKey = "";
  errorMessage = "";
  hasInjectedStyles = false;

  @wire(CurrentPageReference)
  handlePageReference(pageReference) {
    this.syncContentKey(pageReference);
  }

  @wire(getContent, {
    channelOrSiteId: siteId,
    contentKeyOrId: "$contentKey"
  })
  onGetContent({ data, error }) {
    if (!this.contentKey) {
      this.article = null;
      return;
    }

    if (data) {
      this.article = data;
      this.errorMessage = "";
      return;
    }

    if (error) {
      this.article = null;
      this.errorMessage =
        error?.body?.message || error?.message || FALLBACK_ERROR;
    }
  }

  get hasArticle() {
    return Boolean(this.article);
  }

  get isLoading() {
    return !this.hasArticle && !this.errorMessage && Boolean(this.contentKey);
  }

  get title() {
    return this.firstNonBlank(this.article?.title, "Blog Post");
  }

  get excerpt() {
    return this.firstNonBlank(this.article?.contentBody?.excerpt);
  }

  get hasExcerpt() {
    return Boolean(this.excerpt);
  }

  get bodyHtml() {
    return this.firstNonBlank(this.article?.contentBody?.body);
  }

  get hasBody() {
    return Boolean(this.bodyHtml);
  }

  get publishedDateLabel() {
    return this.formatPublishedDate(this.article?.publishedDate);
  }

  get hasPublishedDate() {
    return Boolean(this.publishedDateLabel);
  }

  get showMeta() {
    return this.hasExcerpt || this.hasPublishedDate;
  }

  get imageUrl() {
    const contentKey = this.firstNonBlank(
      this.article?.contentBody?.bannerImage?.source?.ref?.contentKey
    );
    const channelId = this.firstNonBlank(this.article?.channelSummary?.id);

    return this.buildCmsImageUrl(contentKey, channelId);
  }

  get hasImage() {
    return Boolean(this.imageUrl);
  }

  get imageAlt() {
    return this.firstNonBlank(
      this.article?.contentBody?.bannerImage?.altText,
      this.title,
      "Blog post image"
    );
  }

  renderedCallback() {
    if (this.hasInjectedStyles) {
      return;
    }

    const ownerDocument = this.template?.ownerDocument || document;
    if (!ownerDocument || ownerDocument.getElementById(INJECTED_STYLE_ID)) {
      this.hasInjectedStyles = true;
      return;
    }

    const style = ownerDocument.createElement("style");
    style.id = INJECTED_STYLE_ID;
    style.textContent = INJECTED_STYLE_CSS;
    ownerDocument.head.appendChild(style);
    this.hasInjectedStyles = true;
  }

  syncContentKey(pageReference) {
    const nextContentKey = this.extractContentKey(pageReference);
    if (nextContentKey === this.contentKey) {
      return;
    }

    this.contentKey = nextContentKey;
    this.article = null;
    this.errorMessage = nextContentKey
      ? ""
      : "We couldn't determine which post to load.";
  }

  extractContentKey(pageReference) {
    const candidatePath = this.firstNonBlank(
      pageReference?.attributes?.url,
      pageReference?.attributes?.path,
      pageReference?.state?.path,
      globalThis.location?.pathname
    );
    const pathSegments = candidatePath.split("/").filter(Boolean);
    const newsIndex = pathSegments.findIndex(
      (segment) => segment.toLowerCase() === "news"
    );
    const rawSlug = newsIndex >= 0 ? pathSegments[newsIndex + 1] : "";
    const slug = this.decodeSegment(rawSlug);

    if (!slug) {
      return "";
    }

    if (/^M[A-Z0-9]+$/.test(slug)) {
      return slug;
    }

    const slugMatch = slug.match(/(?:^|-)(M[A-Z0-9]+)$/);
    return slugMatch ? slugMatch[1] : "";
  }

  decodeSegment(value) {
    const candidate = String(value || "").trim();
    if (!candidate) {
      return "";
    }

    try {
      return decodeURIComponent(candidate);
    } catch {
      return candidate;
    }
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

  getSiteBasePath() {
    const currentPath = String(globalThis.location?.pathname || "").trim();
    const segments = currentPath.split("/").filter(Boolean);
    return segments.length ? `/${segments[0]}` : "";
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