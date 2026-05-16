import { LightningElement } from "lwc";
import BLOG_IMAGE from "@salesforce/resourceUrl/BLOG";

// const PAGINATION_GROUP_SELECTOR = ".standard-button-group";
// const PAGE_INDICATOR_SELECTOR = ".abc-blog-page-indicator";
// const PAGE_BUTTON_LABELS = new Set(["<", ">"]);
// const PAGE_STYLE_TAG_ID = "abc-blog-pagination-style";

export default class BlogHero extends LightningElement {
  blogImage = BLOG_IMAGE;
  // currentPage = 1;
  // pendingDirection = 0;
  // lastPageSignature = "";
  // hasQueuedIndicatorSync = false;
  // paginatorObserver;
  // reconcileIntervalId;

  // disconnectedCallback() {
  //   this.paginatorObserver?.disconnect();
  //   if (this.reconcileIntervalId) {
  //     globalThis.clearInterval(this.reconcileIntervalId);
  //     this.reconcileIntervalId = null;
  //   }
  // }

  // renderedCallback() {
  //   this.ensurePaginationStyles();
  //   this.startPaginatorObserver();
  //   this.startReconcileLoop();
  //   this.queueIndicatorSync();
  // }

  // ensurePaginationStyles() {
  //   if (!globalThis.document?.head || globalThis.document.getElementById(PAGE_STYLE_TAG_ID)) {
  //     return;
  //   }

  //   const styleTag = globalThis.document.createElement("style");
  //   styleTag.id = PAGE_STYLE_TAG_ID;
  //   styleTag.textContent = `
  //     ${PAGINATION_GROUP_SELECTOR} {
  //       display: inline-flex !important;
  //       align-items: center !important;
  //       gap: 0.375rem !important;
  //     }

  //     ${PAGINATION_GROUP_SELECTOR} .abc-blog-page-indicator {
  //       display: inline-flex !important;
  //       align-items: center !important;
  //       justify-content: center !important;
  //       min-width: 1.5rem !important;
  //       padding: 0 0.25rem !important;
  //       margin: 0 !important;
  //     }

  //     ${PAGINATION_GROUP_SELECTOR} .slds-button {
  //       margin: 0 !important;
  //     }
  //   `;

  //   globalThis.document.head.appendChild(styleTag);
  // }

  // queueIndicatorSync() {
  //   if (this.hasQueuedIndicatorSync) {
  //     return;
  //   }

  //   this.hasQueuedIndicatorSync = true;
  //   globalThis.requestAnimationFrame(() => {
  //     this.hasQueuedIndicatorSync = false;
  //     this.syncCurrentPage();
  //     this.renderPageIndicator();
  //   });
  // }

  // startPaginatorObserver() {
  //   if (this.paginatorObserver || !globalThis.document?.body) {
  //     return;
  //   }

  //   this.paginatorObserver = new MutationObserver(() => {
  //     this.queueIndicatorSync();
  //   });

  //   this.paginatorObserver.observe(globalThis.document.body, {
  //     childList: true,
  //     subtree: true
  //   });
  // }

  // startReconcileLoop() {
  //   if (this.reconcileIntervalId) {
  //     return;
  //   }

  //   this.reconcileIntervalId = globalThis.setInterval(() => {
  //     this.syncCurrentPage();
  //     this.renderPageIndicator();
  //   }, 200);
  // }

  // syncCurrentPage() {
  //   const group = globalThis.document?.querySelector(PAGINATION_GROUP_SELECTOR);
  //   const prevButton = group?.querySelector("button:first-child");
  //   const pageSignature = this.getVisiblePageSignature();
  //   const pageChanged = !!pageSignature && pageSignature !== this.lastPageSignature;

  //   if (pageChanged && this.pendingDirection === 0) {
  //     const activeButton = group?.contains(globalThis.document?.activeElement)
  //       ? globalThis.document.activeElement
  //       : null;
  //     const activeLabel = activeButton?.textContent?.trim();

  //     if (PAGE_BUTTON_LABELS.has(activeLabel)) {
  //       this.pendingDirection = activeLabel === ">" ? 1 : -1;
  //     }
  //   }

  //   if (this.pendingDirection !== 0) {
  //     this.currentPage = Math.max(1, this.currentPage + this.pendingDirection);
  //     this.pendingDirection = 0;
  //   }

  //   if (prevButton?.disabled) {
  //     this.currentPage = 1;
  //   }

  //   if (pageSignature) {
  //     this.lastPageSignature = pageSignature;
  //   }
  // }

  // getVisiblePageSignature() {
  //   const articleLinks = globalThis.document?.querySelectorAll(
  //     'a[href*="/AmericanBookCompany/news/"]'
  //   );

  //   return articleLinks
  //     ? [...articleLinks]
  //         .slice(0, 4)
  //         .map((link) => link.getAttribute("href") || "")
  //         .join("|")
  //     : "";
  // }

  // renderPageIndicator() {
  //   const group = globalThis.document?.querySelector(PAGINATION_GROUP_SELECTOR);

  //   if (!group) {
  //     return;
  //   }

  //   const buttons = group.querySelectorAll("button");
  //   this.attachButtonListeners(buttons);
  //   const prevButton = buttons[0] || null;
  //   const nextButton = buttons[1] || null;
  //   let indicator = group.querySelector(PAGE_INDICATOR_SELECTOR);

  //   if (!indicator) {
  //     indicator = globalThis.document.createElement("span");
  //     indicator.className = "abc-blog-page-indicator";
  //     indicator.style.cssText =
  //       "font-family:Lato, Arial, Helvetica, sans-serif;font-size:14px;font-weight:700;line-height:1;color:#4b5563;white-space:nowrap;";
  //   }

  //   if (prevButton) {
  //     prevButton.after(indicator);
  //   } else if (nextButton) {
  //     nextButton.before(indicator);
  //   } else if (!indicator.parentElement) {
  //     group.appendChild(indicator);
  //   }

  //   if (prevButton) {
  //     prevButton.style.order = "1";
  //   }

  //   indicator.style.order = "2";

  //   if (nextButton) {
  //     nextButton.style.order = "3";
  //   }

  //   indicator.textContent = String(this.currentPage);
  // }

  // attachButtonListeners(buttons) {
  //   buttons.forEach((button) => {
  //     if (button.dataset.abcPageListener === "true") {
  //       return;
  //     }

  //     button.dataset.abcPageListener = "true";
  //     const captureDirection = (event) => {
  //       const label = event.currentTarget?.textContent?.trim();

  //       if (!PAGE_BUTTON_LABELS.has(label) || event.currentTarget.disabled) {
  //         return;
  //       }

  //       if (this.pendingDirection === 0) {
  //         this.pendingDirection = label === ">" ? 1 : -1;
  //       }

  //       this.queueIndicatorSync();
  //     };

  //     button.addEventListener("pointerdown", captureDirection);
  //     button.addEventListener("click", captureDirection);
  //   });
  // }
}