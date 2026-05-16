import { LightningElement, api } from "lwc";

const LIVE_ARTICLE_BASE_URL = "https://americanbookcompany.com/articles/";

function collapseWhitespace(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  if (!value) {
    return "";
  }

  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function extractBodyLines(value) {
  if (!value) {
    return [];
  }

  const decoded = decodeHtml(value)
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decoded
    .split(/\n+/)
    .map((line) => collapseWhitespace(line))
    .filter(Boolean);
}

function startsWithTitle(value, title) {
  return value.toLowerCase().startsWith(title.toLowerCase());
}

function normalizeExcerpt(title, excerpt, bodyHtml) {
  const normalizedTitle = collapseWhitespace(title);
  let normalizedExcerpt = collapseWhitespace(excerpt);

  if (normalizedExcerpt && normalizedTitle && startsWithTitle(normalizedExcerpt, normalizedTitle)) {
    normalizedExcerpt = collapseWhitespace(
      normalizedExcerpt.slice(normalizedTitle.length)
    );
  }

  if (!normalizedExcerpt || /^by\s+/i.test(normalizedExcerpt)) {
    const bodyLines = extractBodyLines(bodyHtml);
    normalizedExcerpt =
      bodyLines.find((line) => {
        if (!line) {
          return false;
        }

        if (normalizedTitle && line.toLowerCase() === normalizedTitle.toLowerCase()) {
          return false;
        }

        return !/^by\s+/i.test(line);
      }) || "";
  }

  return normalizedExcerpt || normalizedTitle;
}

export default class BlogPostCard extends LightningElement {
  @api title = "";
  @api excerpt = "";
  @api bodyHtml = "";
  @api imageUrl = "";
  @api urlName = "";

  get articleUrl() {
    const normalizedUrlName = collapseWhitespace(this.urlName);
    return normalizedUrlName
      ? `${LIVE_ARTICLE_BASE_URL}${normalizedUrlName}`
      : LIVE_ARTICLE_BASE_URL;
  }

  get normalizedExcerpt() {
    return normalizeExcerpt(this.title, this.excerpt, this.bodyHtml);
  }

  get resolvedImageUrl() {
    return collapseWhitespace(this.imageUrl);
  }

  get hasImage() {
    return !!this.resolvedImageUrl;
  }
}