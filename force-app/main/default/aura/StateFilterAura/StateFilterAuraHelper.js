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
        var self = this;

        var current = new URL(window.location.href);

        var urlSelected = self.getSelectedFromUrl(component, current);
        var stored = "";
        try { stored = window.localStorage.getItem(component.get("v.storageKey")) || ""; } catch (e) {}

        var selected = urlSelected || stored || component.get("v.defaultState") || "";
        component.set("v.selectedValue", selected);

        self.buildOptionList(component);

        // ✅ CLEAN URL if query params exist (refinements/refinement/facets etc) but keep same path /global-search/State
        self.cleanUrlIfNeeded(component, selected, current);

        // ✅ Auto-apply default ONLY on results "all" page
        if (self.isResultsAllPage(component, current) && !urlSelected && selected) {
            self.applyToUrl(component, selected, "results");
            // page will navigate; next load will clean URL
        }

        // Outside click close
        var handlerKey = "abc_statefilter_" + component.getGlobalId();
        component.set("v.handlerKey", handlerKey);

        window[handlerKey] = function (evt) {
            try {
                var root = component.getElement();
                if (root && !root.contains(evt.target)) {
                    component.set("v.isOpen", false);
                }
            } catch (e) {}
        };
        document.addEventListener("click", window[handlerKey]);
    },

    cleanup: function (component) {
        var handlerKey = component.get("v.handlerKey");
        if (handlerKey && window[handlerKey]) {
            document.removeEventListener("click", window[handlerKey]);
            try { delete window[handlerKey]; } catch (e) { window[handlerKey] = null; }
        }
    },

    buildOptionList: function (component) {
        var selected = component.get("v.selectedValue");
        var list = this.states.map(function (s) {
            return {
                label: s,
                value: s,
                className: (s === selected) ? "option selected" : "option"
            };
        });
        component.set("v.optionList", list);
    },

    applySelection: function (component, val) {
        var current = new URL(window.location.href);

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
        var base = component.get("v.communityBase");
        var p = urlObj.pathname;
        return p === base || p === (base + "/");
    },

    // LWC me "/global-search/all" check tha. Yahan same:
    isResultsAllPage: function (component, urlObj) {
        var base = component.get("v.resultsBasePath");
        return urlObj.pathname.indexOf(base + "/all") !== -1;
    },

    // ---------- helpers ----------
    decodeDeep: function (str) {
        if (!str) return "";
        var out = str;
        for (var i = 0; i < 3; i++) {
            try {
                var dec = decodeURIComponent(out);
                if (dec === out) break;
                out = dec;
            } catch (e) {
                break;
            }
        }
        return out;
    },

    getSelectedFromUrl: function (component, urlObj) {
        try {
            var refinementsParam = component.get("v.refinementsParam");
            var refinementParam = component.get("v.refinementParam");
            var refinementKey = component.get("v.refinementKey");

            var refinementsRaw = urlObj.searchParams.get(refinementsParam);
            if (refinementsRaw) {
                var jsonStr = this.decodeDeep(refinementsRaw);
                var list = JSON.parse(jsonStr);

                var stateEntry = Array.isArray(list)
                    ? list.find(function (r) { return r && r.nameOrId === refinementKey; })
                    : null;

                if (stateEntry && Array.isArray(stateEntry.values) && stateEntry.values.length) {
                    return stateEntry.values[0];
                }
            }

            var singleRef = urlObj.searchParams.get(refinementParam);
            if (singleRef) {
                var decoded = this.decodeDeep(singleRef);
                var prefix = refinementKey + ":";
                if (decoded.indexOf(prefix) === 0) return decoded.substring(prefix.length);
            }
        } catch (e) {}
        return "";
    },

    // ✅ This is the MAIN change for clean URL
    cleanUrlIfNeeded: function (component, stateVal, urlObj) {
        try {
            if (!stateVal) return;

            var refinementParam = component.get("v.refinementParam");
            var refinementsParam = component.get("v.refinementsParam");
            var facetsParam = component.get("v.facetsParam");
            var refinementKey = component.get("v.refinementKey");

            var hasJunk =
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

            var base = component.get("v.resultsBasePath"); // /AmericanBookCompany/global-search

            // If already on /global-search/<something> keep it, just drop query
            // Otherwise set to /global-search/<state>
            var desiredPath = base + "/" + encodeURIComponent(stateVal);

            // replaceState => no reload, just URL clean
            window.history.replaceState({}, "", desiredPath);
        } catch (e) {}
    },

    // kind: 'home' | 'results'
    applyToUrl: function (component, stateVal, kind) {
        var current = new URL(window.location.href);
        var params = new URLSearchParams(current.search);

        var refinementKey = component.get("v.refinementKey");
        var refinementParam = component.get("v.refinementParam");
        var refinementsParam = component.get("v.refinementsParam");
        var facetsParam = component.get("v.facetsParam");
        var urlMode = component.get("v.urlMode");

        // reset paging
        params.set("page", "1");

        // refinement=State__c:Alabama
        params.set(refinementParam, refinementKey + ":" + stateVal);

        // remove heavy facets
        params.delete(facetsParam);
        params.delete("search-facet-section-" + refinementKey);

        // compat => refinements param (double encoding required by commerce)
        if (urlMode === "compat") {
            var refinementsList = [{
                nameOrId: refinementKey,
                type: "DistinctValue",
                attributeType: "Custom",
                values: [stateVal]
            }];
            params.set(refinementsParam, encodeURIComponent(JSON.stringify(refinementsList)));
        } else {
            params.delete(refinementsParam);
        }

        var targetPath;
        if (kind === "home") {
            targetPath = current.pathname;
        } else {
            // ✅ IMPORTANT: results path now becomes /global-search/<State>
            // so user gets clean URL after we clean query on load
            targetPath = component.get("v.resultsBasePath") + "/" + encodeURIComponent(stateVal);
        }

        var newUrl = targetPath + (params.toString() ? ("?" + params.toString()) : "");
        window.location.assign(newUrl);
    }
});