import { LightningElement } from "lwc";
import {
  dispatchStateChange,
  normalizeStateName,
  readStateFromStorage,
  STATE_CHANGE_EVENT_NAMES,
  writeStateToStorage
} from "c/utils";

export default class CatalogDownloader extends LightningElement {
  selectedStateData;

  catalogData = [
    // https://cms-assets.americanbookcompany.com/catalogs/pdfs/ga-catalog-spring-022426v2-web.pdf?c=0.3496255657002909
    ///sfsites/c/cms/delivery/media/MCFM5GBPACZ5AN5FBXQZYZ4ZSTO4
    {
      value: "al",
      label: "Alabama",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/al-catalog-thumb.jpg",
      pdfUrl: "sfsites/c/cms/delivery/media/MCFM5GBPACZ5AN5FBXQZYZ4ZSTO4"
    },
    {
      value: "ak",
      label: "Alaska",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/al-catalog-spring-022426v4-web.pdf?c=0.2678821016196794"
    },
    {
      value: "az",
      label: "Arizona",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.8108636324608934"
    },
    {
      value: "ar",
      label: "Arkansas",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ar-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.8108636324608934"
    },
    {
      value: "ca",
      label: "California",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ca-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ca-catalog-spring-022426v2-web.pdf?c=0.8970446519253594"
    },
    {
      value: "co",
      label: "Colorado",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.6151497162769771"
    },
    {
      value: "ct",
      label: "Connecticut",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.5811540632520035"
    },
    {
      value: "de",
      label: "Delaware",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/dc-catalog-spring-022426v2-web.pdf?c=0.22819207273350994"
    },
    {
      value: "dc",
      label: "District of Columbia",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/dc-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.6041260043409448"
    },
    {
      value: "fl",
      label: "Florida",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.5352336600049872"
    },
    {
      value: "ga",
      label: "Georgia",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ga-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ga-catalog-spring-022426v2-web.pdf?c=0.4276588732214416"
    },
    {
      value: "hi",
      label: "Hawaii",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.18299460484355157"
    },
    {
      value: "id",
      label: "Idaho",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.8688279913818876"
    },
    {
      value: "il",
      label: "Illinois",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/il-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/il-catalog-spring-022426v2-web.pdf?c=0.2312688278955103"
    },
    {
      value: "in",
      label: "Indiana",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/in-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/in-catalog-spring-022426v2-web.pdf?c=0.926441886475747"
    },
    {
      value: "ia",
      label: "Iowa",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.9654259427977087"
    },
    {
      value: "ks",
      label: "Kansas",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.1899381661224787"
    },
    {
      value: "ky",
      label: "Kentucky",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ky-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ky-catalog-spring-022426v4-web.pdf?c=0.5627256842054549"
    },
    {
      value: "la",
      label: "Louisiana",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/la-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/la-catalog-spring-022426v2-web.pdf?c=0.6750435291221951"
    },
    {
      value: "me",
      label: "Maine",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.7401535597206456"
    },
    {
      value: "md",
      label: "Maryland",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.9900215861320913"
    },
    {
      value: "ma",
      label: "Massachusetts",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.005703939499862254"
    },
    {
      value: "mi",
      label: "Michigan",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.5786841755130591"
    },
    {
      value: "mn",
      label: "Minnesota",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/mn-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/mn-catalog-spring-022526v2-web.pdf?c=0.37425974183569877"
    },
    {
      value: "ms",
      label: "Mississippi",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ms-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ms-catalog-spring-022526v2-web.pdf?c=0.2555136932325688"
    },
    {
      value: "mo",
      label: "Missouri",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.33715482390796847"
    },
    {
      value: "mt",
      label: "Montana",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.9837420439424117"
    },
    {
      value: "ne",
      label: "Nebraska",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.10460897709027028"
    },
    {
      value: "nv",
      label: "Nevada",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.19505263344992618"
    },
    {
      value: "nh",
      label: "New Hampshire",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.7285217650045018"
    },
    {
      value: "nj",
      label: "New Jersey",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/nj-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/nj-catalog-spring-022526v2-web.pdf?c=0.3877748411010232"
    },
    {
      value: "nm",
      label: "New Mexico",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/nm-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/nm-catalog-spring-022526v2-web.pdf?c=0.4709201901858536"
    },
    {
      value: "ny",
      label: "New York",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.6399840772998396"
    },
    {
      value: "nc",
      label: "North Carolina",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/nc-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/nc-catalog-spring-022526v2-web.pdf?c=0.5491799727363743"
    },
    {
      value: "nd",
      label: "North Dakota",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.4706868269437864"
    },
    {
      value: "oh",
      label: "Ohio",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.35091832330316086"
    },
    {
      value: "ok",
      label: "Oklahoma",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ok-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ok-catalog-spring-022526v3-web.pdf?c=0.9863467913093098"
    },
    {
      value: "or",
      label: "Oregon",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.11764785387893173"
    },
    {
      value: "pa",
      label: "Pennsylvania",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.5052052192463738"
    },
    {
      value: "ri",
      label: "Rhode Island",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.038895140314791576"
    },
    {
      value: "sc",
      label: "South Carolina",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/sc-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/sc-catalog-spring-022526v2-web.pdf?c=0.9746598479635874"
    },
    {
      value: "sd",
      label: "South Dakota",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.06233473928475375"
    },
    {
      value: "tn",
      label: "Tennessee",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/tn-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/tn-catalog-spring-022526v2-web.pdf?c=0.7229801975790827"
    },
    {
      value: "tx",
      label: "Texas",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.1308678594297228"
    },
    {
      value: "ut",
      label: "Utah",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.8980279698405141"
    },
    {
      value: "vt",
      label: "Vermont",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.8256631218111138"
    },
    {
      value: "va",
      label: "Virginia",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/va-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/va-catalog-spring-022526v2-web.pdf?c=0.2806114381015332"
    },
    {
      value: "wa",
      label: "Washington",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.6103639484544547"
    },
    {
      value: "wv",
      label: "West Virginia",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.821823062249343"
    },
    {
      value: "wi",
      label: "Wisconsin",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.8727392973641426"
    },
    {
      value: "wy",
      label: "Wyoming",
      imageUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/cover-images/ntl-catalog-thumb.jpg",
      pdfUrl:
        "https://cms-assets.americanbookcompany.com/catalogs/pdfs/ntl-catalog-spring-022526v2-web.pdf?c=0.5696006626079552"
    }
  ];

  connectedCallback() {
    this.selectedStateData = this.catalogData[0];
    this.applySelectedState(readStateFromStorage());

    this._handleStateChange = (event) => {
      this.applySelectedState(
        event?.detail?.state ||
          event?.detail?.selectedState ||
          readStateFromStorage()
      );
    };

    STATE_CHANGE_EVENT_NAMES.forEach((eventName) => {
      globalThis.addEventListener(eventName, this._handleStateChange);
    });
  }

  disconnectedCallback() {
    if (this._handleStateChange) {
      STATE_CHANGE_EVENT_NAMES.forEach((eventName) => {
        globalThis.removeEventListener(eventName, this._handleStateChange);
      });
    }
  }

  applySelectedState(stateValue) {
    const normalizedState = normalizeStateName(stateValue);
    if (!normalizedState) {
      return;
    }

    const match = this.catalogData.find(
      (state) => state.label === normalizedState
    );
    if (match) {
      this.selectedStateData = match;
    }
  }

  get stateOptions() {
    return this.catalogData.map((item) => {
      return {
        label: item.label,
        value: item.value,
        selected: item.value === this.selectedStateData?.value
      };
    });
  }

  handleStateChange(event) {
    const selectedValue = event.target.value;
    const selectedState = this.catalogData.find(
      (state) => state.value === selectedValue
    );
    if (!selectedState) {
      return;
    }

    this.selectedStateData = selectedState;
    writeStateToStorage(selectedState.label);
    dispatchStateChange(selectedState.label);
  }

  get showCatalog() {
    return this.selectedStateData != null;
  }

  get currentPdfUrl() {
    return this.selectedStateData?.pdfUrl || "#";
  }

  get catalogTitle() {
    return `${this.selectedStateData.label} Catalog`;
  }

  get catalogDescription() {
    return `Contains printed pricing and details for all ${this.selectedStateData.label} books, contact information for our ${this.selectedStateData.label} salespeople and other important information to help you better understand ABC's offerings.`;
  }
}
