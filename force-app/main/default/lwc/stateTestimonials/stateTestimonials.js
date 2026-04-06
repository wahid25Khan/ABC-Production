import { LightningElement, track } from "lwc";
import { loadScript, loadStyle } from "lightning/platformResourceLoader";
import { STATE_STORAGE_KEY } from "c/utils";
import getCarouselData from "@salesforce/apex/TestimonialCarouselController.getCarouselData";
import LOGO_URL from "@salesforce/resourceUrl/testimonialsLogo";
import SWIPER from "@salesforce/resourceUrl/SwiperJS";

export default class TestimonialCarousel extends LightningElement {
  logoUrl = LOGO_URL;

  @track currentState = "Georgia";
  @track formattedSlides = [];
  @track isLoading = true;

  swiperInstance = null;

  _watchId;
  _lastHash = "";

  connectedCallback() {
    this.updateStateFromUrlOrStorage();

    this.fetchCarouselData();

    this.startHashWatcher();
  }

  disconnectedCallback() {
    this.stopHashWatcher();
  }

  get hasData() {
    if (!this.formattedSlides) return false;
    return this.formattedSlides.length > 0;
  }
  // --- State Management ---

  updateStateFromUrlOrStorage() {
    let hashState = this.getStateFromHash();

    if (!hashState) {
      hashState = globalThis.localStorage.getItem(STATE_STORAGE_KEY);
    }

    if (hashState) {
      this.currentState = hashState;
    }
  }

  getStateFromHash() {
    try {
      const h = (globalThis.location.hash || "").replace(/^#/, "").trim();
      if (!h) return "";
      return decodeURIComponent(h);
    } catch {
      return "";
    }
  }

  // --- Hash Watcher ---

  startHashWatcher() {
    this._lastHash = globalThis.location.hash;

    this._watchId = globalThis.setInterval(() => {
      const currentHash = globalThis.location.hash;
      if (currentHash !== this._lastHash) {
        this._lastHash = currentHash;

        const newState = this.getStateFromHash();
        if (newState && newState !== this.currentState) {
          this.currentState = newState;
          this.fetchCarouselData();
        }
      }
    }, 250);
  }

  stopHashWatcher() {
    if (this._watchId) {
      globalThis.clearInterval(this._watchId);
      this._watchId = null;
    }
  }

  // --- Data Fetching (Apex) ---

  fetchCarouselData() {
    this.isLoading = true;

    getCarouselData({ stateCode: this.currentState })
      .then((data) => {
        if (data && data.length > 0) {
          this.formattedSlides = data.map((item) => ({
            ...item,
            isVideo: item.Media_Type__c === "Video",
            isText: item.Media_Type__c === "Text"
          }));
        } else {
          this.formattedSlides = [];
        }
      })
      .catch(() => {
        this.formattedSlides = [];
      })
      .finally(() => {
        this.isLoading = false;

        globalThis.setTimeout(() => {
          this.setupOrUpdateSwiper();
        }, 0);
      });
  }

  // --- Swiper Initialization & Update ---

  setupOrUpdateSwiper() {
    if (globalThis.Swiper) {
      setTimeout(() => {
        this.initSwiper();
      }, 0);
      return;
    }

    Promise.all([
      loadScript(this, SWIPER + "/SwiperJS/swiper-bundle.min.js"),
      loadStyle(this, SWIPER + "/SwiperJS/swiper-bundle.min.css")
    ])
      .then(() => {
        this.initSwiper();
      })
      .catch(() => {});
  }

  initSwiper() {
    const swiperContainer = this.template.querySelector(".swiper");

    if (swiperContainer && globalThis.Swiper) {
      if (this.swiperInstance) {
        this.swiperInstance.destroy(true, true);
      }

      this.swiperInstance = new globalThis.Swiper(swiperContainer, {
        slidesPerView: 1,
        spaceBetween: 15,
        navigation: {
          nextEl: this.template.querySelector(".swiper-button-next"),
          prevEl: this.template.querySelector(".swiper-button-prev")
        },
        breakpoints: {
          768: { slidesPerView: 2 },
          1024: { slidesPerView: 3 }
        }
      });
    }
  }
}
