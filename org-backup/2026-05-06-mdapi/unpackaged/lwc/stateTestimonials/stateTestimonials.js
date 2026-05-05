import { LightningElement, track } from "lwc";
import { loadScript, loadStyle } from "lightning/platformResourceLoader";
import getCarouselData from "@salesforce/apex/TestimonialCarouselController.getCarouselData";
import LOGO_URL from "@salesforce/resourceUrl/testimonialsLogo";
import SWIPER from "@salesforce/resourceUrl/SwiperJS";
import {
  STATE_CHANGE_EVENT_NAMES,
  resolveSelectedStateFromLocation
} from "c/utils";

export default class TestimonialCarousel extends LightningElement {
  logoUrl = LOGO_URL;

  @track currentState = "Georgia";
  @track formattedSlides = [];
  @track isLoading = true;

  swiperInitialized = false;
  swiperInstance = null;

  _boundStateSyncHandler;

  connectedCallback() {
    this.syncSelectedState();
    this.fetchCarouselData();
    this._boundStateSyncHandler = () => this.handleStateContextUpdate();
    STATE_CHANGE_EVENT_NAMES.forEach((eventName) => {
      globalThis.addEventListener(eventName, this._boundStateSyncHandler);
    });
    globalThis.addEventListener("hashchange", this._boundStateSyncHandler);
    globalThis.addEventListener("popstate", this._boundStateSyncHandler);
  }

  disconnectedCallback() {
    STATE_CHANGE_EVENT_NAMES.forEach((eventName) => {
      globalThis.removeEventListener(eventName, this._boundStateSyncHandler);
    });
    globalThis.removeEventListener("hashchange", this._boundStateSyncHandler);
    globalThis.removeEventListener("popstate", this._boundStateSyncHandler);
  }

  get hasData() {
    if (!this.formattedSlides) return false;
    return this.formattedSlides.length > 0;
  }
  // --- State Management ---

  syncSelectedState() {
    this.currentState = resolveSelectedStateFromLocation();
  }

  handleStateContextUpdate() {
    const nextState = resolveSelectedStateFromLocation();
    if (nextState === this.currentState) {
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
    if (!window.Swiper) {
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
    } else {
      setTimeout(() => {
        this.initSwiper();
      }, 0);
    }
  }

  initSwiper() {
    const swiperContainer = this.template.querySelector(".swiper");

    if (swiperContainer && window.Swiper) {
      if (this.swiperInstance) {
        this.swiperInstance.destroy(true, true);
      }

      this.swiperInitialized = true;
      this.swiperInstance = new window.Swiper(swiperContainer, {
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