import { LightningElement, api, track } from "lwc";
import { loadScript, loadStyle } from "lightning/platformResourceLoader";
import getCarouselData from "@salesforce/apex/TestimonialCarouselController.getCarouselData";
import LOGO_URL from "@salesforce/resourceUrl/testimonialsLogo";
import SWIPER from "@salesforce/resourceUrl/SwiperJS";
import US_GEOJSON from "@salesforce/resourceUrl/US_GeoJson";
import MAPBOX_GL_JS_RESOURCE from "@salesforce/resourceUrl/mapbox_gl";
import MAPBOX_GL_CSS_RESOURCE from "@salesforce/resourceUrl/mapbox_glcss";

const MAPBOX_GL_JS = MAPBOX_GL_JS_RESOURCE;
const MAPBOX_GL_CSS = MAPBOX_GL_CSS_RESOURCE;
const SOURCE_ID = "county-source";
const FILL_LAYER_ID = "county-fill";
const LINE_LAYER_ID = "county-outline";
const VALUE_LAYER_ID = "county-values";
const COUNTY_NAME_LAYER_ID = "county-name";
const STORAGE_KEY = "abc_selected_state";
const STATE_REFINEMENT_KEY = "State__c";
const REFINEMENTS_PARAM = "refinements";
const DEFAULT_MAPBOX_ACCESS_TOKEN =
  "pk.eyJ1IjoiYWthc2h0aGVsb2Rlc3RvbmVncm91cCIsImEiOiJjbW05bG5kaGMwMHQ1Mm9zM3lrM25ydTRwIn0.pSVyEJv1yK_Z8_U1tXKHTA";

const ROLE_PREVIEW = "preview";
const ROLE_MODAL = "modal";
const DEFAULT_LEGEND_MAX = 25;
const LEGEND_STEP = 5;
const LEGEND_COLOR_SCALE = [
  "#e2e4e8",
  "#ece794",
  "#e8d25f",
  "#ecac4e",
  "#d77a3d",
  "#b34139",
  "#7a0b2e",
  "#4f031f"
];

const STATE_NAME_TO_FIPS = {
  ALABAMA: "01",
  ALASKA: "02",
  ARIZONA: "04",
  ARKANSAS: "05",
  CALIFORNIA: "06",
  COLORADO: "08",
  CONNECTICUT: "09",
  DELAWARE: "10",
  FLORIDA: "12",
  GEORGIA: "13",
  HAWAII: "15",
  IDAHO: "16",
  ILLINOIS: "17",
  INDIANA: "18",
  IOWA: "19",
  KANSAS: "20",
  KENTUCKY: "21",
  LOUISIANA: "22",
  MAINE: "23",
  MARYLAND: "24",
  MASSACHUSETTS: "25",
  MICHIGAN: "26",
  MINNESOTA: "27",
  MISSISSIPPI: "28",
  MISSOURI: "29",
  MONTANA: "30",
  NEBRASKA: "31",
  NEVADA: "32",
  "NEW HAMPSHIRE": "33",
  "NEW JERSEY": "34",
  "NEW MEXICO": "35",
  "NEW YORK": "36",
  "NORTH CAROLINA": "37",
  "NORTH DAKOTA": "38",
  OHIO: "39",
  OKLAHOMA: "40",
  OREGON: "41",
  PENNSYLVANIA: "42",
  "RHODE ISLAND": "44",
  "SOUTH CAROLINA": "45",
  "SOUTH DAKOTA": "46",
  TENNESSEE: "47",
  TEXAS: "48",
  UTAH: "49",
  VERMONT: "50",
  VIRGINIA: "51",
  WASHINGTON: "53",
  "WEST VIRGINIA": "54",
  WISCONSIN: "55",
  WYOMING: "56"
};

const STATE_FIPS_TO_ABBR = {
  "01": "AL",
  "02": "AK",
  "04": "AZ",
  "05": "AR",
  "06": "CA",
  "08": "CO",
  "09": "CT",
  10: "DE",
  12: "FL",
  13: "GA",
  15: "HI",
  16: "ID",
  17: "IL",
  18: "IN",
  19: "IA",
  20: "KS",
  21: "KY",
  22: "LA",
  23: "ME",
  24: "MD",
  25: "MA",
  26: "MI",
  27: "MN",
  28: "MS",
  29: "MO",
  30: "MT",
  31: "NE",
  32: "NV",
  33: "NH",
  34: "NJ",
  35: "NM",
  36: "NY",
  37: "NC",
  38: "ND",
  39: "OH",
  40: "OK",
  41: "OR",
  42: "PA",
  44: "RI",
  45: "SC",
  46: "SD",
  47: "TN",
  48: "TX",
  49: "UT",
  50: "VT",
  51: "VA",
  53: "WA",
  54: "WV",
  55: "WI",
  56: "WY"
};

export default class MapPlusTestimonial extends LightningElement {
  @api mapboxAccessToken = DEFAULT_MAPBOX_ACCESS_TOKEN;
  @api geoJsonPath;
  @api stateFips = "";
  @api titleYear = "2026";
  _selectedState = "Georgia";

  hasRendered = false;
  assetsReady = false;
  isLoadingData = false;
  isModalOpen = false;
  errorMessage;
  previewMap;
  modalMap;
  previewMapLoaded = false;
  modalMapLoaded = false;
  lastFeatureCollection;
  geoJsonPromise;
  renderRequestId = 0;
  pendingRefresh = false;
  _boundStateEventHandler;
  _boundKeyDownHandler;
  legendEntries = [];
  fillColorExpression = [];
  hoverMoveHandlers = {};
  hoverLeaveHandlers = {};
  hoverClickHandlers = {};
  hoverPopups = {};

  @track currentState = "Georgia";
  @track formattedSlides = [];
  @track isLoading = true;

  swiperInitialized = false;
  swiperInstance = null;

  _watchId;
  _lastHash = "";

  connectedCallback() {
    this.legendEntries = this.getLegendEntriesForMax(DEFAULT_LEGEND_MAX);
    this.fillColorExpression = this.buildFillColorExpression(
      this.legendEntries
    );
    this.updateStateFromUrlOrStorage();
    this.applySelectedStateFromContext();
    this.fetchCarouselData();
    this.startHashWatcher();
    this._boundStateEventHandler = (event) =>
      this.handleExternalStateChange(event);
    this._boundKeyDownHandler = (event) => this.handleWindowKeyDown(event);
    globalThis.addEventListener("abcstatechange", this._boundStateEventHandler);
    globalThis.addEventListener("statechange", this._boundStateEventHandler);
    globalThis.addEventListener("keydown", this._boundKeyDownHandler);
  }

  disconnectedCallback() {
    this.stopHashWatcher();
    if (this._boundStateEventHandler) {
      globalThis.removeEventListener(
        "abcstatechange",
        this._boundStateEventHandler
      );
      globalThis.removeEventListener(
        "statechange",
        this._boundStateEventHandler
      );
    }
    if (this._boundKeyDownHandler) {
      globalThis.removeEventListener("keydown", this._boundKeyDownHandler);
    }
    if (this.swiperInstance) {
      this.swiperInstance.destroy(true, true);
      this.swiperInstance = null;
    }
    this.destroyMap(ROLE_MODAL);
    this.destroyMap(ROLE_PREVIEW);
  }

  renderedCallback() {
    if (!this.hasRendered) {
      this.hasRendered = true;
      this.initialize();
      return;
    }

    if (this.assetsReady) {
      this.syncMapInstances();
    }
  }

  get logoUrl() {
    return LOGO_URL;
  }

  get isCompact() {
    return true;
  }

  get isExpandable() {
    return true;
  }

  get cardClass() {
    return this.isExpandable
      ? "swiper-slide map-card map-card--interactive"
      : "swiper-slide map-card";
  }

  get stateAbbreviation() {
    const resolvedFips = this.resolveStateFips(
      String(this.selectedState || "").toUpperCase()
    );
    return (
      STATE_FIPS_TO_ABBR[resolvedFips] ||
      String(this.selectedState || "")
        .slice(0, 2)
        .toUpperCase()
    );
  }

  get compactTitle() {
    return `${this.stateAbbreviation} School Partners`;
  }

  get modalTitle() {
    return `${this.stateAbbreviation} School Partners ${this.titleYear}`;
  }

  get expandButtonLabel() {
    return `Expand ${this.compactTitle} map`;
  }

  get stateWatermark() {
    return String(this.selectedState || "").toUpperCase();
  }

  get legendRows() {
    const source = this.legendEntries?.length
      ? this.legendEntries
      : this.getLegendEntriesForMax(DEFAULT_LEGEND_MAX);
    return source.map((entry, index) => ({
      key: `${entry.min}-${entry.max}-${index}`,
      rangeLabel: this.formatLegendRange(entry),
      swatchStyle: `background-color: ${entry.color};`
    }));
  }

  get hasData() {
    return (
      Array.isArray(this.formattedSlides) && this.formattedSlides.length > 0
    );
  }

  @api
  get selectedState() {
    return this._selectedState;
  }

  set selectedState(value) {
    this._selectedState = value || "Georgia";
    if (this.assetsReady) {
      this.refreshRenderedMaps();
    }
  }

  applySelectedStateFromContext() {
    const urlState = this.getSelectedStateFromUrl();
    const storedState = globalThis.localStorage.getItem(STORAGE_KEY);
    const resolved = this.getValidStateName(
      urlState || storedState || this._selectedState
    );
    this._selectedState = resolved;
  }

  handleExternalStateChange(event) {
    const value = String(
      event?.detail?.state || event?.detail?.selectedState || ""
    ).trim();
    if (!value) {
      return;
    }

    this.selectedState = this.getValidStateName(value);
  }

  handleWindowKeyDown(event) {
    if (event.key === "Escape" && this.isModalOpen) {
      this.closeModal();
    }
  }

  async initialize() {
    try {
      await this.loadMapboxAssets();
      this.assetsReady = true;
      await this.syncMapInstances();
    } catch (error) {
      this.handleError(error, "Unable to initialize map.");
    }
  }

  async syncMapInstances() {
    await this.ensureMap(ROLE_PREVIEW);

    if (this.isModalOpen) {
      await this.ensureMap(ROLE_MODAL);
      this.scheduleResize(ROLE_MODAL);
    } else if (this.modalMap) {
      this.destroyMap(ROLE_MODAL);
    }

    this.scheduleResize(ROLE_PREVIEW);
  }

  async ensureMap(role) {
    const existingMap = this.getMap(role);
    if (existingMap) {
      return;
    }

    const container = this.template.querySelector(`[data-map-role="${role}"]`);
    if (!container) {
      return;
    }

    await this.initializeMap(role, container);
  }

  async initializeMap(role, container) {
    const accessToken = this.getResolvedAccessToken();
    if (accessToken) {
      mapboxgl.accessToken = accessToken;
    }

    const map = new mapboxgl.Map({
      container,
      style: this.getMapStyle(),
      center: [-83.5, 32.9],
      zoom: role === ROLE_PREVIEW && this.isCompact ? 5.4 : 6.2,
      renderWorldCopies: false,
      attributionControl: false,
      dragRotate: false,
      touchZoomRotate: true,
      boxZoom: false
    });

    if (!(role === ROLE_PREVIEW && this.isCompact)) {
      map.addControl(new mapboxgl.NavigationControl(), "bottom-left");
    }

    if (role === ROLE_PREVIEW) {
      this.previewMap = map;
    } else {
      this.modalMap = map;
    }

    map.on("load", async () => {
      if (role === ROLE_PREVIEW) {
        this.previewMapLoaded = true;
      } else {
        this.modalMapLoaded = true;
      }

      this.hideMapboxBranding(map);
      await this.refreshRenderedMaps();
    });
  }

  destroyMap(role) {
    const map = this.getMap(role);
    if (!map) {
      return;
    }

    this.teardownHoverInteractions(map, role);
    map.remove();

    if (role === ROLE_PREVIEW) {
      this.previewMap = null;
      this.previewMapLoaded = false;
    } else {
      this.modalMap = null;
      this.modalMapLoaded = false;
    }
  }

  getMap(role) {
    return role === ROLE_MODAL ? this.modalMap : this.previewMap;
  }

  isMapLoaded(role) {
    return role === ROLE_MODAL ? this.modalMapLoaded : this.previewMapLoaded;
  }

  scheduleResize(role) {
    const map = this.getMap(role);
    if (!map) {
      return;
    }

    globalThis.requestAnimationFrame(() => {
      map.resize();
      this.hideMapboxBranding(map);
      if (this.lastFeatureCollection?.features?.length) {
        this.fitToFeatures(map, this.lastFeatureCollection.features, role);
      }
    });
  }

  hideMapboxBranding(map) {
    const container = map?.getContainer?.();
    if (!container) {
      return;
    }

    const logo = container.querySelector(".mapboxgl-ctrl-logo");
    if (logo) {
      logo.style.display = "none";
    }

    const compactControlGroup = container.querySelector(
      ".mapboxgl-ctrl-bottom-left"
    );
    if (
      compactControlGroup &&
      !compactControlGroup.querySelector(".mapboxgl-ctrl")
    ) {
      compactControlGroup.style.display = "none";
    }
  }

  loadMapboxAssets() {
    return Promise.all([
      this.loadScript(MAPBOX_GL_JS),
      this.loadStyle(MAPBOX_GL_CSS)
    ]);
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  loadStyle(href) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`link[href="${href}"]`)) {
        resolve();
        return;
      }

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onload = () => resolve();
      link.onerror = () =>
        reject(new Error(`Failed to load stylesheet: ${href}`));
      document.head.appendChild(link);
    });
  }

  getMapStyle() {
    return {
      version: 8,
      glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
      sources: {},
      layers: [
        {
          id: "background",
          type: "background",
          paint: {
            "background-color": "rgba(247, 247, 247, 0)"
          }
        }
      ]
    };
  }

  getResolvedAccessToken() {
    const explicitToken = String(this.mapboxAccessToken || "").trim();
    return explicitToken || null;
  }

  async refreshRenderedMaps() {
    if (!this.hasAnyLoadedMap()) {
      return;
    }

    if (this.isLoadingData) {
      this.pendingRefresh = true;
      return;
    }

    this.isLoadingData = true;
    this.pendingRefresh = false;
    this.errorMessage = null;
    const requestId = ++this.renderRequestId;

    try {
      const geoJson = await this.fetchGeoJson();
      const featureCollection = this.buildStateFeatureCollection(
        geoJson,
        this.selectedState
      );

      if (!featureCollection.features.length) {
        throw new Error(
          `No county features found for state: ${this.selectedState}`
        );
      }

      this.lastFeatureCollection = featureCollection;
      this.legendEntries = this.getLegendEntriesForFeatures(
        featureCollection.features
      );
      this.fillColorExpression = this.buildFillColorExpression(
        this.legendEntries
      );

      if (this.previewMapLoaded && this.previewMap) {
        this.renderCountyLayers(this.previewMap, featureCollection);
        this.fitToFeatures(
          this.previewMap,
          featureCollection.features,
          ROLE_PREVIEW
        );
      }

      if (
        requestId === this.renderRequestId &&
        this.modalMapLoaded &&
        this.modalMap
      ) {
        this.renderCountyLayers(this.modalMap, featureCollection);
        this.fitToFeatures(
          this.modalMap,
          featureCollection.features,
          ROLE_MODAL
        );
      }
    } catch (error) {
      this.handleError(error, "Unable to render state county map.");
    } finally {
      this.isLoadingData = false;
      if (this.pendingRefresh) {
        this.pendingRefresh = false;
        this.refreshRenderedMaps();
      }
    }
  }

  hasAnyLoadedMap() {
    return (
      (this.previewMapLoaded && this.previewMap) ||
      (this.modalMapLoaded && this.modalMap)
    );
  }

  async fetchGeoJson() {
    if (!this.geoJsonPromise) {
      const resourceUrl = this.geoJsonPath
        ? `${US_GEOJSON}/${this.geoJsonPath}`
        : US_GEOJSON;
      this.geoJsonPromise = fetch(resourceUrl)
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              `Failed to load US_GeoJson static resource. HTTP ${response.status}`
            );
          }
          return response.json();
        })
        .catch((error) => {
          this.geoJsonPromise = null;
          throw error;
        });
    }

    return this.geoJsonPromise;
  }

  buildStateFeatureCollection(geoJson, stateName) {
    const targetState = String(stateName || "")
      .trim()
      .toUpperCase();
    const targetStateFips = this.resolveStateFips(targetState);
    const features = (geoJson?.features || [])
      .filter((feature) =>
        this.featureBelongsToState(feature, targetState, targetStateFips)
      )
      .map((feature) => {
        const countyName = this.getCountyName(feature);
        const value = this.resolveMetricValue(feature);

        return {
          ...feature,
          properties: {
            ...feature.properties,
            countyName,
            metricValue: value
          }
        };
      });

    return {
      type: "FeatureCollection",
      features
    };
  }

  resolveStateFips(targetState) {
    const explicitFips = String(this.stateFips || "").trim();
    if (explicitFips) {
      return explicitFips.padStart(2, "0");
    }

    return STATE_NAME_TO_FIPS[targetState] || null;
  }

  featureBelongsToState(feature, targetState, targetStateFips) {
    const props = feature?.properties || {};
    const stateName =
      props.STATE_NAME ||
      props.state_name ||
      props.STATE ||
      props.state ||
      props.STUSPS ||
      props.STATE_ABBR ||
      "";

    const stateFips = String(
      props.STATEFP || props.statefp || props.STATE || props.state || ""
    )
      .trim()
      .padStart(2, "0");
    if (targetStateFips && stateFips === targetStateFips) {
      return true;
    }

    return String(stateName).trim().toUpperCase() === targetState;
  }

  getCountyName(feature) {
    const props = feature?.properties || {};
    const rawName =
      props.NAME ||
      props.name ||
      props.COUNTY ||
      props.county ||
      props.NAMELSAD ||
      "Unknown";

    return String(rawName)
      .replace(/\s+County$/i, "")
      .trim();
  }

  resolveMetricValue(feature) {
    const props = feature?.properties || {};

    const explicit = Number(
      props.metricValue || props.METRIC_VALUE || props.value || props.VALUE
    );
    if (!Number.isNaN(explicit) && explicit >= 0) {
      return explicit;
    }

    const countyCode = Number(props.COUNTY || props.county || feature?.id || 0);
    if (!Number.isNaN(countyCode) && countyCode > 0) {
      return countyCode % 26;
    }

    return 0;
  }

  renderCountyLayers(map, featureCollection) {
    this.removeLayerIfExists(map, COUNTY_NAME_LAYER_ID);
    this.removeLayerIfExists(map, VALUE_LAYER_ID);
    this.removeLayerIfExists(map, LINE_LAYER_ID);
    this.removeLayerIfExists(map, FILL_LAYER_ID);
    this.removeSourceIfExists(map, SOURCE_ID);

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: featureCollection
    });

    map.addLayer({
      id: FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-color": this.fillColorExpression,
        "fill-opacity": 1
      }
    });

    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      paint: {
        "line-color": "#8a8a8a",
        "line-width": 1
      }
    });

    map.addLayer({
      id: VALUE_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      maxzoom:
        map === this.previewMap && this.isCompact
          ? 24
          : this.getCountyLabelMinZoom(map),
      layout: {
        "text-field":
          map === this.previewMap && this.isCompact
            ? [
                "case",
                [
                  ">",
                  ["coalesce", ["to-number", ["get", "metricValue"]], 0],
                  10
                ],
                ["to-string", ["get", "metricValue"]],
                ""
              ]
            : ["to-string", ["get", "metricValue"]],
        "text-size": this.getMapLabelSize(map),
        "text-font": ["Open Sans Semibold"],
        "text-allow-overlap": map === this.previewMap && this.isCompact,
        "text-ignore-placement": map === this.previewMap && this.isCompact,
        "symbol-sort-key": [
          "coalesce",
          ["to-number", ["get", "metricValue"]],
          0
        ]
      },
      paint: {
        "text-color": "#1f2937",
        "text-halo-color": "#fff",
        "text-halo-width": 1.2
      }
    });

    map.addLayer({
      id: COUNTY_NAME_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      minzoom: this.getCountyLabelMinZoom(map),
      layout: {
        "text-field": [
          "concat",
          ["upcase", ["coalesce", ["get", "countyName"], ""]],
          "\n",
          ["to-string", ["coalesce", ["to-number", ["get", "metricValue"]], 0]]
        ],
        "text-size": this.getCountyLabelSize(map),
        "text-font": ["Open Sans Bold"],
        "text-line-height": 1.1,
        "text-max-width": 8,
        "text-anchor": "center",
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "symbol-sort-key": [
          "coalesce",
          ["to-number", ["get", "metricValue"]],
          0
        ]
      },
      paint: {
        "text-color": "#1d2f42",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.4,
        "text-halo-blur": 0.2
      }
    });

    this.bindHoverInteractions(map);
  }

  getMapLabelSize(map) {
    if (map === this.previewMap && this.isCompact) {
      return 8.5;
    }

    return 10;
  }

  getCountyLabelSize(map) {
    if (map === this.previewMap && this.isCompact) {
      return 8;
    }

    return 9.5;
  }

  getCountyLabelMinZoom(map) {
    if (map === this.previewMap && this.isCompact) {
      return 24;
    }

    return 4.9;
  }

  getLegendEntriesForFeatures(features) {
    const maxMetric = (features || []).reduce((maxValue, feature) => {
      const value = Number(feature?.properties?.metricValue);
      if (Number.isNaN(value) || value < 0) {
        return maxValue;
      }

      return Math.max(maxValue, value);
    }, 0);

    return this.getLegendEntriesForMax(maxMetric);
  }

  getLegendEntriesForMax(maxMetricValue) {
    const safeMax = Math.max(0, Math.ceil(Number(maxMetricValue) || 0));
    const entries = [
      {
        min: 0,
        max: 0,
        color: this.getLegendColor(0)
      }
    ];

    let rangeIndex = 1;
    let start = 1;
    while (start <= safeMax) {
      const end = Math.min(start + LEGEND_STEP - 1, safeMax);
      entries.push({
        min: start,
        max: end,
        color: this.getLegendColor(rangeIndex)
      });

      rangeIndex += 1;
      start += LEGEND_STEP;
    }

    if (entries.length === 1) {
      entries.push({
        min: 1,
        max: LEGEND_STEP,
        color: this.getLegendColor(1)
      });
    }

    return entries;
  }

  getLegendColor(index) {
    return LEGEND_COLOR_SCALE[Math.min(index, LEGEND_COLOR_SCALE.length - 1)];
  }

  formatLegendRange(entry) {
    if (!entry) {
      return "";
    }

    if (entry.min === 0 && entry.max === 0) {
      return "0";
    }

    if (entry.min === entry.max) {
      return String(entry.min);
    }

    return `${entry.min}-${entry.max}`;
  }

  buildFillColorExpression(entries) {
    const legendEntries = entries?.length
      ? entries
      : this.getLegendEntriesForMax(DEFAULT_LEGEND_MAX);
    const expression = [
      "step",
      ["coalesce", ["to-number", ["get", "metricValue"]], 0],
      legendEntries[0].color
    ];

    legendEntries.slice(1).forEach((entry) => {
      expression.push(entry.min, entry.color);
    });

    return expression;
  }

  bindHoverInteractions(map) {
    const role = this.getRoleForMap(map);
    if (!role) {
      return;
    }

    this.teardownHoverInteractions(map, role);

    const moveHandler = (event) => {
      const feature = event?.features?.[0];
      if (!feature) {
        return;
      }

      map.getCanvas().style.cursor = "pointer";
      this.showHoverPopup(map, role, event.lngLat, feature);
    };

    const leaveHandler = () => {
      map.getCanvas().style.cursor = "";
      this.hideHoverPopup(role);
    };

    const clickHandler = (event) => {
      const feature = event?.features?.[0];
      if (!feature) {
        return;
      }

      this.showHoverPopup(map, role, event.lngLat, feature);
    };

    map.on("mousemove", FILL_LAYER_ID, moveHandler);
    map.on("mouseleave", FILL_LAYER_ID, leaveHandler);
    map.on("click", FILL_LAYER_ID, clickHandler);

    this.hoverMoveHandlers[role] = moveHandler;
    this.hoverLeaveHandlers[role] = leaveHandler;
    this.hoverClickHandlers[role] = clickHandler;
  }

  teardownHoverInteractions(map, role) {
    const moveHandler = this.hoverMoveHandlers[role];
    if (moveHandler) {
      map.off("mousemove", FILL_LAYER_ID, moveHandler);
      this.hoverMoveHandlers[role] = null;
    }

    const leaveHandler = this.hoverLeaveHandlers[role];
    if (leaveHandler) {
      map.off("mouseleave", FILL_LAYER_ID, leaveHandler);
      this.hoverLeaveHandlers[role] = null;
    }

    const clickHandler = this.hoverClickHandlers[role];
    if (clickHandler) {
      map.off("click", FILL_LAYER_ID, clickHandler);
      this.hoverClickHandlers[role] = null;
    }

    this.hideHoverPopup(role);
  }

  getRoleForMap(map) {
    if (map === this.modalMap) {
      return ROLE_MODAL;
    }

    if (map === this.previewMap) {
      return ROLE_PREVIEW;
    }

    return null;
  }

  showHoverPopup(map, role, lngLat, feature) {
    const countyName = String(feature?.properties?.countyName || "").trim();
    const metricValue = Number(feature?.properties?.metricValue || 0);
    const safeCountyName = this.escapeHtml(countyName || "County");
    const safeValue = Number.isNaN(metricValue) ? "0" : String(metricValue);

    if (!this.hoverPopups[role]) {
      this.hoverPopups[role] = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 14
      });
    }

    this.hoverPopups[role]
      .setLngLat(lngLat)
      .setHTML(
        `<strong>${safeCountyName}</strong><br/>District Total: ${safeValue}`
      )
      .addTo(map);
  }

  hideHoverPopup(role) {
    const popup = this.hoverPopups[role];
    if (popup) {
      popup.remove();
      this.hoverPopups[role] = null;
    }
  }

  escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  fitToFeatures(map, features, role) {
    const coordinates = [];

    features.forEach((feature) => {
      this.collectCoordinates(feature.geometry, coordinates);
    });

    if (coordinates.length) {
      const normalizedCoordinates =
        this.normalizeCoordinatesForViewport(coordinates);
      const bounds = this.buildBoundsFromCoordinates(normalizedCoordinates);
      map.fitBounds(bounds, this.getBoundsOptions(role));
    }
  }

  getBoundsOptions(role) {
    if (role === ROLE_PREVIEW && this.isCompact) {
      return {
        padding: {
          top: 20,
          right: 20,
          bottom: 20,
          left: 20
        },
        maxZoom: 5.9,
        duration: 0
      };
    }

    return {
      padding: {
        top: 108,
        right: 230,
        bottom: 130,
        left: 80
      },
      maxZoom: 6.1,
      duration: 0
    };
  }

  collectCoordinates(geometry, coordinates) {
    if (!geometry) {
      return;
    }

    if (geometry.type === "Polygon") {
      geometry.coordinates.flat().forEach((coord) => coordinates.push(coord));
      return;
    }

    if (geometry.type === "MultiPolygon") {
      geometry.coordinates.flat(2).forEach((coord) => coordinates.push(coord));
    }
  }

  normalizeCoordinatesForViewport(coordinates) {
    if (!coordinates.length) {
      return [];
    }

    const rawLongitudes = coordinates.map((coord) => coord[0]);
    const rawSpan = Math.max(...rawLongitudes) - Math.min(...rawLongitudes);

    if (rawSpan <= 180) {
      return coordinates;
    }

    const referenceLongitude = coordinates[0][0];
    return coordinates.map(([longitude, latitude]) => {
      let adjustedLongitude = longitude;

      while (adjustedLongitude - referenceLongitude > 180) {
        adjustedLongitude -= 360;
      }

      while (adjustedLongitude - referenceLongitude < -180) {
        adjustedLongitude += 360;
      }

      return [adjustedLongitude, latitude];
    });
  }

  buildBoundsFromCoordinates(coordinates) {
    const bounds = new mapboxgl.LngLatBounds();
    coordinates.forEach((coord) => bounds.extend(coord));
    return bounds;
  }

  removeLayerIfExists(map, layerId) {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
  }

  removeSourceIfExists(map, sourceId) {
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
  }

  getValidStateName(value) {
    const normalized = String(value || "")
      .trim()
      .toUpperCase();
    const exact = Object.keys(STATE_NAME_TO_FIPS).find(
      (stateName) => stateName === normalized
    );
    return exact ? this.toTitleCase(exact) : "Georgia";
  }

  toTitleCase(value) {
    return String(value || "")
      .toLowerCase()
      .replaceAll(/\b\w/g, (character) => character.toUpperCase());
  }

  getSelectedStateFromUrl() {
    try {
      const url = new URL(globalThis.location.href);

      const pathState = this.getSelectedStateFromPath(url.pathname);
      if (pathState) {
        return pathState;
      }

      const refinementsRaw = url.searchParams.get(REFINEMENTS_PARAM);
      if (!refinementsRaw) {
        return "";
      }

      const parsed = JSON.parse(this.decodeDeep(refinementsRaw));
      if (!Array.isArray(parsed)) {
        return "";
      }

      const stateRefinement = parsed.find(
        (item) => item?.nameOrId === STATE_REFINEMENT_KEY
      );
      if (
        stateRefinement &&
        Array.isArray(stateRefinement.values) &&
        stateRefinement.values.length
      ) {
        return stateRefinement.values[0];
      }

      return "";
    } catch {
      return "";
    }
  }

  getSelectedStateFromPath(pathname) {
    const path = String(pathname || "").toLowerCase();
    const marker = "/global-search/";
    const markerIndex = path.indexOf(marker);
    if (markerIndex < 0) {
      return "";
    }

    const rawState = String(pathname || "")
      .slice(markerIndex + marker.length)
      .split("/")[0]
      .trim();

    if (!rawState) {
      return "";
    }

    return decodeURIComponent(rawState).replaceAll("+", " ");
  }

  decodeDeep(value) {
    let result = String(value || "");
    for (let i = 0; i < 3; i += 1) {
      try {
        const decoded = decodeURIComponent(result);
        if (decoded === result) {
          break;
        }
        result = decoded;
      } catch {
        break;
      }
    }
    return result;
  }

  handleError(error, fallbackMessage) {
    const message = error?.message || fallbackMessage;
    this.errorMessage = message;
    console.error("mapPlusTestimonial error:", message, error);
  }

  openModal() {
    if (!this.isExpandable) {
      return;
    }

    this.isModalOpen = true;
    this.dispatchEvent(new CustomEvent("mapmodalopen"));
  }

  closeModal() {
    this.isModalOpen = false;
    this.dispatchEvent(new CustomEvent("mapmodalclose"));
  }

  handleOpenMap() {
    this.openModal();
  }

  handleCloseMap() {
    this.closeModal();
  }

  fetchCarouselData() {
    this.isLoading = true;
    getCarouselData({ stateCode: this.currentState })
      .then((data) => {
        let tempSlides = [];
        if (data && data.length > 0) {
          tempSlides = data.map((item) => ({
            ...item,
            isVideo: item.Media_Type__c === "Video",
            isText: item.Media_Type__c === "Text",
            isMapCard: false
          }));
          tempSlides.splice(1, 0, {
            Id: "Map-Slide-Unique-ID",
            isMapCard: true
          });
        } else {
          tempSlides = [
            {
              Id: "Map-Slide-Unique-ID",
              isMapCard: true
            }
          ];
        }
        this.formattedSlides = tempSlides;
      })
      .catch((error) => {
        console.error("Error fetching carousel data:", error);
        this.formattedSlides = [{ Id: "Map-Error-Slide", isMapCard: true }];
      })
      .finally(() => {
        this.isLoading = false;
        globalThis.setTimeout(() => {
          this.setupOrUpdateSwiper();
        }, 300);
      });
  }

  setupOrUpdateSwiper() {
    if (!globalThis.Swiper) {
      Promise.all([
        loadScript(this, `${SWIPER}/SwiperJS/swiper-bundle.min.js`),
        loadStyle(this, `${SWIPER}/SwiperJS/swiper-bundle.min.css`)
      ])
        .then(() => {
          this.initSwiper();
        })
        .catch((error) => {
          console.error("Error loading Swiper files:", error);
        });
      return;
    }

    globalThis.setTimeout(() => {
      this.initSwiper();
    }, 0);
  }

  initSwiper() {
    const swiperContainer = this.template.querySelector(".swiper");
    if (!swiperContainer || !globalThis.Swiper) {
      return;
    }

    if (this.swiperInstance) {
      this.swiperInstance.destroy(true, true);
    }

    this.swiperInitialized = true;
    this.swiperInstance = new globalThis.Swiper(swiperContainer, {
      slidesPerView: 1,
      spaceBetween: 15,
      loop: false,
      navigation: {
        nextEl: this.template.querySelector(".swiper-button-next"),
        prevEl: this.template.querySelector(".swiper-button-prev")
      },
      breakpoints: {
        768: { slidesPerView: 2 },
        1024: { slidesPerView: 3 }
      },
      on: {
        init: () => {
          globalThis.setTimeout(async () => {
            await this.syncMapInstances();
            this.refreshRenderedMaps();
          }, 500);
        },
        resize: () => {
          this.refreshRenderedMaps();
        }
      }
    });
  }

  updateStateFromUrlOrStorage() {
    let hashState = this.getStateFromHash();
    if (!hashState) {
      hashState = globalThis.localStorage.getItem(STORAGE_KEY);
    }

    if (hashState) {
      this.currentState = hashState;
      this._selectedState = this.getValidStateName(hashState);
    }
  }

  getStateFromHash() {
    try {
      const hashValue = String(globalThis.location.hash || "")
        .replace(/^#/, "")
        .trim();
      if (!hashValue) {
        return "";
      }
      return decodeURIComponent(hashValue);
    } catch {
      return "";
    }
  }

  startHashWatcher() {
    this._lastHash = globalThis.location.hash;

    this._watchId = globalThis.setInterval(() => {
      const currentHash = globalThis.location.hash;
      if (currentHash === this._lastHash) {
        return;
      }

      this._lastHash = currentHash;
      const newState = this.getStateFromHash();
      if (newState && newState !== this.currentState) {
        this.currentState = newState;
        this.selectedState = this.getValidStateName(newState);
        this.fetchCarouselData();
      }
    }, 250);
  }

  stopHashWatcher() {
    if (this._watchId) {
      globalThis.clearInterval(this._watchId);
      this._watchId = null;
    }
  }
}
