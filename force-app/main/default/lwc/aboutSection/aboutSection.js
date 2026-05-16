import { LightningElement } from "lwc";
import aboutHeroImage from "@salesforce/resourceUrl/AboutABC";
import phoneIcon from "@salesforce/resourceUrl/phoneIcon";
import mailIcon from "@salesforce/resourceUrl/mailIcon";

const TAB_KEYS = new Set([
  "ourStaff",
  "diversityAndCulture",
  "abcCares",
  "environment",
  "testimonials"
]);

const TABS = [
  { key: "ourStaff", label: "Our Staff" },
  { key: "diversityAndCulture", label: "Diversity & Culture" },
  { key: "abcCares", label: "ABC Cares" },
  { key: "environment", label: "Environment" },
  { key: "testimonials", label: "Testimonials" }
];

const STAFF = [
  {
    id: 1,
    name: "Colleen Pintozzi",
    title: "Owner and Chief Executive Officer",
    image:
      "https://cms-assets.americanbookcompany.com/cache/containers/staff_photos/colleen-pintozzi.png/801e57b6558b2605ba474caabf0731a3/colleen-pintozzi.webp"
  },
  {
    id: 2,
    name: "Devin Pintozzi",
    title: "Chief Operating Officer",
    image:
      "https://cms-assets.americanbookcompany.com/cache/containers/staff_photos/devin-pintozzi.png/97583340d0c264dd688acee55fbbe948/devin-pintozzi.webp"
  },
  {
    id: 3,
    name: "Lauren Kennedy",
    title: "Marketing & Technical Operations Director",
    image:
      "https://cms-assets.americanbookcompany.com/cache/containers/staff_photos/lauren-kennedy.png/d4fd8f3633e51508d7c0cf593a95cb87/lauren-kennedy.webp",
    phone: "tel: 404-695-0827",
    email: "mailto: lkennedy@abck12.com"
  },
  {
    id: 4,
    name: "Felipe Garrido Roman",
    title: "Creative Director",
    image:
      "https://cms-assets.americanbookcompany.com/cache/containers/staff_photos/felipe-garrido-roman.png/6df8bc966a74d2f4554f36e16b176091/felipe-garrido-roman.webp"
  },
  {
    id: 5,
    name: "Jenny Gale",
    title: "Senior Account Executive",
    image:
      "https://cms-assets.americanbookcompany.com/cache/containers/staff_photos/jenny-gale-2025.png/95b57190347bc1ccf798452519f49967/jenny-gale-2025.webp",
    phone: "tel: 470-725-5573",
    email: "mailto: jgale@abck12.com"
  },
  {
    id: 6,
    name: "Michele Lantz",
    title: "Senior Account Executive",
    image:
      "https://cms-assets.americanbookcompany.com/cache/containers/staff_photos/michele-lantz.png/10abef1e88ae2bea3492b70d541908ed/michele-lantz.webp",
    phone: "tel: 470-725-5667",
    email: "mailto: mlantz@abck12.com"
  },
  {
    id: 7,
    name: "Glenn Davenport",
    title: "North & South Carolina Account Executive",
    image:
      "https://cms-assets.americanbookcompany.com/cache/containers/staff_photos/glenn-davenport.png/40ecc4f7dfdf0332cc8bec2f5b721102/glenn-davenport.webp",
    phone: "tel: 470-725-5577",
    email: "mailto: gdavenport@abck12.com"
  },
  {
    id: 8,
    name: "Debbie Price",
    title: "Arkansas & Louisiana Account Executive",
    image:
      "https://cms-assets.americanbookcompany.com/cache/containers/staff_photos/debbie-price.png/75c5e7606bebfa4e9233dc936317d365/debbie-price.webp",
    phone: "tel: 888-264-5877",
    email: "mailto: dprice@abck12.com"
  },
  {
    id: 9,
    name: "Rodney Adams",
    title: "Senior Account Executive",
    image:
      "https://cms-assets.americanbookcompany.com/cache/containers/staff_photos/rodney-adams.png/cdf951555ca7e6d704265d004b33fe4c/rodney-adams.webp",
    phone: "tel: 888-264-5877",
    email: "mailto: radams@abck12.com"
  },
  {
    id: 10,
    name: "Laura Riffle",
    title: "Georgia Account Executive",
    image:
      "https://cms-assets.americanbookcompany.com/cache/containers/staff_photos/laura-riffle.png/6d5c16dec7e6566de2829436e8fe8e83/laura-riffle.webp",
    phone: "tel: 470-725-0074",
    email: "mailto: lriffle@abck12.com"
  },
  {
    id: 11,
    name: "ABC Sales Team",
    title: "Sales and Customer Service",
    image:
      "https://cms-assets.americanbookcompany.com/cache/containers/staff_photos/default-logo.png/5dd5ab7d7802efe82fe9170b149984f4/default-logo.webp",
    phone: "tel: 888-264-5877",
    email: "mailto: sales@abck12.com"
  },
  {
    id: 12,
    name: "David Pintozzi",
    title: "Georgia Account Executive",
    image:
      "https://cms-assets.americanbookcompany.com/cache/containers/staff_photos/david-pintozzi.png/7a92679225c838a6d94ff1c2e9fa338b/david-pintozzi.webp",
    phone: "tel: 888-264-5877",
    email: "mailto: djpintozzi@abck12.com"
  },
  {
    id: 13,
    name: "Danielle Pintozzi",
    title: "Alabama Account Executive",
    image:
      "https://cms-assets.americanbookcompany.com/cache/containers/staff_photos/danielle-pintozzi.png/772354a8bde3c1da0c0ae8aeb102e254/danielle-pintozzi.webp",
    phone: "tel: 470-725-5622",
    email: "mailto: drpintozzi@abck12.com"
  },
  {
    id: 14,
    name: "Elizabeth Hatfield",
    title: "Oklahoma Account Executive",
    image:
      "https://cms-assets.americanbookcompany.com/cache/containers/staff_photos/elizabeth-hatfiled.png/fb2e9bdaafcb299be79b98868c6ddfa7/elizabeth-hatfiled.webp",
    phone: "tel: 470-725-5711",
    email: "mailto: elizabeth.hatfield@abck12.com"
  },
  {
    id: 15,
    name: "Lindsey Cohn",
    title: "Alabama Account Executive",
    image:
      "https://cms-assets.americanbookcompany.com/cache/containers/staff_photos/lindsey-cohn2.png/affea71b9b15b71f4a57df967163e3b5/lindsey-cohn2.webp",
    phone: "tel: 470-725-5677",
    email: "mailto: lcohn@abck12.com"
  },
  {
    id: 16,
    name: "Derek Pintozzi",
    title: "Virginia Account Executive",
    image:
      "https://cms-assets.americanbookcompany.com/cache/containers/staff_photos/derek-pintozzi.png/79edbc617d722af9905af4ed77f15364/derek-pintozzi.webp",
    phone: "tel: 470-725-5719",
    email: "mailto: pintozzi@abck12.com"
  },
  {
    id: 17,
    name: "Zack Black",
    title: "Production Manager",
    image:
      "https://cms-assets.americanbookcompany.com/cache/containers/staff_photos/zack-black.png/453ec96f503957c5c465a5e553194e45/zack-black.webp"
  },
  {
    id: 18,
    name: "Grant Whaley",
    title: "Content Director",
    image:
      "https://cms-assets.americanbookcompany.com/cache/containers/staff_photos/grant-w.png/d3a7846a4fc653b73c583fef6c28454c/grant-w.webp"
  }
];

const DIVERSITY = {
  desktopImage:
    "https://americanbookcompany.com/_ipx/_/images/about/diversity_desktop_722x762px.png",
  mobileImage:
    "https://americanbookcompany.com/_ipx/_/images/about/diversity_mobile_518x320px.png",
  paragraphs: [
    "At American Book Company, we believe our people are the secret to creating great classroom solutions. We embrace the diversity of our team and make inclusion part of our core values. We celebrate the unique perspectives and skills each team member brings to work every day. A diverse team makes our solutions-the books and digital programs used in classrooms throughout the country-more accessible and engaging for all.",
    "American Book Company provides equal opportunities to all employees and applicants for employment without regard to race, religion, color, age, sex, national origin, sexual orientation, gender identity, genetic disposition, neurodiversity, disability, veteran status or any other protected category under federal, state and local law."
  ]
};

const ABC_CARES = [
  {
    id: 1,
    title: "Henry Arthur Callis Education Foundation",
    text: "Annually, ABC sponsors a hole at the Ervin Keith Hollman Memorial Scholarship Golf Classic benefitting the Henry Arthur Callis Foundation. The Henry Arthur Callis Education Foundation provides scholarships, educational and mentoring programs for Cobb County youth.",
    image:
      "https://cms-assets.americanbookcompany.com/abc_cares/about-us_carousel-abccares-1_396x344px.jpg"
  },
  {
    id: 2,
    title: "Sister-to-Sister Summit",
    text: "ABC was a proud sponsor of the 2023 Sister-to-Sister (S2S) Summit in Valdosta. The Summit is designed to inspire and empower regional middle school girls. The summit provided a unique educational and social experience for teens that focused on character education, STEM activities, and education and career development.",
    image:
      "https://cms-assets.americanbookcompany.com/abc_cares/about-us_carousel-abccares-3_396x344px.jpg"
  },
  {
    id: 3,
    title: "Union Parish High School",
    text: "Devastating tornadoes hit Union Parish Louisiana in December 2022. As part of tornado relief efforts, ABC donated books to Union Parish High School's Science and History Departments.",
    image:
      "https://cms-assets.americanbookcompany.com/abc_cares/about-us_carousel-abccares-2_396x344px.jpg"
  },
  {
    id: 4,
    title: "Proud sponsor of the ATL Science Fest",
    text: "ABC was a proud sponsor of the ATL Science Fest in March 2023. Our staff volunteers taught children from local area schools how paper is recycled using our own post-production materials.",
    image: "https://cms-assets.americanbookcompany.com/abc_cares/atl-science-fest.jpeg"
  }
];

const ENVIRONMENT = [
  {
    id: 1,
    title: "Recycling",
    text: "While manufacturing our print workbooks, thousands of tiny pieces of paper waste are created during the trimming process. Due to our recycling efforts, approximately 140,000 lbs of paper is saved from landfills annually.",
    image:
      "https://americanbookcompany.com/images/about/about-us_carousel-environment-1_396x344px.jpg"
  },
  {
    id: 2,
    title: "Energy Conservation",
    text: "ABC has invested in preserving energy resources with new 143w/19,500 lumen LED lighting. With this new lighting in our manufacturing facility, we use 65% less energy on lighting and also substantially reduce air conditioning usage due to these lower-temperature lights.",
    image:
      "https://americanbookcompany.com/images/about/about-us_carousel-environment-2_396x344px.jpg"
  }
];

const TESTIMONIALS = [
  {
    id: 1,
    name: "Dara Seamons",
    state: "",
    school: "",
    video: "https://www.youtube.com/embed/01vDDRVvVes?start=6"
  },
  {
    id: 2,
    name: "Pam Williams",
    state: "",
    school: "",
    video: "https://www.youtube.com/embed/7qTvStRVl2Q?start=8"
  },
  {
    id: 3,
    name: "Ms. Amilia Woolfork",
    state: "Georgia",
    school: "",
    video: "https://www.veed.io/embed/bae6cd3f-19fd-4b02-ad5d-bb5d0f3429eb"
  },
  {
    id: 4,
    name: "Antwayne Sanders",
    state: "",
    school: "",
    video: "https://www.youtube.com/embed/uI-hK4ZfR7I?start=10"
  },
  {
    id: 5,
    name: "Ben Fuhs",
    school: "South Lincoln High School",
    state: "Tennessee",
    video: "https://www.youtube.com/embed/Rb3-6_rsn6w"
  },
  {
    id: 6,
    name: "Sarah Webb",
    school: "David Crockett High School",
    state: "Tennessee",
    video: "https://www.youtube.com/embed/CwcggVXo-1o"
  }
];

const BUBBLE_IMAGE =
  "https://americanbookcompany.com/images/about/About-us-carousel-bubbles_68x342px.svg";
const TESTIMONIAL_ICON =
  "https://cms-assets.americanbookcompany.com/testimonials/default-logo-image.png";
const MOBILE_CAROUSEL_BREAKPOINT = 768;
const SWIPE_THRESHOLD = 48;

function getWindowedItems(items, startIndex, count) {
  if (!items.length || count <= 0) {
    return [];
  }

  const visibleCount = Math.min(count, items.length);
  const normalizedStart =
    ((startIndex % items.length) + items.length) % items.length;
  const windowedItems = [];

  for (let offset = 0; offset < visibleCount; offset += 1) {
    windowedItems.push(items[(normalizedStart + offset) % items.length]);
  }

  return windowedItems;
}

export default class AboutSection extends LightningElement {
  activeSection = "ourStaff";
  staffStartIndex = 0;
  abcCaresIndex = 0;
  environmentIndex = 0;
  viewportWidth = 1440;
  swipeState;
  sectionObserver;
  pendingSectionScroll;

  heroImage = aboutHeroImage;
  phoneIconUrl = phoneIcon;
  mailIconUrl = mailIcon;
  diversityDesktopImage = DIVERSITY.desktopImage;
  diversityMobileImage = DIVERSITY.mobileImage;
  bubbleImage = BUBBLE_IMAGE;
  testimonialIconUrl = TESTIMONIAL_ICON;
  iframeAllow =
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

  handleResize = () => {
    this.viewportWidth = globalThis.innerWidth || 1440;
  };

  handleHashChange = () => {
    const hashKey = (globalThis.location?.hash || "").replace("#", "");
    if (TAB_KEYS.has(hashKey)) {
      this.activeSection = hashKey;
      this.pendingSectionScroll = hashKey;
    }
  };

  connectedCallback() {
    this.handleResize();
    this.handleHashChange();
    globalThis.addEventListener("resize", this.handleResize);
    globalThis.addEventListener("hashchange", this.handleHashChange);
  }

  disconnectedCallback() {
    globalThis.removeEventListener("resize", this.handleResize);
    globalThis.removeEventListener("hashchange", this.handleHashChange);
    this.sectionObserver?.disconnect();
    this.sectionObserver = null;
  }

  renderedCallback() {
    this.initializeSectionObserver();
    this.flushPendingSectionScroll();
  }

  get tabList() {
    return TABS.map((tab) => ({
      ...tab,
      isActive: tab.key === this.activeSection,
      className: `section-nav-tab${
        tab.key === this.activeSection ? " section-nav-tab--active" : ""
      }`
    }));
  }

  get diversityParagraphs() {
    return DIVERSITY.paragraphs.map((paragraph, index) => ({
      id: `diversity-${index + 1}`,
      paragraph
    }));
  }

  get staffVisibleCount() {
    if (this.viewportWidth < 640) {
      return 1;
    }

    if (this.viewportWidth < 1024) {
      return 3;
    }

    return 5;
  }

  get isMobileCarouselViewport() {
    return this.viewportWidth < MOBILE_CAROUSEL_BREAKPOINT;
  }

  get visibleStaffMembers() {
    return getWindowedItems(STAFF, this.staffStartIndex, this.staffVisibleCount);
  }

  get testimonials() {
    return TESTIMONIALS;
  }

  get currentAbcCaresItem() {
    return ABC_CARES[this.abcCaresIndex];
  }

  get currentEnvironmentItem() {
    return ENVIRONMENT[this.environmentIndex];
  }

  get staffTrackStyle() {
    return `--visible-count: ${Math.min(this.staffVisibleCount, STAFF.length)};`;
  }

  handleTabClick(event) {
    const nextSection = event.currentTarget.dataset.key;
    if (!TAB_KEYS.has(nextSection)) {
      return;
    }

    this.activeSection = nextSection;
    this.scrollToSection(nextSection, "smooth");

    if (globalThis.history && globalThis.location) {
      globalThis.history.replaceState(
        null,
        "",
        `${globalThis.location.pathname}#${nextSection}`
      );
    }
  }

  handleStaffPrevious() {
    this.staffStartIndex =
      (this.staffStartIndex - 1 + STAFF.length) % STAFF.length;
  }

  handleStaffNext() {
    this.staffStartIndex = (this.staffStartIndex + 1) % STAFF.length;
  }

  handleAbcCaresPrevious() {
    this.abcCaresIndex =
      (this.abcCaresIndex - 1 + ABC_CARES.length) % ABC_CARES.length;
  }

  handleAbcCaresNext() {
    this.abcCaresIndex = (this.abcCaresIndex + 1) % ABC_CARES.length;
  }

  handleEnvironmentPrevious() {
    this.environmentIndex =
      (this.environmentIndex - 1 + ENVIRONMENT.length) % ENVIRONMENT.length;
  }

  handleEnvironmentNext() {
    this.environmentIndex = (this.environmentIndex + 1) % ENVIRONMENT.length;
  }

  handleCarouselTouchStart(event) {
    if (!this.isMobileCarouselViewport) {
      return;
    }

    const touch = event.touches?.[0];
    const carousel = event.currentTarget?.dataset?.carousel;
    if (!touch || !carousel) {
      return;
    }

    this.swipeState = {
      carousel,
      startX: touch.clientX,
      startY: touch.clientY,
      deltaX: 0,
      deltaY: 0
    };
  }

  handleCarouselTouchMove(event) {
    if (!this.isMobileCarouselViewport || !this.swipeState) {
      return;
    }

    const touch = event.touches?.[0];
    const carousel = event.currentTarget?.dataset?.carousel;
    if (!touch || this.swipeState.carousel !== carousel) {
      return;
    }

    this.swipeState = {
      ...this.swipeState,
      deltaX: touch.clientX - this.swipeState.startX,
      deltaY: touch.clientY - this.swipeState.startY
    };
  }

  handleCarouselTouchEnd(event) {
    if (!this.isMobileCarouselViewport || !this.swipeState) {
      return;
    }

    const carousel = event.currentTarget?.dataset?.carousel;
    const { carousel: activeCarousel, deltaX, deltaY } = this.swipeState;
    this.swipeState = null;

    if (activeCarousel !== carousel) {
      return;
    }

    if (
      Math.abs(deltaX) < SWIPE_THRESHOLD ||
      Math.abs(deltaX) <= Math.abs(deltaY)
    ) {
      return;
    }

    if (deltaX < 0) {
      this.advanceCarousel(activeCarousel);
      return;
    }

    this.rewindCarousel(activeCarousel);
  }

  handleCarouselTouchCancel() {
    this.swipeState = null;
  }

  advanceCarousel(carousel) {
    switch (carousel) {
      case "staff":
        this.handleStaffNext();
        break;
      case "abcCares":
        this.handleAbcCaresNext();
        break;
      case "environment":
        this.handleEnvironmentNext();
        break;
      default:
        break;
    }
  }

  rewindCarousel(carousel) {
    switch (carousel) {
      case "staff":
        this.handleStaffPrevious();
        break;
      case "abcCares":
        this.handleAbcCaresPrevious();
        break;
      case "environment":
        this.handleEnvironmentPrevious();
        break;
      default:
        break;
    }
  }

  initializeSectionObserver() {
    if (this.sectionObserver) {
      return;
    }

    const sections = Array.from(this.template.querySelectorAll("[data-section]"));
    if (!sections.length) {
      return;
    }

    this.sectionObserver = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (!visibleEntries.length) {
          return;
        }

        visibleEntries.sort((leftEntry, rightEntry) => {
          if (rightEntry.intersectionRatio !== leftEntry.intersectionRatio) {
            return rightEntry.intersectionRatio - leftEntry.intersectionRatio;
          }

          return (
            Math.abs(leftEntry.boundingClientRect.top) -
            Math.abs(rightEntry.boundingClientRect.top)
          );
        });

        const activeKey = visibleEntries[0]?.target?.dataset?.section;
        if (TAB_KEYS.has(activeKey)) {
          this.activeSection = activeKey;
        }
      },
      {
        root: null,
        rootMargin: "-20% 0px -60% 0px",
        threshold: [0.2, 0.35, 0.5, 0.75]
      }
    );

    sections.forEach((section) => this.sectionObserver.observe(section));
  }

  flushPendingSectionScroll() {
    if (!this.pendingSectionScroll) {
      return;
    }

    const nextSection = this.pendingSectionScroll;
    const didScroll = this.scrollToSection(nextSection, "auto");
    if (didScroll) {
      this.pendingSectionScroll = null;
    }
  }

  scrollToSection(sectionKey, behavior) {
    const section = this.template.querySelector(
      `[data-section="${sectionKey}"]`
    );
    if (!section) {
      return false;
    }

    section.scrollIntoView({ behavior, block: "start" });
    return true;
  }

}