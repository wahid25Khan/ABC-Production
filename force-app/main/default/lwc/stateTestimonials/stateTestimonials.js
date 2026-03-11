import { LightningElement, track } from 'lwc';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import getCarouselData from '@salesforce/apex/TestimonialCarouselController.getCarouselData';
import LOGO_URL from '@salesforce/resourceUrl/testimonialsLogo';
import SWIPER from '@salesforce/resourceUrl/SwiperJS';

const STORAGE_KEY = 'abc_selected_state';

export default class TestimonialCarousel extends LightningElement {
    logoUrl = LOGO_URL;
    
    @track currentState = 'california'; 
    @track formattedSlides = [];
    
    swiperInitialized = false;
    swiperInstance = null;

    _watchId;
    _lastHash = '';

    connectedCallback() {
        this.updateStateFromUrlOrStorage();

        this.fetchCarouselData();

        this.startHashWatcher();
    }

    disconnectedCallback() {
        this.stopHashWatcher();
    }

    // --- State Management ---
    
    updateStateFromUrlOrStorage() {
        let hashState = this.getStateFromHash();
        
        if (!hashState) {
            hashState = window.localStorage.getItem(STORAGE_KEY);
        }

        if (hashState) {
            this.currentState = hashState;
        }
    }

    getStateFromHash() {
        try {
            const h = (window.location.hash || '').replace(/^#/, '').trim();
            if (!h) return '';
            return decodeURIComponent(h);
        } catch (e) {
            return '';
        }
    }

    // --- Hash Watcher ---

    startHashWatcher() {
        this._lastHash = window.location.hash;
        
        this._watchId = window.setInterval(() => {
            const currentHash = window.location.hash;
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
            window.clearInterval(this._watchId);
            this._watchId = null;
        }
    }

    // --- Data Fetching (Apex) ---

    fetchCarouselData() {
        getCarouselData({ stateCode: this.currentState })
            .then(data => {
                if (data && data.length > 0) {
                    this.formattedSlides = data.map(item => ({
                        ...item,
                        isVideo: item.Media_Type__c === 'Video',
                        isText: item.Media_Type__c === 'Text'
                    }));

                    this.setupOrUpdateSwiper();
                } else {
                    this.formattedSlides = [];
                }
            })
            .catch(error => {
                console.error('Error fetching carousel data: ', error);
            });
    }

    // --- Swiper Initialization & Update ---

    setupOrUpdateSwiper() {
        if (!window.Swiper) {
            Promise.all([
                loadScript(this, SWIPER + '/SwiperJS/swiper-bundle.min.js'),
                loadStyle(this, SWIPER + '/SwiperJS/swiper-bundle.min.css')
            ])
            .then(() => {
                this.initSwiper();
            })
            .catch(error => {
                console.error('Error loading Swiper files: ', error);
            });
        } else {
            setTimeout(() => {
                this.initSwiper();
            }, 0);
        }
    }

    initSwiper() {
        const swiperContainer = this.template.querySelector('.swiper');
        
        if (swiperContainer && window.Swiper) {
            if (this.swiperInstance) {
                this.swiperInstance.destroy(true, true);
            }

            this.swiperInitialized = true;
            this.swiperInstance = new window.Swiper(swiperContainer, {
                slidesPerView: 1,
                spaceBetween: 15,
                navigation: {
                    nextEl: this.template.querySelector('.swiper-button-next'),
                    prevEl: this.template.querySelector('.swiper-button-prev'),
                },
                breakpoints: {
                    768: { slidesPerView: 2 },
                    1024: { slidesPerView: 3 }
                }
            });
        }
    }
}
// import { LightningElement, track } from 'lwc';
// import communityId from '@salesforce/community/Id';
// import getStateTestimonials from '@salesforce/apex/StateTestimonialsController.getStateTestimonials';

// const RESULTS_SEG = '/global-search';

// const STATES = new Set([
//   'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
//   'Delaware','District of Columbia','Florida','Georgia','Hawaii','Idaho','Illinois',
//   'Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts',
//   'Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
//   'New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota',
//   'Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
//   'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'
// ]);

// function decodeDeep(str) {
//   if (!str) return '';
//   let out = str;
//   for (let i = 0; i < 3; i++) {
//     try {
//       const dec = decodeURIComponent(out);
//       if (dec === out) break;
//       out = dec;
//     } catch (e) {
//       break;
//     }
//   }
//   return out;
// }

// export default class StateTestimonials extends LightningElement {
//   @track selectedState = 'Georgia';
//   @track items = [];
//   @track currentIndex = 0;
//   @track errorMessage = '';

//   visibleCount = 3;
//   _watchId;
//   _lastHref = '';
//   _resizeHandler;

//   connectedCallback() {
//     console.log('StateTestimonials connected');
//     console.log('communityId =>', communityId);
//     console.log('window.location.href =>', window.location.href);

//     this._lastHref = window.location.href;
//     this.updateVisibleCount();
//     this.syncFromUrl();

//     this._watchId = window.setInterval(() => {
//       const href = window.location.href;
//       if (href !== this._lastHref) {
//         console.log('URL changed from', this._lastHref, 'to', href);
//         this._lastHref = href;
//         this.syncFromUrl();
//       }
//     }, 250);

//     this._resizeHandler = () => this.updateVisibleCount();
//     window.addEventListener('resize', this._resizeHandler);
//   }

//   disconnectedCallback() {
//     window.clearInterval(this._watchId);
//     this._watchId = null;
//     window.removeEventListener('resize', this._resizeHandler);
//   }

//   get hasItems() {
//     return this.items && this.items.length > 0;
//   }

//   get hasError() {
//     return !!this.errorMessage;
//   }

//   get visibleCards() {
//     if (!this.hasItems) return [];

//     const count = Math.min(this.visibleCount, this.items.length);
//     const out = [];

//     for (let i = 0; i < count; i++) {
//       const idx = (this.currentIndex + i) % this.items.length;
//       out.push(this.items[idx]);
//     }
//     return out;
//   }

//   updateVisibleCount() {
//     const width = window.innerWidth || 1200;
//     if (width < 768) {
//       this.visibleCount = 1;
//     } else if (width < 1100) {
//       this.visibleCount = 2;
//     } else {
//       this.visibleCount = 3;
//     }
//     console.log('visibleCount =>', this.visibleCount, 'window width =>', width);
//   }

//   syncFromUrl() {
//     const url = new URL(window.location.href);
//     const state = this.resolveState(url) || 'Georgia';

//     console.log('syncFromUrl => resolved state =', state);
//     console.log('Current pathname =>', url.pathname);
//     console.log('Current search =>', url.search);
//     console.log('Current hash =>', url.hash);

//     if (state !== this.selectedState) {
//       this.currentIndex = 0;
//       this.selectedState = state;
//     }

//     this.loadCards();
//   }

//   resolveState(url) {
//     const fromParams = this.getStateFromParams(url);
//     if (fromParams) {
//       console.log('State resolved from params =>', fromParams);
//       return fromParams;
//     }

//     if ((url.pathname || '').includes(RESULTS_SEG)) {
//       const kw = this.getResultsKeyword(url);
//       console.log('State candidate from results path =>', kw);
//       if (kw && kw.toLowerCase() !== 'all' && STATES.has(kw)) return kw;
//       return '';
//     }

//     const h = decodeURIComponent((url.hash || '').replace('#', '').trim());
//     if (STATES.has(h)) {
//       console.log('State resolved from hash =>', h);
//       return h;
//     }

//     console.log('No state found in URL. Defaulting to Georgia');
//     return 'Georgia';
//   }

//   getResultsKeyword(url) {
//     const idx = (url.pathname || '').indexOf(RESULTS_SEG);
//     if (idx === -1) return '';
//     const after = (url.pathname || '').slice(idx + RESULTS_SEG.length).replace(/^\/+/, '');
//     const seg = (after.split('/')[0] || '').trim();
//     return decodeURIComponent(seg);
//   }

//   getStateFromParams(url) {
//     try {
//       const refinementsRaw = url.searchParams.get('refinements');
//       if (refinementsRaw) {
//         console.log('refinementsRaw =>', refinementsRaw);
//         const jsonStr = decodeDeep(refinementsRaw);
//         console.log('Decoded refinements =>', jsonStr);

//         const list = JSON.parse(jsonStr);
//         const entry = Array.isArray(list)
//           ? list.find((r) => r && r.nameOrId === 'State__c')
//           : null;

//         if (entry && Array.isArray(entry.values) && entry.values.length) {
//           const v = entry.values[0];
//           console.log('State from refinements =>', v);
//           return STATES.has(v) ? v : '';
//         }
//       }

//       const singleRef = url.searchParams.get('refinement');
//       if (singleRef) {
//         console.log('singleRef raw =>', singleRef);
//         const decoded = decodeDeep(singleRef);
//         console.log('singleRef decoded =>', decoded);

//         const prefix = 'State__c:';
//         if (decoded.startsWith(prefix)) {
//           const v = decoded.substring(prefix.length);
//           console.log('State from single refinement =>', v);
//           return STATES.has(v) ? v : '';
//         }
//       }
//     } catch (e) {
//       console.error('Error while parsing state from URL params', e);
//     }

//     return '';
//   }

//   async loadCards() {
//     this.errorMessage = '';

//     console.log('loadCards START');
//     console.log('selectedState =>', this.selectedState);
//     console.log('communityId being sent =>', communityId);

//     try {
//       const data = await getStateTestimonials({
//         state: this.selectedState,
//         siteId: communityId
//       });

//       console.log('Raw Apex response =>', data);
//       console.log('Raw Apex response JSON =>', JSON.stringify(data));

//       this.items = (data || []).map((item, index) => {
//         const embedUrl = this.toEmbedUrl(item.mediaUrl);

//         return {
//           ...item,
//           key: item.id || `${item.type}-${index}`,
//           isVideo: item.type === 'video',
//           isEmbed: !!embedUrl,
//           embedUrl
//         };
//       });

//       console.log('Mapped items =>', this.items);
//       console.log('Mapped items count =>', this.items.length);
//     } catch (e) {
//       this.items = [];

//       let msg = 'Unknown error';
//       if (e?.body?.message) {
//         msg = e.body.message;
//       } else if (e?.message) {
//         msg = e.message;
//       } else {
//         try {
//           msg = JSON.stringify(e);
//         } catch (jsonError) {
//           msg = 'Unexpected error';
//         }
//       }

//       this.errorMessage = msg;
//       console.error('Testimonials load error', e);
//     }
//   }

//   handlePrev() {
//     if (!this.hasItems) return;
//     this.currentIndex = (this.currentIndex - 1 + this.items.length) % this.items.length;
//     console.log('handlePrev => currentIndex', this.currentIndex);
//   }

//   handleNext() {
//     if (!this.hasItems) return;
//     this.currentIndex = (this.currentIndex + 1) % this.items.length;
//     console.log('handleNext => currentIndex', this.currentIndex);
//   }

//   toEmbedUrl(url) {
//     if (!url) return '';

//     try {
//       const lower = url.toLowerCase();

//       if (lower.includes('youtube.com/watch')) {
//         const u = new URL(url);
//         const id = u.searchParams.get('v');
//         return id ? `https://www.youtube.com/embed/${id}` : '';
//       }

//       if (lower.includes('youtu.be/')) {
//         const id = url.split('youtu.be/')[1]?.split('?')[0];
//         return id ? `https://www.youtube.com/embed/${id}` : '';
//       }

//       if (lower.includes('vimeo.com/')) {
//         const id = url.split('vimeo.com/')[1]?.split('?')[0];
//         return id ? `https://player.vimeo.com/video/${id}` : '';
//       }
//     } catch (e) {
//       console.error('Error building embed URL', e);
//     }

//     return '';
//   }
// }