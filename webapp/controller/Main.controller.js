sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], (Controller, JSONModel, Filter, FilterOperator) => {
    "use strict";

    return Controller.extend("project1.controller.Main", {
        onInit() {
            this._sSelectedProductId = null;
            this._sLastSearchQuery = "";

            const oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            const oViewModel = new JSONModel({
                title: oResourceBundle.getText("masterPageTitle")
            });
            this.getView().setModel(oViewModel, "mainView");

            this._oRouter = this.getOwnerComponent().getRouter();
            this._oRouter.getRoute("RouteDetail").attachPatternMatched(this._onRouteDetailMatched, this);
            this._oRouter.getRoute("RouteMain").attachPatternMatched(this._onClearSelection, this);
            this._oRouter.getRoute("RouteCreate").attachPatternMatched(this._onClearSelection, this);
        },

        onListUpdateFinished(oEvent) {
            const iTotalItems = oEvent.getParameter("total");
            const oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            const sTitle = iTotalItems > 0 && oEvent.getSource().getBinding("items").isLengthFinal()
                ? oResourceBundle.getText("masterPageTitleCount", [iTotalItems])
                : oResourceBundle.getText("masterPageTitle");

            this.getView().getModel("mainView").setProperty("/title", sTitle);

            if (this._sSelectedProductId) {
                this._selectListItemById(this._sSelectedProductId);
            }
        },

        onSearch(oEvent) {
            const vQuery = oEvent.getParameter("query");
            const sQuery = (vQuery !== undefined ? vQuery : (oEvent.getParameter("newValue") || "")).trim();

            if (sQuery === this._sLastSearchQuery) {
                return;
            }
            this._sLastSearchQuery = sQuery;

            const aFilters = sQuery
                ? [
                    new Filter({
                        filters: [
                            new Filter("Name", FilterOperator.Contains, sQuery),
                            new Filter("Description", FilterOperator.Contains, sQuery)
                        ],
                        and: false
                    })
                ]
                : [];

            const oListBinding = this.byId("productList").getBinding("items");
            if (oListBinding) {
                oListBinding.filter(aFilters);
            }
        },

        onCreatePress() {
            this._oRouter.navTo("RouteCreate");
        },

        onSelectionChange(oEvent) {
            const oSelectedItem = oEvent.getParameter("listItem");
            const oContext = oSelectedItem && oSelectedItem.getBindingContext();

            if (!oContext) {
                return;
            }

            this._oRouter.navTo("RouteDetail", {
                productId: String(oContext.getProperty("ID"))
            });
        },

        _onRouteDetailMatched(oEvent) {
            this._sSelectedProductId = oEvent.getParameter("arguments").productId;
            this._selectListItemById(this._sSelectedProductId);
        },

        _onClearSelection() {
            this._sSelectedProductId = null;
            const oList = this.byId("productList");
            if (oList) {
                oList.removeSelections(true);
            }
        },

        _selectListItemById(sProductId) {
            const oList = this.byId("productList");
            if (!oList || !sProductId) {
                return;
            }

            const oMatchingItem = oList.getItems().find((oItem) => {
                const oContext = oItem.getBindingContext();
                return oContext && String(oContext.getProperty("ID")) === String(sProductId);
            });

            if (oMatchingItem) {
                oList.setSelectedItem(oMatchingItem, true);
            } else {
                oList.removeSelections(true);
            }
        },

        onExit() {
            if (this._oRouter) {
                this._oRouter.getRoute("RouteDetail").detachPatternMatched(this._onRouteDetailMatched, this);
                this._oRouter.getRoute("RouteMain").detachPatternMatched(this._onClearSelection, this);
                this._oRouter.getRoute("RouteCreate").detachPatternMatched(this._onClearSelection, this);
            }
        }
    });
});