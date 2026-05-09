import { LightningElement } from "lwc";
import {
  STATE_CHANGE_EVENT_NAMES,
  normalizeStateName,
  readStateFromStorage
} from "c/utils";
import repsAssets from "@salesforce/resourceUrl/abc_reps";
import badgesAssets from "@salesforce/resourceUrl/abc_badges";

const ZIP_ROOT_FOLDER = "abc_reps";
const DEFAULT_STATE = "Georgia";
const DEFAULT_PHONE = "(888) 264-5877";

const STATES = new Set([
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "District of Columbia",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming"
]);

const FOLDER_OVERRIDES = {
  "District of Columbia": "districtof-columbia"
};

function stateToFolder(stateName) {
  if (FOLDER_OVERRIDES[stateName]) return FOLDER_OVERRIDES[stateName];
  return (stateName || "").toLowerCase().trim().replaceAll(/\s+/g, "-");
}

function toTelHref(phone) {
  const digits = (phone || "").replaceAll(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "#";
}

function decodeDeep(str) {
  if (!str) return "";
  let out = str;
  let prev;
  do {
    prev = out;
    try {
      out = decodeURIComponent(out);
    } catch {
      break;
    }
  } while (out !== prev);
  return out;
}

const PLACEHOLDER_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="92" height="92">
  <circle cx="46" cy="46" r="46" fill="#e6e8eb"/>
  <text x="46" y="54" text-anchor="middle" font-size="18" fill="#666" font-family="Arial">ABC</text>
</svg>
`);

const SHARED_ABC_LOGO_BASE = "abc-sales-team";

const BADGES = [
  { key: "usfcr", file: "usfcr.png", alt: "USFCR Verified Vendor" },
  {
    key: "gachamber",
    file: "gachamber.png",
    alt: "Georgia Chamber of Commerce"
  },
  { key: "bbb", file: "bbb.png", alt: "BBB A+ Accredited Business" },
  { key: "aap", file: "aap.png", alt: "AAP Pre K-12 Learning Proud Member" },
  {
    key: "wbenc",
    file: "wbenc.png",
    alt: "Certified WBENC Women's Business Enterprise"
  },
  { key: "essa", file: "essa.png", alt: "Instructure Level 4 ESSA 2025" }
];

const REPS_BY_STATE = {
  Georgia: [
    {
      key: "ga-laura",
      name: "Laura Riffle",
      title: "Georgia Account Executive",
      phone: DEFAULT_PHONE,
      email: "lriffle@americanbookcompany.com",
      imageBase: "laura-riffle"
    },
    {
      key: "ga-dawn",
      name: "Dawn Bigby",
      title: "Georgia, Minnesota, & New Jersey Account Executive",
      phone: DEFAULT_PHONE,
      email: "dbigby@americanbookcompany.com",
      imageBase: "dawn-bigby"
    },
    {
      key: "ga-david",
      name: "David Pintozzi",
      title: "Georgia Account Executive",
      phone: DEFAULT_PHONE,
      email: "djpintozzi@americanbookcompany.com",
      imageBase: "david-pintozzi"
    }
  ],

  Alabama: [
    {
      key: "al-danielle",
      name: "Danielle Pintozzi",
      title: "Alabama Account Executive",
      phone: DEFAULT_PHONE,
      email: "drpintozzi@americanbookcompany.com",
      imageBase: "danielle-pintozzi"
    },
    {
      key: "al-lindsey",
      name: "Lindsey Cohn",
      title: "Alabama Account Executive",
      phone: DEFAULT_PHONE,
      email: "lcohn@americanbookcompany.com",
      imageBase: "lindsey-cohn"
    }
  ],

  Arkansas: [
    {
      key: "ar-debbie",
      name: "Debbie Price",
      title: "Arkansas & Louisiana Account Executive",
      phone: DEFAULT_PHONE,
      email: "dprice@americanbookcompany.com",
      imageBase: "debbie-price"
    },
    {
      key: "ar-danielle",
      name: "Danielle Pintozzi",
      title: "Arkansas Account Executive",
      phone: DEFAULT_PHONE,
      email: "drpintozzi@americanbookcompany.com",
      imageBase: "danielle-pintozzi"
    }
  ],

  Louisiana: [
    {
      key: "la-debbie",
      name: "Debbie Price",
      title: "Arkansas & Louisiana Account Executive",
      phone: DEFAULT_PHONE,
      email: "dprice@americanbookcompany.com",
      imageBase: "debbie-price"
    },
    {
      key: "la-michele",
      name: "Michele Lantz",
      title: "Senior Account Executive",
      phone: DEFAULT_PHONE,
      email: "mlantz@americanbookcompany.com",
      imageBase: "michele-lantz"
    }
  ],

  Kentucky: [
    {
      key: "ky-jenny",
      name: "Jenny Gale",
      title: "Senior Account Executive",
      phone: DEFAULT_PHONE,
      email: "jgale@americanbookcompany.com",
      imageBase: "jenny-gale"
    }
  ],

  Oklahoma: [
    {
      key: "ok-michele",
      name: "Michele Lantz",
      title: "Senior Account Executive",
      phone: DEFAULT_PHONE,
      email: "mlantz@americanbookcompany.com",
      imageBase: "michele-lantz"
    }
  ],

  Indiana: [
    {
      key: "in-laura",
      name: "Laura Riffle",
      title: "Indiana Account Executive",
      phone: DEFAULT_PHONE,
      email: "lriffle@americanbookcompany.com",
      imageBase: "laura-riffle"
    }
  ],

  Mississippi: [
    {
      key: "ms-jenny",
      name: "Jenny Gale",
      title: "Senior Account Executive",
      phone: DEFAULT_PHONE,
      email: "jgale@americanbookcompany.com",
      imageBase: "jenny-gale"
    }
  ],

  Tennessee: [
    {
      key: "tn-jenny",
      name: "Jenny Gale",
      title: "Senior Account Executive",
      phone: DEFAULT_PHONE,
      email: "jgale@americanbookcompany.com",
      imageBase: "jenny-gale"
    }
  ],

  "District of Columbia": [
    {
      key: "dc-rodney",
      name: "Rodney Adams",
      title: "Senior Account Executive",
      phone: DEFAULT_PHONE,
      email: "radams@americanbookcompany.com",
      imageBase: "rodney-adams"
    }
  ],

  Virginia: [
    {
      key: "va-derek",
      name: "Derek Pintozzi",
      title: "Virginia Account Executive",
      phone: DEFAULT_PHONE,
      email: "pintozzi@americanbookcompany.com",
      imageBase: "derek-pintozzi"
    }
  ],

  "North Carolina": [
    {
      key: "nc-glenn",
      name: "Glenn Davenport",
      title: "North & South Carolina Account Executive",
      phone: DEFAULT_PHONE,
      email: "gdavenport@americanbookcompany.com",
      imageBase: "glenn-davenport"
    }
  ],

  "South Carolina": [
    {
      key: "sc-glenn",
      name: "Glenn Davenport",
      title: "North & South Carolina Account Executive",
      phone: DEFAULT_PHONE,
      email: "gdavenport@americanbookcompany.com",
      imageBase: "glenn-davenport"
    }
  ],

  Minnesota: [
    {
      key: "mn-dawn",
      name: "Dawn Bigby",
      title: "Georgia, Minnesota, & New Jersey Account Executive",
      phone: DEFAULT_PHONE,
      email: "dbigby@americanbookcompany.com",
      imageBase: "dawn-bigby"
    }
  ],

  "New Jersey": [
    {
      key: "nj-dawn",
      name: "Dawn Bigby",
      title: "Georgia, Minnesota, & New Jersey Account Executive",
      phone: DEFAULT_PHONE,
      email: "dbigby@americanbookcompany.com",
      imageBase: "dawn-bigby"
    }
  ]
};

function defaultTeamRep() {
  return [
    {
      key: "abc-sales-team",
      name: "ABC Sales Team",
      title: "Sales and Customer Service",
      phone: DEFAULT_PHONE,
      email: "contact@americanbookcompany.com",
      imageBase: SHARED_ABC_LOGO_BASE,
      forceShared: true
    }
  ];
}

function buildUrl({ folder, base, ext, forceShared }) {
  const safeExt = ext || "webp";

  if (forceShared) {
    return `${repsAssets}/${ZIP_ROOT_FOLDER}/shared/${base}.${safeExt}`;
  }
  return `${repsAssets}/${ZIP_ROOT_FOLDER}/${folder}/${base}.${safeExt}`;
}

export default class StateReps extends LightningElement {
  selectedState = "";
  reps = [];

  _watchId;
  _lastHref = "";
  _boundStateChangeHandler;

  connectedCallback() {
    this._lastHref = globalThis.location.href;
    this.updateFromUrl();
    this._boundStateChangeHandler = (event) => this.handleStateChange(event);
    STATE_CHANGE_EVENT_NAMES.forEach((eventName) => {
      globalThis.addEventListener(eventName, this._boundStateChangeHandler);
    });

    this._watchId = globalThis.setInterval(() => {
      const href = globalThis.location.href;
      if (href !== this._lastHref) {
        this._lastHref = href;
        this.updateFromUrl();
      }
    }, 250);
  }

  disconnectedCallback() {
    globalThis.clearInterval(this._watchId);
    this._watchId = null;
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

  get hasState() {
    return !!this.selectedState;
  }

  get helpCardStyle() {
    return `background-image: url(${badgesAssets}/help_bg.png); background-size: cover; background-position: right top;`;
  }

  badges = BADGES.map((b) => ({ ...b, src: `${badgesAssets}/${b.file}` }));

  getStoredState() {
    const normalized = normalizeStateName(readStateFromStorage());
    return STATES.has(normalized) ? normalized : "";
  }

  updateFromUrl() {
    const url = new URL(globalThis.location.href);
    const state = this.resolveState(url);
    this.selectedState = state;
    this.reps = this.buildReps(state);
  }

  resolveState(url) {
    const fromParams = this.getStateFromParams(url);
    if (fromParams) return fromParams;

    const storedState = this.getStoredState();
    const hashState = normalizeStateName(
      decodeURIComponent((url.hash || "").replace("#", "").trim())
    );

    return storedState || hashState || DEFAULT_STATE;
  }

  getStateFromParams(url) {
    try {
      const refinementsRaw = url.searchParams.get("refinements");
      if (refinementsRaw) {
        const jsonStr = decodeDeep(refinementsRaw);
        const list = JSON.parse(jsonStr);
        const entry = Array.isArray(list)
          ? list.find((r) => r?.nameOrId === "State__c")
          : null;
        if (entry && Array.isArray(entry.values) && entry.values.length) {
          return normalizeStateName(entry.values[0]);
        }
      }

      const singleRef = url.searchParams.get("refinement");
      const decoded = singleRef ? decodeDeep(singleRef) : "";
      if (decoded.startsWith("State__c:")) {
        return normalizeStateName(decoded.substring("State__c:".length));
      }
    } catch {
      // ignore
    }
    return "";
  }

  handleStateChange(event) {
    const nextState = normalizeStateName(
      event?.detail?.state || event?.detail?.selectedState || ""
    );
    if (!nextState || nextState === this.selectedState) {
      return;
    }

    this.selectedState = nextState;
    this.reps = this.buildReps(nextState);
  }

  buildReps(state) {
    if (!state) return [];

    const folder = stateToFolder(state);

    const list = REPS_BY_STATE[state]?.length
      ? REPS_BY_STATE[state]
      : defaultTeamRep();

    return list.map((r) => {
      const forceShared = !!r.forceShared;
      const imageBase = r.imageBase;
      const imageUrl = buildUrl({
        folder,
        base: imageBase,
        ext: "webp",
        forceShared
      });

      return {
        ...r,
        stateFolder: folder,
        imageBase,
        forceShared,
        imageUrl,
        telHref: toTelHref(r.phone),
        mailHref: r.email ? `mailto:${r.email}` : "#"
      };
    });
  }

  handleImgError(event) {
    const img = event.target;
    const folder = img.dataset.statefolder;
    const base = img.dataset.imagebase;
    const forceShared = img.dataset.forceshared === "true";

    const t = Number(img.dataset.try || "0") + 1;
    img.dataset.try = String(t);

    const R = `${repsAssets}/${ZIP_ROOT_FOLDER}`;
    const fallbacks = forceShared
      ? [`${R}/shared/${base}.png`, PLACEHOLDER_SVG]
      : [
          `${R}/shared/${base}.webp`,
          `${R}/${folder}/${base}.png`,
          `${R}/shared/${base}.png`,
          PLACEHOLDER_SVG
        ];

    img.src = fallbacks[t - 1] ?? PLACEHOLDER_SVG;
  }
}
