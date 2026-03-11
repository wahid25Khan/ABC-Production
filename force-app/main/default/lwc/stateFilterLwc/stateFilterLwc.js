import { LightningElement, api, track } from 'lwc';

const STORAGE_KEY = 'abc_selected_state';

export default class StateFilterLwc extends LightningElement {
  @api refinementKey = 'State__c';
  @api refinementParam = 'refinement';
  @api refinementsParam = 'refinements';
  @api facetsParam = 'facets';

  @api defaultState = 'Georgia';

  resultsBasePath = '/AmericanBookCompany/global-search';
  resultsAllPath = '/AmericanBookCompany/global-search/all';

  urlMode = 'compat'; // 'short' | 'compat'

  cleanDelayFastMs = 180;
  cleanDelaySlowMs = 500;

  watchIntervalMs = 250;
  watchDebounceMs = 120;

  @track selectedValue = '';
  @track isOpen = false;

  states = [
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
    'Delaware','District of Columbia','Florida','Georgia','Hawaii','Idaho','Illinois',
    'Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts',
    'Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
    'New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota',
    'Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
    'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'
  ];

  _docClickHandler;
  _watchId;
  _watchDebounce;
  _lastHref;

  _cleanT1;
  _cleanT2;

  connectedCallback() {
    const url = new URL(window.location.href);

    if (this.isResultsPage(url)) {
      this.ensureResultsAllIfMissing(url);

      const st = this.getStateFromResults(url);
      this.selectedValue = st;

      if (st) {
        this.safeSetStorage(STORAGE_KEY, st);
        this.ensureResultsKeyword(st);
      }

      const u2 = new URL(window.location.href);
      if (u2.search && u2.search.length > 1) this.cleanUrlAfterDelay();
    } else {
      const st = this.resolveStandardPageState(url);
      this.selectedValue = st;
      this.safeSetStorage(STORAGE_KEY, st);

      if (this.isHomePage(url)) {
        this.ensureHomeHash(st);
      }

      // product/other pages par stale hash/query hata do
      const u2 = new URL(window.location.href);
      if ((!this.isHomePage(u2) && u2.hash) || (u2.search && u2.search.length > 1)) {
        this.cleanUrlAfterDelay();
      }
    }

    this._docClickHandler = (evt) => {
      if (!this.template.contains(evt.target)) this.isOpen = false;
    };
    document.addEventListener('click', this._docClickHandler);

    this.startUrlWatcher();
  }

  disconnectedCallback() {
    document.removeEventListener('click', this._docClickHandler);
    this.stopUrlWatcher();
    window.clearTimeout(this._cleanT1);
    window.clearTimeout(this._cleanT2);
  }

  get displayValue() {
    return this.selectedValue || 'Select State';
  }

  get valueClass() {
    return this.selectedValue ? 'value' : 'value placeholder';
  }

  get optionList() {
    return this.states.map((s) => ({
      label: s,
      value: s,
      className: s === this.selectedValue ? 'option selected' : 'option'
    }));
  }

  toggleOpen(event) {
    event.stopPropagation();
    this.isOpen = !this.isOpen;
  }

  handleSelect(event) {
    event.stopPropagation();
    const val = event.currentTarget.dataset.value || '';
    this.selectedValue = val;
    this.isOpen = false;
    this.safeSetStorage(STORAGE_KEY, val);
    this.applyToUrl(val);
  }

  startUrlWatcher() {
    this._lastHref = window.location.href;
    this._watchId = window.setInterval(() => {
      const href = window.location.href;
      if (href !== this._lastHref) {
        this._lastHref = href;
        window.clearTimeout(this._watchDebounce);
        this._watchDebounce = window.setTimeout(() => {
          this.onUrlChanged();
        }, this.watchDebounceMs);
      }
    }, this.watchIntervalMs);
  }

  stopUrlWatcher() {
    window.clearInterval(this._watchId);
    window.clearTimeout(this._watchDebounce);
    this._watchId = null;
    this._watchDebounce = null;
  }

  onUrlChanged() {
    try {
      const url = new URL(window.location.href);

      if (this.isResultsPage(url)) {
        this.ensureResultsAllIfMissing(url);

        const st = this.getStateFromResults(url);
        this.selectedValue = st;

        if (st) {
          this.safeSetStorage(STORAGE_KEY, st);
          this.ensureResultsKeyword(st);
        }

        if (url.search && url.search.length > 1) this.cleanUrlAfterDelay();
      } else {
        const st = this.resolveStandardPageState(url);
        this.selectedValue = st;
        this.safeSetStorage(STORAGE_KEY, st);

        if (this.isHomePage(url)) {
          this.ensureHomeHash(st);
        }

        if ((!this.isHomePage(url) && url.hash) || (url.search && url.search.length > 1)) {
          this.cleanUrlAfterDelay();
        }
      }
    } catch (e) {
      // ignore
    }
  }

  isResultsPage(urlObj) {
    return urlObj.pathname.includes('/global-search');
  }

  isHomePage(urlObj) {
    const parts = (urlObj.pathname || '').split('/').filter(Boolean);
    return parts.length <= 1;
  }

  getStoredState() {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY) || '';
      return this.states.includes(v) ? v : '';
    } catch (e) {
      return '';
    }
  }

  resolveStandardPageState(urlObj) {
    const hashState = this.getStateFromHash(urlObj);

    // Home par default Georgia hi rahe
    if (this.isHomePage(urlObj)) {
      return hashState || this.defaultState;
    }

    // Product / other pages par last selected state ko prefer karo
    const storedState = this.getStoredState();
    return storedState || hashState || this.defaultState;
  }

  safeSetStorage(key, val) {
    try {
      window.localStorage.setItem(key, val);
    } catch (e) {
      // ignore
    }
  }

  decodeDeep(str) {
    if (!str) return '';
    let out = str;
    for (let i = 0; i < 3; i++) {
      try {
        const dec = decodeURIComponent(out);
        if (dec === out) break;
        out = dec;
      } catch (e) {
        break;
      }
    }
    return out;
  }

  getStateFromHash(urlObj) {
    const h = (urlObj.hash || '').replace(/^#/, '').trim();
    if (!h) return '';
    const v = decodeURIComponent(h);
    return this.states.includes(v) ? v : '';
  }

  ensureHomeHash(stateVal) {
    try {
      const url = new URL(window.location.href);
      const desiredHash = `#${encodeURIComponent(stateVal)}`;
      if (url.hash !== desiredHash) {
        window.history.replaceState({}, '', url.pathname + url.search + desiredHash);
        this._lastHref = window.location.href;
      }
    } catch (e) {
      // ignore
    }
  }

  getResultsKeyword(urlObj) {
    const p = urlObj.pathname || '';
    if (!p.startsWith(this.resultsBasePath)) return '';
    let rest = p.slice(this.resultsBasePath.length);
    rest = rest.replace(/^\/+/, '');
    const seg = rest.split('/')[0] || '';
    return decodeURIComponent(seg);
  }

  getStateFromParams(urlObj) {
    try {
      const refinementsRaw = urlObj.searchParams.get(this.refinementsParam);
      if (refinementsRaw) {
        const jsonStr = this.decodeDeep(refinementsRaw);
        const list = JSON.parse(jsonStr);
        const stateEntry = Array.isArray(list)
          ? list.find((r) => r && r.nameOrId === this.refinementKey)
          : null;
        if (stateEntry && Array.isArray(stateEntry.values) && stateEntry.values.length) {
          return stateEntry.values[0];
        }
      }

      const singleRef = urlObj.searchParams.get(this.refinementParam);
      if (singleRef) {
        const decoded = this.decodeDeep(singleRef);
        const prefix = `${this.refinementKey}:`;
        if (decoded.startsWith(prefix)) return decoded.substring(prefix.length);
      }
    } catch (e) {
      // ignore
    }
    return '';
  }

  getStateFromResults(urlObj) {
    const fromParams = this.getStateFromParams(urlObj);
    if (fromParams && this.states.includes(fromParams)) return fromParams;

    const kw = this.getResultsKeyword(urlObj);
    if (kw && this.states.includes(kw)) return kw;

    return '';
  }

  ensureResultsAllIfMissing(urlObj) {
    try {
      const kw = this.getResultsKeyword(urlObj);
      const hasKw = !!kw;
      if (!hasKw) {
        window.history.replaceState({}, '', this.resultsAllPath + urlObj.search);
        this._lastHref = window.location.href;
        return;
      }

      if (urlObj.hash) {
        window.history.replaceState({}, '', urlObj.pathname + urlObj.search);
        this._lastHref = window.location.href;
      }
    } catch (e) {
      // ignore
    }
  }

  ensureResultsKeyword(stateVal) {
    try {
      const url = new URL(window.location.href);
      if (!this.isResultsPage(url)) return;

      const kw = this.getResultsKeyword(url);
      if (kw === stateVal) return;

      const targetPath = `${this.resultsBasePath}/${encodeURIComponent(stateVal)}`;
      const newUrl = targetPath + url.search;
      window.location.assign(newUrl);
    } catch (e) {
      // ignore
    }
  }

  cleanUrlAfterDelay() {
    window.clearTimeout(this._cleanT1);
    window.clearTimeout(this._cleanT2);

    const tryClean = () => {
      try {
        const url = new URL(window.location.href);

        if (this.isResultsPage(url)) {
          const kw = this.getResultsKeyword(url) || 'all';
          const desiredPath = `${this.resultsBasePath}/${encodeURIComponent(kw)}`;
          window.history.replaceState({}, '', desiredPath);
          this._lastHref = window.location.href;
        } else if (this.isHomePage(url)) {
          const st = this.getStateFromHash(url) || this.selectedValue || this.defaultState;
          const desiredHash = `#${encodeURIComponent(st)}`;
          window.history.replaceState({}, '', url.pathname + desiredHash);
          this._lastHref = window.location.href;
        } else {
          // product / other pages => no hash, no query
          window.history.replaceState({}, '', url.pathname);
          this._lastHref = window.location.href;
        }
      } catch (e) {
        // ignore
      }
    };

    this._cleanT1 = window.setTimeout(tryClean, this.cleanDelayFastMs);
    this._cleanT2 = window.setTimeout(tryClean, this.cleanDelaySlowMs);
  }

  applyToUrl(stateVal) {
    const current = new URL(window.location.href);
    const params = new URLSearchParams(current.search);

    params.set('page', '1');
    params.set(this.refinementParam, `${this.refinementKey}:${stateVal}`);

    params.delete(this.facetsParam);
    params.delete(`search-facet-section-${this.refinementKey}`);

    if (this.urlMode === 'compat') {
      const refinementsList = [
        {
          nameOrId: this.refinementKey,
          type: 'DistinctValue',
          attributeType: 'Custom',
          values: [stateVal]
        }
      ];
      params.set(this.refinementsParam, encodeURIComponent(JSON.stringify(refinementsList)));
    } else {
      params.delete(this.refinementsParam);
    }

    if (this.isResultsPage(current)) {
      const targetPath = `${this.resultsBasePath}/${encodeURIComponent(stateVal)}`;
      const newUrl = targetPath + (params.toString() ? `?${params.toString()}` : '');
      window.location.assign(newUrl);
    } else {
      const targetPath = current.pathname;
      const hash = this.isHomePage(current) ? `#${encodeURIComponent(stateVal)}` : '';
      const newUrl = targetPath + (params.toString() ? `?${params.toString()}` : '') + hash;
      window.location.assign(newUrl);
    }
  }
}