import { LightningElement, track } from "lwc";
import { loadScript, loadStyle } from "lightning/platformResourceLoader";
import getCarouselData from "@salesforce/apex/TestimonialCarouselController.getCarouselData";
import LOGO_URL from "@salesforce/resourceUrl/testimonialsLogo";
import SWIPER from "@salesforce/resourceUrl/SwiperJS";
import {
  STATE_CHANGE_EVENT_NAMES,
  normalizeStateName,
  readStateFromStorage
} from "c/utils";

export default class TestimonialCarousel extends LightningElement {
  logoUrl = LOGO_URL;

  @track currentState = "Georgia";
  @track formattedSlides = [];
  @track isLoading = true;

  swiperInitialized = false;
  swiperInstance = null;

  _watchId;
  _lastHash = "";
  _boundStateChangeHandler;

  connectedCallback() {
    this.updateStateFromUrlOrStorage();

    this.fetchCarouselData();

    this.startHashWatcher();
    this._boundStateChangeHandler = (event) => this.handleStateChange(event);
    STATE_CHANGE_EVENT_NAMES.forEach((eventName) => {
      globalThis.addEventListener(eventName, this._boundStateChangeHandler);
    });
  }

  disconnectedCallback() {
    this.stopHashWatcher();
    if (this._boundStateChangeHandler) {
      STATE_CHANGE_EVENT_NAMES.forEach((eventName) => {
        globalThis.removeEventListener(
          eventName,
          this._boundStateChangeHandler
        );
      });
      this._boundStateChangeHandler = null;
    }
  }

  get hasData() {
    if (!this.formattedSlides) return false;
    return this.formattedSlides.length > 0;
  }
  // --- State Management ---

  updateStateFromUrlOrStorage() {
    let nextState = this.getStateFromHash();

    if (!nextState) {
      nextState = normalizeStateName(readStateFromStorage());
    }

    if (nextState) {
      this.currentState = nextState;
    }
  }

  getStateFromHash() {
    try {
      const h = (globalThis.location.hash || "").replace(/^#/, "").trim();
      if (!h) return "";
      return normalizeStateName(decodeURIComponent(h));
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

  handleStateChange(event) {
    const nextState = normalizeStateName(
      event?.detail?.state || event?.detail?.selectedState || ""
    );
    if (!nextState || nextState === this.currentState) {
      return;
    }

    this.currentState = nextState;
    this.fetchCarouselData();
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
      .catch((error) => {
        console.error("Error fetching carousel data: ", error);
        this.formattedSlides = [];
      })
      .finally(() => {
        this.isLoading = false;

        setTimeout(() => {
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
      .catch((error) => {
        console.error("Error loading Swiper files: ", error);
      });
  }

  initSwiper() {
    const swiperContainer = this.template.querySelector(".swiper");

    if (swiperContainer && globalThis.Swiper) {
      if (this.swiperInstance) {
        this.swiperInstance.destroy(true, true);
      }

      this.swiperInitialized = true;
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
