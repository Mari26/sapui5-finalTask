sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/library",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], (Controller, JSONModel, coreLibrary, MessageBox, MessageToast) => {
    "use strict";

    const ValueState = coreLibrary.ValueState;

    return Controller.extend("project1.controller.Detail", {
        onInit() {
            this._oOriginalData = null;

            const oViewModel = new JSONModel({
                busy: false,
                isEditMode: false,
                isCreateMode: false,
                notFound: false,
                draft: this._createEmptyDraft(),
                validation: this._createInitialValidation()
            });
            this.getView().setModel(oViewModel, "detailView");

            this._oRouter = this.getOwnerComponent().getRouter();
            this._oRouter.getRoute("RouteDetail").attachPatternMatched(this._onRouteDetailMatched, this);
            this._oRouter.getRoute("RouteCreate").attachPatternMatched(this._onRouteCreateMatched, this);
        },

        onEditPress() {
            const oViewModel = this.getView().getModel("detailView");
            oViewModel.setProperty("/validation", this._createInitialValidation());
            oViewModel.setProperty("/isCreateMode", false);
            oViewModel.setProperty("/isEditMode", true);
        },

        onCancelPress() {
            const oViewModel = this.getView().getModel("detailView");
            if (oViewModel.getProperty("/isCreateMode")) {
                this._oRouter.navTo("RouteMain");
                return;
            }

            oViewModel.setProperty("/draft", this._cloneProductData(this._oOriginalData));
            oViewModel.setProperty("/validation", this._createInitialValidation());
            oViewModel.setProperty("/isEditMode", false);
        },

        onClosePress() {
            this._oRouter.navTo("RouteMain");
        },

        onFieldChange(oEvent) {
            const sControlId = oEvent.getSource().getId();
            const oViewModel = this.getView().getModel("detailView");
            const mFieldMap = {
                nameInput: "Name",
                priceInput: "Price",
                ratingInput: "Rating",
                releaseDatePicker: "ReleaseDate",
                discontinuedDatePicker: "DiscontinuedDate"
            };

            const sMatchedKey = Object.keys(mFieldMap).find((sKey) => sControlId.endsWith(sKey));
            if (sMatchedKey) {
                const sFieldName = mFieldMap[sMatchedKey];
                oViewModel.setProperty(`/validation/${sFieldName}/state`, ValueState.None);
                oViewModel.setProperty(`/validation/${sFieldName}/text`, "");
            }
        },

        onSavePress() {
            if (!this._validateForm()) {
                return;
            }

            const oViewModel = this.getView().getModel("detailView");
            const bIsCreateMode = oViewModel.getProperty("/isCreateMode");
            const oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();

            if (!bIsCreateMode && !this._hasChanges()) {
                MessageToast.show(oResourceBundle.getText("noChangesMessage"));
                oViewModel.setProperty("/isEditMode", false);
                return;
            }

            const oDraft = oViewModel.getProperty("/draft");
            const oODataModel = this.getOwnerComponent().getModel();
            const oPayload = {
                Name: oDraft.Name.trim(),
                Description: (oDraft.Description || "").trim(),
                Price: Number(oDraft.Price).toFixed(2),
                Rating: parseInt(oDraft.Rating, 10),
                ReleaseDate: oDraft.ReleaseDate,
                DiscontinuedDate: oDraft.DiscontinuedDate || null
            };

            oViewModel.setProperty("/busy", true);

            if (bIsCreateMode) {
                this._generateNextProductId(oODataModel, (iNewId) => {
                    oPayload.ID = iNewId;

                    oODataModel.create("/Products", oPayload, {
                        success: (oCreatedData) => {
                            oViewModel.setProperty("/busy", false);
                            MessageToast.show(oResourceBundle.getText("productCreatedMessage"));
                            const sCreatedId = String(oCreatedData && oCreatedData.ID !== undefined ? oCreatedData.ID : iNewId);
                            this._oRouter.navTo("RouteDetail", { productId: sCreatedId }, true);
                        },
                        error: () => {
                            oViewModel.setProperty("/busy", false);
                            MessageBox.error(oResourceBundle.getText("saveErrorMessage"));
                        }
                    });
                });
            } else {
                const sPath = oODataModel.createKey("/Products", { ID: this._oOriginalData.ID });

                oODataModel.update(sPath, oPayload, {
                    success: () => {
                        oViewModel.setProperty("/busy", false);
                        const oUpdatedProduct = Object.assign({}, oPayload, { ID: this._oOriginalData.ID });
                        this._oOriginalData = this._cloneProductData(oUpdatedProduct);
                        oViewModel.setProperty("/draft", this._cloneProductData(oUpdatedProduct));
                        oViewModel.setProperty("/isEditMode", false);
                        MessageToast.show(oResourceBundle.getText("productUpdatedMessage"));
                    },
                    error: () => {
                        oViewModel.setProperty("/busy", false);
                        MessageBox.error(oResourceBundle.getText("saveErrorMessage"));
                    }
                });
            }
        },

        onDeletePress() {
            const oViewModel = this.getView().getModel("detailView");
            const oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            const sProductName = oViewModel.getProperty("/draft/Name");

            MessageBox.confirm(oResourceBundle.getText("deleteConfirmMessage", [sProductName]), {
                title: oResourceBundle.getText("deleteConfirmTitle"),
                actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.DELETE,
                onClose: (sAction) => {
                    if (sAction !== MessageBox.Action.DELETE) {
                        return;
                    }

                    const oODataModel = this.getOwnerComponent().getModel();
                    const sPath = oODataModel.createKey("/Products", { ID: this._oOriginalData.ID });

                    oViewModel.setProperty("/busy", true);
                    oODataModel.remove(sPath, {
                        success: () => {
                            oViewModel.setProperty("/busy", false);
                            MessageToast.show(oResourceBundle.getText("productDeletedMessage"));
                            this._oRouter.navTo("RouteMain", {}, true);
                        },
                        error: () => {
                            oViewModel.setProperty("/busy", false);
                            MessageBox.error(oResourceBundle.getText("deleteErrorMessage"));
                        }
                    });
                }
            });
        },

        _onRouteCreateMatched() {
            const oViewModel = this.getView().getModel("detailView");
            this._oOriginalData = null;

            oViewModel.setData({
                busy: false,
                isEditMode: true,
                isCreateMode: true,
                notFound: false,
                draft: this._createEmptyDraft(),
                validation: this._createInitialValidation()
            });
        },

        _onRouteDetailMatched(oEvent) {
            const sProductId = oEvent.getParameter("arguments").productId;
            const oViewModel = this.getView().getModel("detailView");

            if (!/^\d+$/.test(sProductId)) {
                oViewModel.setProperty("/notFound", true);
                oViewModel.setProperty("/busy", false);
                return;
            }

            oViewModel.setProperty("/busy", true);
            oViewModel.setProperty("/notFound", false);
            oViewModel.setProperty("/isEditMode", false);
            oViewModel.setProperty("/isCreateMode", false);
            oViewModel.setProperty("/validation", this._createInitialValidation());

            const oODataModel = this.getOwnerComponent().getModel();
            oODataModel.metadataLoaded().then(() => {
                const sPath = oODataModel.createKey("/Products", { ID: Number(sProductId) });

                oODataModel.read(sPath, {
                    success: (oData) => {
                        const oNormalized = this._normalizeProductData(oData);
                        this._oOriginalData = this._cloneProductData(oNormalized);
                        oViewModel.setProperty("/draft", this._cloneProductData(oNormalized));
                        oViewModel.setProperty("/busy", false);
                    },
                    error: () => {
                        oViewModel.setProperty("/busy", false);
                        oViewModel.setProperty("/notFound", true);
                    }
                });
            });
        },

        _validateForm() {
            const oViewModel = this.getView().getModel("detailView");
            const oDraft = oViewModel.getProperty("/draft");
            const oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            const oValidation = this._createInitialValidation();
            let bIsValid = true;

            if (!oDraft.Name || !oDraft.Name.trim()) {
                oValidation.Name = {
                    state: ValueState.Error,
                    text: oResourceBundle.getText("validationRequired")
                };
                bIsValid = false;
            }

            const nPrice = Number(oDraft.Price);
            if (oDraft.Price === "" || oDraft.Price === null || Number.isNaN(nPrice) || nPrice <= 0) {
                oValidation.Price = {
                    state: ValueState.Error,
                    text: oResourceBundle.getText("validationPriceInvalid")
                };
                bIsValid = false;
            }

            const nRating = Number(oDraft.Rating);
            if (oDraft.Rating === "" || oDraft.Rating === null || !Number.isInteger(nRating) || nRating < 0) {
                oValidation.Rating = {
                    state: ValueState.Error,
                    text: oResourceBundle.getText("validationRatingInvalid")
                };
                bIsValid = false;
            }

            if (!(oDraft.ReleaseDate instanceof Date) || Number.isNaN(oDraft.ReleaseDate.getTime())) {
                oValidation.ReleaseDate = {
                    state: ValueState.Error,
                    text: oResourceBundle.getText("validationRequired")
                };
                bIsValid = false;
            } else if (
                oDraft.DiscontinuedDate instanceof Date &&
                !Number.isNaN(oDraft.DiscontinuedDate.getTime()) &&
                oDraft.DiscontinuedDate.getTime() < oDraft.ReleaseDate.getTime()
            ) {
                oValidation.DiscontinuedDate = {
                    state: ValueState.Error,
                    text: oResourceBundle.getText("validationDateRange")
                };
                bIsValid = false;
            }

            oViewModel.setProperty("/validation", oValidation);
            return bIsValid;
        },

        _hasChanges() {
            if (!this._oOriginalData) {
                return true;
            }

            const oDraft = this.getView().getModel("detailView").getProperty("/draft");
            const iOrigRelease = this._oOriginalData.ReleaseDate ? this._oOriginalData.ReleaseDate.getTime() : null;
            const iDraftRelease = oDraft.ReleaseDate ? oDraft.ReleaseDate.getTime() : null;
            const iOrigDiscontinued = this._oOriginalData.DiscontinuedDate ? this._oOriginalData.DiscontinuedDate.getTime() : null;
            const iDraftDiscontinued = oDraft.DiscontinuedDate ? oDraft.DiscontinuedDate.getTime() : null;

            return (
                oDraft.Name.trim() !== this._oOriginalData.Name ||
                (oDraft.Description || "").trim() !== this._oOriginalData.Description ||
                Number(oDraft.Price).toFixed(2) !== Number(this._oOriginalData.Price).toFixed(2) ||
                parseInt(oDraft.Rating, 10) !== parseInt(this._oOriginalData.Rating, 10) ||
                iDraftRelease !== iOrigRelease ||
                iDraftDiscontinued !== iOrigDiscontinued
            );
        },

        _generateNextProductId(oODataModel, fnCallback) {
            oODataModel.read("/Products", {
                urlParameters: {
                    "$orderby": "ID desc",
                    "$top": "1"
                },
                success: (oData) => {
                    const aResults = (oData && oData.results) || [];
                    const iMaxId = aResults.length > 0 && !Number.isNaN(Number(aResults[0].ID))
                        ? Number(aResults[0].ID)
                        : 0;
                    fnCallback(iMaxId + 1);
                },
                error: () => {
                    fnCallback(Math.floor(Date.now() / 1000));
                }
            });
        },

        _normalizeProductData(oData) {
            return {
                ID: oData.ID,
                Name: oData.Name || "",
                Description: oData.Description || "",
                Price: oData.Price !== undefined && oData.Price !== null ? Number(oData.Price).toFixed(2) : "0.00",
                Rating: oData.Rating !== undefined && oData.Rating !== null ? String(oData.Rating) : "0",
                ReleaseDate: oData.ReleaseDate ? new Date(oData.ReleaseDate) : null,
                DiscontinuedDate: oData.DiscontinuedDate ? new Date(oData.DiscontinuedDate) : null
            };
        },

        _cloneProductData(oProduct) {
            if (!oProduct) {
                return this._createEmptyDraft();
            }

            return {
                ID: oProduct.ID,
                Name: oProduct.Name,
                Description: oProduct.Description,
                Price: oProduct.Price,
                Rating: oProduct.Rating,
                ReleaseDate: oProduct.ReleaseDate ? new Date(oProduct.ReleaseDate.getTime()) : null,
                DiscontinuedDate: oProduct.DiscontinuedDate ? new Date(oProduct.DiscontinuedDate.getTime()) : null
            };
        },

        _createEmptyDraft() {
            return {
                ID: null,
                Name: "",
                Description: "",
                Price: "",
                Rating: "",
                ReleaseDate: new Date(),
                DiscontinuedDate: null
            };
        },

        _createInitialValidation() {
            const oCleanState = () => ({ state: ValueState.None, text: "" });
            return {
                Name: oCleanState(),
                Price: oCleanState(),
                Rating: oCleanState(),
                ReleaseDate: oCleanState(),
                DiscontinuedDate: oCleanState()
            };
        },

        onExit() {
            if (this._oRouter) {
                this._oRouter.getRoute("RouteDetail").detachPatternMatched(this._onRouteDetailMatched, this);
                this._oRouter.getRoute("RouteCreate").detachPatternMatched(this._onRouteCreateMatched, this);
            }
        }
    });
});