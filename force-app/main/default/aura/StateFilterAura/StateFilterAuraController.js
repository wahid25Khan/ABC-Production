({
    doInit: function (component, event, helper) {
        helper.init(component);
    },

    onDestroy: function (component, event, helper) {
        helper.cleanup(component);
    },

    toggleOpen: function (component, event) {
        event.stopPropagation();
        component.set("v.isOpen", !component.get("v.isOpen"));
    },

    handleSelect: function (component, event, helper) {
        event.stopPropagation();
        const val = event.currentTarget?.dataset.value || "";
        component.set("v.selectedValue", val);
        component.set("v.isOpen", false);

        // remember selection
        try {
            globalThis.localStorage.setItem(component.get("v.storageKey"), val);
        } catch (err) {
            // localStorage may be unavailable in some browsers/contexts
            console.debug("localStorage unavailable", err);
        }

        helper.buildOptionList(component);

        // Apply logic
        helper.applySelection(component, val);
    }
});