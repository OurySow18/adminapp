import "./vendorProductDetails.scss";
import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import {
  firstValue,
  formatDateTime,
  getAttributeLabel,
  getFieldPathHint,
  hasRenderableValue,
  safeDecode,
} from "./vendorProductDetailsHelpers";
import { renderAttributeValue, renderChangeValue } from "./vendorProductDiffRenderers";
import { useVendorProductData } from "./useVendorProductData";
import { useVendorProductView } from "./useVendorProductView";
import { useVendorProductActions } from "./useVendorProductActions";

const VendorProductDetails = () => {
  const { vendorId: vendorIdParam, productId: productIdParam } = useParams();
  const vendorId = safeDecode(vendorIdParam, "_");
  const productId = safeDecode(productIdParam, "");
  const navigate = useNavigate();
  const location = useLocation();
  const docPathFromState =
    typeof location.state?.docPath === "string" ? location.state.docPath : null;
  const stateSource =
    typeof location.state?.source === "string" ? location.state.source : null;
  const stateViewMode =
    typeof location.state?.viewMode === "string" ? location.state.viewMode : null;
  const isPublicCatalogMode =
    location.pathname.startsWith("/catalogue-public") ||
    stateViewMode === "publicCatalog" ||
    stateSource === "public";

  const [imagePreview, setImagePreview] = useState(null);

  const {
    product,
    loading,
    error,
    publicProduct,
    publicProductError,
    statusUpdateState,
    setStatusUpdateState,
  } = useVendorProductData({
    productId,
    vendorId,
    docPathFromState,
    stateSource,
    isPublicCatalogMode,
  });

  const {
    deliveryInfo,
    coverImage,
    galleryImages,
    imagesByColor,
    variantsByColor,
    title,
    mmStatus,
    vmStatus,
    draftChanges,
    pendingDraftChanges,
    productApprovedAt,
    productApprovedBy,
    monmarchePublication,
    visibilityStatus,
    priceInfo,
    stockInfo,
    salesInfo,
    attributes,
    fulfillmentDetails,
    ratingDetails,
    lastUpdated,
    blockedReason,
    categoryDisplayValue,
    topCategoryDisplayValue,
    brandValue,
    getFieldClass,
    getStatClass,
    draftChangeDetails,
    vendorDisplayId,
    vendorName,
    resolvedVendorId,
  } = useVendorProductView(product, publicProduct, vendorId, productId, isPublicCatalogMode);

  const { handleActivate, handleBlock, handleValidateChanges } = useVendorProductActions({
    productId,
    resolvedVendorId,
    product,
    docPathFromState,
    isPublicCatalogMode,
    pendingDraftChanges,
    setStatusUpdateState,
  });

  if (loading) {
    return (
      <div className="vendorProductDetails vendorProductDetails--loading">
        <Sidebar />
        <div className="vendorProductDetails__container">
          <Navbar />
          <div className="vendorProductDetails__content">
            <p>Chargement du produit vendeur...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="vendorProductDetails vendorProductDetails--error">
        <Sidebar />
        <div className="vendorProductDetails__container">
          <Navbar />
          <div className="vendorProductDetails__content vendorProductDetails__content--center">
            <p>{error || "Produit introuvable."}</p>
            <button type="button" onClick={() => navigate(-1)}>
              Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="vendorProductDetails">
      <Sidebar />
      <div className="vendorProductDetails__container">
        <Navbar />
        <div className="vendorProductDetails__content">
          <div className="vendorProductDetails__header">
            <div className="vendorProductDetails__headerLeft">
              <button
                type="button"
                className="vendorProductDetails__back"
                onClick={() => navigate(-1)}
              >
                &larr; Retour
              </button>
              <h1>{title}</h1>
              <p>
                Produit #{productId}  Vendeur :{" "}
                <span className="vendorProductDetails__metaHighlight">
                  {vendorName}
                </span>{" "}
                {" "}
                {lastUpdated === "-"
                  ? "Derniere actualisation indisponible"
                  : `Actualise le ${lastUpdated}`}
              </p>
            </div>
            <div className="vendorProductDetails__headerRight">
              <div className="vendorProductDetails__actions">
                {pendingDraftChanges && product?.__scope !== "public" && (
                  <button
                    type="button"
                    className="vendorProductDetails__actionBtn vendorProductDetails__actionBtn--pending"
                    onClick={handleValidateChanges}
                    disabled={statusUpdateState.loading}
                  >
                    Valider les modifications
                  </button>
                )}
                <button
                  type="button"
                  className="vendorProductDetails__actionBtn vendorProductDetails__actionBtn--activate"
                  onClick={handleActivate}
                  disabled={statusUpdateState.loading || mmStatus}
                >
                  Activer
                </button>
                <button
                  type="button"
                  className="vendorProductDetails__actionBtn vendorProductDetails__actionBtn--block"
                  onClick={handleBlock}
                  disabled={statusUpdateState.loading || !mmStatus}
                >
                  Désactiver
                </button>
          </div>
        </div>
      </div>

      {(statusUpdateState.error || statusUpdateState.success) && (
            <div
              className={`vendorProductDetails__actionFeedback ${
                statusUpdateState.error
                  ? "vendorProductDetails__actionFeedback--error"
                  : "vendorProductDetails__actionFeedback--success"
              }`}
            >
              {statusUpdateState.error || statusUpdateState.success}
            </div>
          )}

          <section className="vendorProductDetails__spotlightSection">
            <div className="vendorProductDetails__sectionHeading">
              <h2>Vue d'ensemble</h2>
              <p>Resume des indicateurs cles et du media principal.</p>
            </div>
            <div className="vendorProductDetails__card vendorProductDetails__card--section vendorProductDetails__spotlightCard">
              <div className="vendorProductDetails__spotlightGrid">
                <div className="vendorProductDetails__cover">
                  {pendingDraftChanges && (
                    <span className="vendorProductDetails__coverBadge">
                      Brouillon vendeur en attente
                    </span>
                  )}
                  <img
                    src={coverImage}
                    alt={title}
                    onClick={() => coverImage && setImagePreview(coverImage)}
                  />
                </div>
                <div className="vendorProductDetails__summary">
                  <div className="vendorProductDetails__statGrid">
                    <div className="vendorProductDetails__stat">
                      <span className="vendorProductDetails__statLabel">
                        Prix
                      </span>
                      <span
                        className={getStatClass(
                          "price",
                          "pricing.basePrice",
                          "core.pricing.basePrice",
                          "draft.core.pricing.basePrice"
                        )}
                      >
                        {priceInfo}
                      </span>
                    </div>
                    <div className="vendorProductDetails__stat">
                      <span className="vendorProductDetails__statLabel">
                        Stock
                      </span>
                      <span
                        className={getStatClass(
                          "stock",
                          "inventory.stock",
                          "core.inventory.stock",
                          "draft.core.inventory.stock"
                        )}
                      >
                        {stockInfo}
                      </span>
                    </div>
                    <div className="vendorProductDetails__stat">
                      <span className="vendorProductDetails__statLabel">
                        Ventes
                      </span>
                      <span className="vendorProductDetails__statValue">
                        {salesInfo}
                      </span>
                    </div>
                    <div className="vendorProductDetails__stat">
                      <span className="vendorProductDetails__statLabel">
                        Visibilite Monmarche
                      </span>
                      <span
                        className={`vendorProductDetails__statValue ${
                          visibilityStatus.tone === "positive"
                            ? "vendorProductDetails__statValue--positive"
                            : visibilityStatus.tone === "negative"
                            ? "vendorProductDetails__statValue--negative"
                            : visibilityStatus.tone === "warning"
                            ? "vendorProductDetails__statValue--warning"
                            : ""
                        }`}
                      >
                        {visibilityStatus.message}
                      </span>
                    </div>
                    <div className="vendorProductDetails__stat">
                      <span className="vendorProductDetails__statLabel">
                        Motif blocage
                      </span>
                      <span
                        className={getStatClass(
                          "blockedReason",
                          "core.blockedReason",
                          "draft.core.blockedReason"
                        )}
                      >
                        {blockedReason}
                      </span>
                    </div>
                  </div>
                  <div className="vendorProductDetails__metaBar">
                    <div className="vendorProductDetails__metaDetails">
                      <span>Produit #{productId}</span>
                      <span>
                        Vendeur :{" "}
                        <span className="vendorProductDetails__metaHighlight">
                          {vendorName}
                        </span>
                      </span>
                      <span>Derniere mise a jour : {lastUpdated}</span>
                    </div>
                    <div className="vendorProductDetails__chips vendorProductDetails__chips--inline">
                      <span
                        className={`vendorProductDetails__chip ${
                          mmStatus
                            ? "vendorProductDetails__chip--positive"
                            : "vendorProductDetails__chip--negative"
                        }`}
                      >
                        Admin : {mmStatus ? "Actif" : "Inactif"}
                      </span>
                      <span
                        className={`vendorProductDetails__chip ${
                          vmStatus
                            ? "vendorProductDetails__chip--positive"
                            : "vendorProductDetails__chip--negative"
                        }`}
                      >
                    Vendeur : {vmStatus ? "Actif" : "Inactif"}
                  </span>
                  {pendingDraftChanges && (
                    <span className="vendorProductDetails__chip vendorProductDetails__chip--warning">
                      Modifications en attente
                    </span>
                  )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="vendorProductDetails__layout">
            <div className="vendorProductDetails__primaryColumn">
              {pendingDraftChanges && (
                <section className="vendorProductDetails__card vendorProductDetails__card--section vendorProductDetails__card--validation">
                  <div className="vendorProductDetails__cardHeader">
                    <div className="vendorProductDetails__validationTitle">
                      <h2>Nouveaux champs a valider</h2>
                      <span className="vendorProductDetails__validationBadge">
                        {draftChangeDetails.length || draftChanges.length} champ
                        {(draftChangeDetails.length || draftChanges.length) > 1
                          ? "s"
                          : ""}
                      </span>
                    </div>
                    <p>
                      Ces champs ont ete modifies par le vendeur. Comparez la
                      proposition a la version publiee avant de valider.
                    </p>
                  </div>
                  {draftChangeDetails.length > 0 ? (
                    <ul className="vendorProductDetails__draftList vendorProductDetails__draftList--detailed">
                      {draftChangeDetails.map((change) => (
                        <li key={change.path}>
                          <div className="vendorProductDetails__draftField">
                            <strong>{change.label}</strong>
                            {getFieldPathHint(change.path) ? (
                              <span
                                className="vendorProductDetails__draftPath"
                                title={change.path}
                              >
                                {getFieldPathHint(change.path)}
                              </span>
                            ) : null}
                          </div>
                          <div className="vendorProductDetails__draftValues">
                            <div>
                              <span className="vendorProductDetails__draftValuesLabel">
                                Proposition vendeur
                              </span>
                              {renderChangeValue(change.vendorValue, change.path)}
                            </div>
                            <div>
                              <span className="vendorProductDetails__draftValuesLabel">
                                Version publiee
                              </span>
                              {renderChangeValue(
                                change.publishedValue,
                                change.path
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="vendorProductDetails__description">
                      Des modifications sont en attente, mais aucun ecart de
                      valeur n'a ete detecte avec la version publiee.
                    </p>
                  )}
                </section>
              )}

              <section className="vendorProductDetails__card vendorProductDetails__card--section">
                <div className="vendorProductDetails__cardHeader">
                  <h2>Description</h2>
                  <p>Resume fonctionnel partage par le vendeur.</p>
                </div>
                <p
                  className={`vendorProductDetails__description ${getFieldClass(
                    "description",
                    "core.description",
                    "draft.core.description"
                  )}`}
                >
                  {firstValue(
                    product.description,
                    product.core?.description,
                    product.draft?.core?.description,
                    "Aucune description fournie."
                  )}
                </p>
              </section>

              {attributes.length > 0 && (
                <section className="vendorProductDetails__card vendorProductDetails__card--section">
                  <div className="vendorProductDetails__cardHeader">
                    <h2>Attributs</h2>
                    <p>Donnees declaratives fournies par le vendeur.</p>
                  </div>
                  <div className="vendorProductDetails__attributes">
                    {attributes.map(([key, value]) => (
                      <div className="vendorProductDetails__attributeRow" key={key}>
                        <span
                          className="vendorProductDetails__attributeKey"
                          title={key}
                        >
                          {getAttributeLabel(key)}
                        </span>
                        <span
                          className={`vendorProductDetails__attributeValue ${getFieldClass(
                            `attributes.${key}`,
                            `core.attributes.${key}`,
                            `draft.core.attributes.${key}`
                          )}`}
                        >
                          {renderAttributeValue(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {hasRenderableValue(fulfillmentDetails) && (
                <section className="vendorProductDetails__card vendorProductDetails__card--section">
                  <div className="vendorProductDetails__cardHeader">
                    <h2>Livraison detaillee</h2>
                    <p>Informations de livraison fournies pour ce produit.</p>
                  </div>
                  <div className="vendorProductDetails__detailsBlock">
                    {renderChangeValue(fulfillmentDetails, "fulfillment")}
                  </div>
                </section>
              )}

              {hasRenderableValue(ratingDetails) && (
                <section className="vendorProductDetails__card vendorProductDetails__card--section">
                  <div className="vendorProductDetails__cardHeader">
                    <h2>Avis & notes</h2>
                    <p>Indicateurs publics associes au produit.</p>
                  </div>
                  <div className="vendorProductDetails__detailsBlock">
                    {renderChangeValue(ratingDetails, "rating")}
                  </div>
                </section>
              )}

              {galleryImages.length > 1 && (
                <section className="vendorProductDetails__card vendorProductDetails__card--section">
                  <div className="vendorProductDetails__cardHeader">
                    <h2>Galerie</h2>
                    <p>Visuels complementaires soumis par le vendeur.</p>
                  </div>
                  <div className="vendorProductDetails__gallery">
                    {galleryImages.slice(1).map((url, index) => (
                      <div
                        className="vendorProductDetails__galleryItem"
                        key={url || index}
                      >
                        <img
                          src={url}
                          alt={`Apercu ${index}`}
                          onClick={() => url && setImagePreview(url)}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {variantsByColor.length > 0 && (
                <section className="vendorProductDetails__card vendorProductDetails__card--section vendorProductDetails__card--highlight">
                  <div className="vendorProductDetails__cardHeader">
                    <h2>Variantes & visuels</h2>
                    <p>Groupées par couleur avec options et photos.</p>
                  </div>
                  <div className="vendorProductDetails__variants">
                    {variantsByColor.map(({ color, list }) => {
                      const colorKey = String(color || "").trim().toLowerCase();
                      const colorImages = imagesByColor.get(colorKey) || [];
                      const hasPriceOrStock = list.some(
                        (variant) =>
                          variant.optionValues.price !== undefined ||
                          variant.optionValues.stock !== undefined
                      );
                      return (
                        <div className="vendorProductDetails__variantCard" key={color || "autres"}>
                          <div className="vendorProductDetails__variantHeader">
                            <span className="vendorProductDetails__variantLabel">
                              Couleur : {color}
                            </span>
                            <span className="vendorProductDetails__variantCount">
                              {list.length} déclinaison(s)
                            </span>
                          </div>
                          {colorImages.length > 0 && (
                            <div className="vendorProductDetails__variantGallery">
                              {colorImages.map((url, idx) => (
                                <div
                                  className="vendorProductDetails__variantImgWrapper"
                                  key={url || idx}
                                >
                                  <img
                                    src={url}
                                    alt={`Variante ${color} - ${idx + 1}`}
                                    onClick={() => url && setImagePreview(url)}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="vendorProductDetails__variantOptions">
                            {list.map((variant) => (
                              <div
                                className="vendorProductDetails__variantRow"
                                key={variant.vid || variant.idx}
                              >
                                <div className="vendorProductDetails__variantMeta">
                                  <span className="vendorProductDetails__variantChip">
                                    Variante #{variant.idx}
                                  </span>
                                  {variant.vid && (
                                    <span className="vendorProductDetails__variantVid">
                                      {variant.vid}
                                    </span>
                                  )}
                                </div>
                                {(() => {
                                  const displayImages =
                                    (Array.isArray(variant.images) && variant.images.length
                                      ? variant.images
                                      : colorImages) || [];
                                  const limited =
                                    Array.isArray(displayImages) && displayImages.length
                                      ? displayImages.slice(0, 4)
                                      : [];
                                  if (!limited.length) return null;
                                  return (
                                    <div className="vendorProductDetails__variantGallery vendorProductDetails__variantGallery--compact vendorProductDetails__variantGallery--inline">
                                      {limited.map((url, idx) => (
                                        <div
                                          className="vendorProductDetails__variantImgWrapper"
                                          key={url || idx}
                                        >
                                          <img
                                            src={url}
                                            alt={`Variante ${color} - ${idx + 1}`}
                                            onClick={() => url && setImagePreview(url)}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                                <div className="vendorProductDetails__variantOptionsGrid">
                                  {Object.entries(variant.optionValues)
                                    .filter(
                                      ([key]) =>
                                        key.toLowerCase() !== "color" &&
                                        key.toLowerCase() !== "couleur" &&
                                        key.toLowerCase() !== "price" &&
                                        key.toLowerCase() !== "stock"
                                    )
                                    .map(([key, value]) => (
                                      <div
                                        className="vendorProductDetails__variantOption"
                                        key={key}
                                      >
                                        <span className="vendorProductDetails__variantOptionLabel">
                                          {getAttributeLabel(key)}
                                        </span>
                                        <span className="vendorProductDetails__variantOptionValue">
                                          {String(value)}
                                        </span>
                                      </div>
                                    ))}
                                  <div className="vendorProductDetails__variantOption">
                                    <span className="vendorProductDetails__variantOptionLabel">
                                      Prix
                                    </span>
                                    <span className="vendorProductDetails__variantOptionValue">
                                      {variant.optionValues.price !== undefined
                                        ? variant.optionValues.price
                                        : hasPriceOrStock
                                        ? "—"
                                        : "N/A"}
                                    </span>
                                  </div>
                                  <div className="vendorProductDetails__variantOption">
                                    <span className="vendorProductDetails__variantOptionLabel">
                                      Stock
                                    </span>
                                    <span className="vendorProductDetails__variantOptionValue">
                                      {variant.optionValues.stock !== undefined
                                        ? variant.optionValues.stock
                                        : hasPriceOrStock
                                        ? "—"
                                        : "N/A"}
                                    </span>
                                  </div>
                                </div>
                                {Array.isArray(variant.images) && variant.images.length > 0 && (
                                  <div className="vendorProductDetails__variantGallery vendorProductDetails__variantGallery--compact">
                                    {variant.images.map((url, idx) => (
                                      <div
                                        className="vendorProductDetails__variantImgWrapper"
                                        key={url || idx}
                                      >
                                        <img
                                          src={url}
                                          alt={`Variante ${color} - ${idx + 1}`}
                                          onClick={() => url && setImagePreview(url)}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>

            <aside className="vendorProductDetails__sideColumn">
              <section className="vendorProductDetails__card vendorProductDetails__card--section">
                <div className="vendorProductDetails__cardHeader">
                  <h2>Informations essentielles</h2>
                  <p>Identification et classification du produit.</p>
                </div>
                <div className="vendorProductDetails__infoGrid">
                  <div className="vendorProductDetails__infoItem">
                    <span className="vendorProductDetails__infoLabel">Vendeur</span>
                    <span className="vendorProductDetails__infoValue vendorProductDetails__infoValue--accent">
                      {vendorName}
                    </span>
                  </div>
                  <div className="vendorProductDetails__infoItem">
                    <span className="vendorProductDetails__infoLabel">Product ID</span>
                    <span className="vendorProductDetails__infoValue">{productId}</span>
                  </div>
                  <div className="vendorProductDetails__infoItem">
                    <span className="vendorProductDetails__infoLabel">Catégorie</span>
                    <span
                      className={`vendorProductDetails__infoValue ${getFieldClass(
                        "categoryId",
                        "category",
                        "core.categoryId",
                        "draft.core.categoryId"
                      )}`}
                    >
                      {categoryDisplayValue}
                    </span>
                  </div>
                  <div className="vendorProductDetails__infoItem">
                    <span className="vendorProductDetails__infoLabel">Catégorie principale</span>
                    <span
                      className={`vendorProductDetails__infoValue ${getFieldClass(
                        "topCategory",
                        "core.topCategory",
                        "draft.core.topCategory"
                      )}`}
                    >
                      {topCategoryDisplayValue}
                    </span>
                  </div>
                  <div className="vendorProductDetails__infoItem">
                    <span className="vendorProductDetails__infoLabel">Marque</span>
                    <span
                      className={`vendorProductDetails__infoValue ${getFieldClass(
                        "brand",
                        "core.brand",
                        "draft.core.brand"
                      )}`}
                    >
                      {brandValue}
                    </span>
                  </div>
                </div>
              </section>

              <section className="vendorProductDetails__card vendorProductDetails__card--section">
                <div className="vendorProductDetails__cardHeader">
                  <h2>Publication & conformite</h2>
                  <p>Suivi des statuts visibles sur Monmarche.</p>
                </div>
                <div className="vendorProductDetails__publication">
                  <div
                    className={`vendorProductDetails__badge ${
                      monmarchePublication.isPublished
                        ? "vendorProductDetails__badge--positive"
                        : "vendorProductDetails__badge--negative"
                    }`}
                  >
                    {monmarchePublication.message}
                  </div>
                  <ul className="vendorProductDetails__statusList">
                    <li>
                      <span>Statut admin</span>
                      <span
                        className={`vendorProductDetails__statusValue ${
                          mmStatus
                            ? "vendorProductDetails__statusValue--positive"
                            : "vendorProductDetails__statusValue--negative"
                        }`}
                      >
                        {mmStatus ? "Actif" : "Inactif"}
                      </span>
                    </li>
                    <li>
                      <span>Statut vendeur</span>
                      <span
                        className={`vendorProductDetails__statusValue ${
                          vmStatus
                            ? "vendorProductDetails__statusValue--positive"
                            : "vendorProductDetails__statusValue--negative"
                        }`}
                      >
                        {vmStatus ? "Actif" : "Inactif"}
                      </span>
                    </li>
                    <li>
                      <span>Propositions vendeur</span>
                      <span
                        className={`vendorProductDetails__statusValue ${
                          pendingDraftChanges
                            ? "vendorProductDetails__statusValue--warning"
                            : ""
                        }`}
                      >
                        {pendingDraftChanges
                          ? "En attente de validation"
                          : "Aucune modification"}
                      </span>
                    </li>
                    <li>
                      <span>Blocage</span>
                      <span
                        className={getStatClass(
                          "blockedReason",
                          "core.blockedReason",
                          "draft.core.blockedReason"
                        )}
                      >
                        {blockedReason}
                      </span>
                    </li>
                    <li>
                      <span>Validé le</span>
                      <span>{formatDateTime(productApprovedAt)}</span>
                    </li>
                    <li>
                      <span>Validé par</span>
                      <span>{productApprovedBy}</span>
                    </li>
                  </ul>
                </div>
                {publicProductError && (
                  <div className="vendorProductDetails__publicWarning vendorProductDetails__publicWarning--compact">
                    {publicProductError}
                  </div>
                )}

                <section className="vendorProductDetails__card vendorProductDetails__card--section vendorProductDetails__card--highlight">
                  <div className="vendorProductDetails__cardHeader">
                    <h2>Livraison</h2>
                    <p>Informations clés pour l'expédition.</p>
                  </div>
                  <div className="vendorProductDetails__deliveryGrid">
                    <div className="vendorProductDetails__deliveryItem">
                      <span className="vendorProductDetails__deliveryLabel">Mode</span>
                      <span className="vendorProductDetails__deliveryValue">
                        {deliveryInfo.modeLabel || "—"}
                      </span>
                    </div>
                    <div className="vendorProductDetails__deliveryItem">
                      <span className="vendorProductDetails__deliveryLabel">Zones / périmètre</span>
                      <span className="vendorProductDetails__deliveryValue">
                        {deliveryInfo.zonesLabel || "—"}
                      </span>
                    </div>
                    <div className="vendorProductDetails__deliveryItem">
                      <span className="vendorProductDetails__deliveryLabel">Frais</span>
                      <span className="vendorProductDetails__deliveryValue">
                        {deliveryInfo.feeLabel || "—"}
                      </span>
                    </div>
                    <div className="vendorProductDetails__deliveryItem">
                      <span className="vendorProductDetails__deliveryLabel">Délai estimé</span>
                      <span className="vendorProductDetails__deliveryValue">
                        {deliveryInfo.delayLabel || "—"}
                      </span>
                    </div>
                    {deliveryInfo.note ? (
                      <div className="vendorProductDetails__deliveryItem vendorProductDetails__deliveryItem--full">
                        <span className="vendorProductDetails__deliveryLabel">Note</span>
                        <span className="vendorProductDetails__deliveryValue">
                          {deliveryInfo.note}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </section>
              </section>

              <section className="vendorProductDetails__card vendorProductDetails__card--section">
                <div className="vendorProductDetails__cardHeader">
                  <h2>Raccourcis</h2>
                  <p>Actions rapides autour de ce produit.</p>
                </div>
                <div className="vendorProductDetails__links">
                  <Link to="/vendor-products" className="vendorProductDetails__linkButton">
                    Retour a la liste des produits vendeurs
                  </Link>
                  {vendorDisplayId &&
                    vendorDisplayId !== "-" &&
                    vendorDisplayId !== "_" && (
                    <Link
                      to={`/vendors/${encodeURIComponent(vendorDisplayId)}`}
                      className="vendorProductDetails__linkButton"
                    >
                      Consulter le vendeur
                    </Link>
                  )}
                </div>
              </section>
            </aside>
          </div>

        </div>
      </div>
    </div>
    {imagePreview && (
      <div
        className="vendorProductDetails__imageOverlay"
        onClick={() => setImagePreview(null)}
        role="presentation"
      >
        <div
          className="vendorProductDetails__imageModal"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="vendorProductDetails__imageClose"
            onClick={() => setImagePreview(null)}
            aria-label="Fermer l'aperçu"
          >
            ×
          </button>
          <img src={imagePreview} alt={title} />
        </div>
      </div>
    )}
    </>
  );
};

export default VendorProductDetails;

