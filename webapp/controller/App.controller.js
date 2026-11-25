sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/f/library"
], (Controller, JSONModel, fioriLibrary) => {
    "use strict";

    const LayoutType = fioriLibrary.LayoutType;

    return Controller.extend("project1.controller.App", {
        onInit() {
            const oAppViewModel = new JSONModel({
                layout: LayoutType.OneColumn
            });
            this.getOwnerComponent().setModel(oAppViewModel, "appView");

            this._oRouter = this.getOwnerComponent().getRouter();
            this._oRouter.attachRouteMatched(this._onRouteMatched, this);
        },

        _onRouteMatched(oEvent) {
            const sRouteName = oEvent.getParameter("name");
            const oAppViewModel = this.getOwnerComponent().getModel("appView");
            const sLayout = sRouteName === "RouteMain"
                ? LayoutType.OneColumn
                : LayoutType.TwoColumnsMidExpanded;

            oAppViewModel.setProperty("/layout", sLayout);
        },

        onExit() {
            if (this._oRouter) {
                this._oRouter.detachRouteMatched(this._onRouteMatched, this);
            }
        }
    });
});