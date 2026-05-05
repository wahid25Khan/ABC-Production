({
    states: [
        'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
        'Delaware','District of Columbia','Florida','Georgia','Hawaii','Idaho','Illinois',
        'Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts',
        'Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
        'New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota',
        'Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
        'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'
    ],

    init: function (component) {
        const current = new URL(globalThis.location.href);

        const urlSelected = this.getSelectedFromUrl(component, current);
        let stored = "";
        try {
            stored = globalThis.localStorage.getItem(component.get("v.storageKey")) || "";
        } catch (err) {
            console.debug("localStorage unavailable", err);
        }

        const selected = urlSelected || stored || component.get("v.defaultState") || "";
        component.set("v.selectedValue", selected);

        this.buildOptionList(component);

        // Clean URL if query params exist (refinements/refinement/facets etc) but keep same path /global-search/State
        this.cleanUrlIfNeeded(component, selected, current);

        // Auto-apply default ONLY on results "all" page
        if (this.isResultsAllPage(component, current) && !urlSelected && selected) {
            this.applyToUrl(component, selected, "results");
            // page will navigate; next load will clean URL
        }

        // Outside click close
        const handlerKey = "abc_statefilter_" + component.getGlobalId();
        component.set("v.handlerKey", handlerKey);

        globalThis[handlerKey] = function (evt) {
            try {
                const root = component.getElement();
                if (root && !root.contains(evt.target)) {
                    component.set("v.isOpen", false);
                }
            } catch (err) {
                console.debug("outside click handler error", err);
            }
        };
        document.addEventListener("click", globalThis[handlerKey]);
    },

    cleanup: function (component) {
        const handlerKey = component.get("v.handlerKey");
        if (handlerKey && globalThis[handlerKey]) {
            document.removeEventListener("click", globalThis[handlerKey]);
            try {
                delete globalThis[handlerKey];
            } catch (deleteErr) {
                console.debug("handler cleanup fallback", deleteErr);
                globalThis[handlerKey] = null;
            }
        }
    },

    buildOptionList: function (component) {
        const selected = component.get("v.selectedValue");
        const list = this.states.map(function (s) {
            return {
                label: s,
                value: s,
                className: (s === selected) ? "option selected" : "option"
            };
        });
        component.set("v.optionList", list);
    },

    applySelection: function (component, val) {
        const current = new URL(globalThis.location.href);

        // Home => optional URL update, but typically results won't run here
        if (this.isHomePage(component, current)) {
            this.applyToUrl(component, val, "home");
            return;
        }

        // Results (all) page => apply filter here
        if (this.isResultsAllPage(component, current)) {
            this.applyToUrl(component, val, "results");
            return;
        }

        // Other pages => go to results page
        this.applyToUrl(component, val, "results");
    },

    // ---------- page detection ----------
    isHomePage: function (component, urlObj) {
        const base = component.get("v.communityBase");
        const p = urlObj.pathname;
        return p === base || p === (base + "/");
    },

    isResultsAllPage: function (component, urlObj) {
        const base = component.get("v.resultsBasePath");
        return urlObj.pathname.includes(base + "/all");
    },

    // ---------- helpers ----------
    decodeDeep: function (str) {
        if (!str) return "";
        let out = str;
        for (let i = 0; i < 3; i++) {
            try {
                const dec = decodeURIComponent(out);
                if (dec === out) break;
                out = dec;
            } catch (decodeErr) {
                console.debug("decodeDeep reached limit", decodeErr);
                break;
            }
        }
        return out;
    },

    getSelectedFromUrl: function (component, urlObj) {
        try {
            const refinementsParam = component.get("v.refinementsParam");
            const refinementParam = component.get("v.refinementParam");
            const refinementKey = component.get("v.refinementKey");

            const refinementsRaw = urlObj.searchParams.get(refinementsParam);
            if (refinementsRaw) {
                const jsonStr = this.decodeDeep(refinementsRaw);
                const list = JSON.parse(jsonStr);

                const stateEntry = Array.isArray(list)
                    ? list.find(function (r) { return r && r.nameOrId === refinementKey; })
                    : null;

                if (stateEntry && Array.isArray(stateEntry.values) && stateEntry.values.length) {
                    return stateEntry.values[0];
                }
            }

            const singleRef = urlObj.searchParams.get(refinementParam);
            if (singleRef) {
                const decoded = this.decodeDeep(singleRef);
                const prefix = refinementKey + ":";
                if (decoded.indexOf(prefix) === 0) return decoded.substring(prefix.length);
            }
        } catch (err) {
            console.debug("getSelectedFromUrl parse error", err);
        }
        return "";
    },

    cleanUrlIfNeeded: function (component, stateVal, urlObj) {
        try {
            if (!stateVal) return;

            const refinementParam = component.get("v.refinementParam");
            const refinementsParam = component.get("v.refinementsParam");
            const facetsParam = component.get("v.facetsParam");
            const refinementKey = component.get("v.refinementKey");

            const hasJunk =
                urlObj.searchParams.has(refinementParam) ||
                urlObj.searchParams.has(refinementsParam) ||
                urlObj.searchParams.has(facetsParam) ||
                urlObj.searchParams.has("page") ||
                urlObj.searchParams.has("sort") ||
                urlObj.searchParams.has("q") ||
                urlObj.searchParams.has("search") ||
                urlObj.searchParams.has("keywords") ||
                urlObj.searchParams.has(("search-facet-section-" + refinementKey));

            if (!hasJunk) return;

            const base = component.get("v.resultsBasePath"); // /AmericanBookCompany/global-search

            // If already on /global-search/<something> keep it, just drop query
            // Otherwise set to /global-search/<state>
            const desiredPath = base + "/" + encodeURIComponent(stateVal);

            // replaceState => no reload, just URL clean
            globalThis.history.replaceState({}, "", desiredPath);
        } catch (err) {
            console.debug("cleanUrlIfNeeded error", err);
        }
    },

    // kind: 'home' | 'results'
    applyToUrl: function (component, stateVal, kind) {
        const current = new URL(globalThis.location.href);
        const params = new URLSearchParams(current.search);

        const refinementKey = component.get("v.refinementKey");
        const refinementParam = component.get("v.refinementParam");
        const refinementsParam = component.get("v.refinementsParam");
        const facetsParam = component.get("v.facetsParam");
        const urlMode = component.get("v.urlMode");

        // reset paging
        params.set("page", "1");

        // refinement=State__c:Alabama
        params.set(refinementParam, refinementKey + ":" + stateVal);

        // remove heavy facets
        params.delete(facetsParam);
        params.delete("search-facet-section-" + refinementKey);

        // compat => refinements param (double encoding required by commerce)
        if (urlMode === "compat") {
            const refinementsList = [{
                nameOrId: refinementKey,
                type: "DistinctValue",
                attributeType: "Custom",
                values: [stateVal]
            }];
            params.set(refinementsParam, encodeURIComponent(JSON.stringify(refinementsList)));
        } else {
            params.delete(refinementsParam);
        }

        let targetPath;
        if (kind === "home") {
            targetPath = current.pathname;
        } else {
            // results path now becomes /global-search/<State>
            // so user gets clean URL after we clean query on load
            targetPath = component.get("v.resultsBasePath") + "/" + encodeURIComponent(stateVal);
        }

        const newUrl = targetPath + (params.toString() ? ("?" + params.toString()) : "");
        globalThis.location.assign(newUrl);
    }
});