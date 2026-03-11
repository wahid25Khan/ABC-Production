({
    doInit: function (component, event, helper) {
        helper.init(component);
    },

    onDestroy: function (component, event, helper) {
        helper.cleanup(component);
    },

    toggleOpen: function (component, event, helper) {
        event.stopPropagation();
        component.set("v.isOpen", !component.get("v.isOpen"));
    },

    handleSelect: function (component, event, helper) {
        event.stopPropagation();
        var val = (event.currentTarget && event.currentTarget.getAttribute("data-value")) || "";
        component.set("v.selectedValue", val);
        component.set("v.isOpen", false);

        // remember selection
        try {
            window.localStorage.setItem(component.get("v.storageKey"), val);
        } catch (e) {}

        helper.buildOptionList(component);

        // Apply logic
        helper.applySelection(component, val);
    }
});