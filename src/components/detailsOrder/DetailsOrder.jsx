import "../../style/orderDetails.scss"
import "./detailsOrderPage.scss";
import { useState, useEffect } from "react";
import Sidebar from "../sidebar/Sidebar";
import Navbar from "../navbar/Navbar";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { resolveOrderDate } from "../../utils/orderDate";
import ConfirmModal from "../modal/ConfirmModal";
import { formatDateTime, formatPackaging, formatPrice, toNumber } from "./detailsOrderHelpers";
import { useOrderData } from "./useOrderData";
import { useOrderActions } from "./useOrderActions";

const DetailsOrder = ({ title, btnValidation, mode = "orders" }) => {
  const [previewImage, setPreviewImage] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const isArchivedMode = mode === "archived" || location.pathname.startsWith("/delivredOrders");
  const isDeliveryMode = mode === "delivery" || location.pathname.startsWith("/delivery");
  const listRoute = isArchivedMode
    ? "/delivredOrders"
    : isDeliveryMode
    ? "/delivery"
    : location.pathname.startsWith("/fake-orders")
    ? "/fake-orders"
    : "/orders";

  const { orderDetails, loading, loadError, orderVendors } = useOrderData(title, params.id);

  const {
    isProcessing,
    actionFeedback,
    actionError,
    fakeModalOpen,
    fakeOrderMessage,
    setFakeOrderMessage,
    fakeModalError,
    setFakeModalError,
    driverModalOpen,
    driverModalError,
    setDriverModalError,
    activeDrivers,
    selectedDriverUid,
    setSelectedDriverUid,
    validateOrder,
    closeDriverModal,
    confirmDriverAssignmentAndValidate,
    printOrder,
    archiveDeliveryOrder,
    openFakeOrderModal,
    closeFakeOrderModal,
    markAsFakeOrder,
  } = useOrderActions({ title, orderId: params.id, orderDetails, navigate });

  useEffect(() => {
    if (!previewImage) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setPreviewImage(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [previewImage]);

  // Gérer le retour en arrière
  const goBack = () => {
    navigate(listRoute);
  };

  const isPayedOnline = Boolean(orderDetails?.payedOnline);
  const paymentLabel = orderDetails?.payed
    ? "Payé"
    : isPayedOnline
    ? "Payé en ligne"
    : "En attente";
  const deliveryLabel = orderDetails?.delivered ? "Livré" : "Non livré";
  const fakeLabel = orderDetails?.fakeOrder ? "Fausse commande" : "Non";
  const orderDate = resolveOrderDate(orderDetails || {});
  const orderDateLabel = format(orderDate, "dd/MM/yyyy HH:mm:ss");
  const cartItems = Array.isArray(orderDetails?.cart) ? orderDetails.cart : [];
  const orderItemRows = cartItems.map((product, index) => {
    const productId = product?.productId || product?.id || product?.product?.id;
    const vendorId =
      product?.vendorId ||
      product?.vendor?.vendorId ||
      product?.vendor?.id ||
      product?.vendor?.uid ||
      product?.sellerId ||
      product?.storeId;
    const vendorDocument = vendorId ? orderVendors[String(vendorId)] || {} : {};
    const vendorCompany =
      vendorDocument?.company || vendorDocument?.profile?.company || {};
    const packaging = [
      product?.poids,
      product?.weight,
      product?.conditionnement,
      product?.packaging,
      product?.unit,
      product?.attributes?.weight,
      product?.attributes?.poids,
    ].find((value) => value !== undefined && value !== null && value !== "");
    const quantityBulk = Math.max(0, toNumber(product?.quantityBulk, 0));
    const quantityDetail = Math.max(0, toNumber(product?.quantityDetail, 0));
    const amountBulk = toNumber(product?.amountBulk, 0);
    const amountDetail = toNumber(product?.amountDetail, 0);
    const totalAmount = toNumber(
      product?.totalAmount ?? product?.total ?? product?.amount,
      amountBulk + amountDetail
    );
    const commissionAmount = Math.round(totalAmount * 0.05 * 100) / 100;
    const vendorNetAmount =
      Math.round((totalAmount - commissionAmount) * 100) / 100;
    const genericQuantity = Math.max(
      0,
      toNumber(product?.quantity ?? product?.qty, 0)
    );
    const genericPrice = toNumber(
      product?.price ?? product?.unitPrice,
      genericQuantity > 0 ? totalAmount / genericQuantity : 0
    );
    const purchases = [];

    if (quantityBulk > 0 || amountBulk > 0) {
      purchases.push({
        key: "bulk",
        label: "Gros",
        quantity: quantityBulk,
        unitPrice: toNumber(
          product?.priceBulk,
          quantityBulk > 0 ? amountBulk / quantityBulk : 0
        ),
        amount: amountBulk,
      });
    }
    if (quantityDetail > 0 || amountDetail > 0) {
      purchases.push({
        key: "detail",
        label: "Détail",
        quantity: quantityDetail,
        unitPrice: toNumber(
          product?.priceDetail,
          quantityDetail > 0 ? amountDetail / quantityDetail : 0
        ),
        amount: amountDetail,
      });
    }
    if (!purchases.length) {
      purchases.push({
        key: "unit",
        label: "Unité",
        quantity: genericQuantity || 1,
        unitPrice: genericPrice || totalAmount,
        amount: totalAmount,
      });
    }

    return {
      ...product,
      productId,
      vendorId,
      rowKey: `${product?.productId || product?.id || "item"}-${index}`,
      displayName: product?.name || product?.title || product?.productName || "Produit sans nom",
      vendorName:
        vendorCompany?.name ||
        product?.vendorName ||
        product?.vendor?.name ||
        product?.vendor?.vendorName ||
        "Monmarché",
      vendorPhone:
        vendorCompany?.phone ||
        product?.vendorPhone ||
        product?.shopPhone ||
        product?.storePhone ||
        product?.vendor?.phone ||
        product?.vendor?.company?.phone ||
        product?.vendor?.profile?.company?.phone ||
        null,
      vendorAddress:
        vendorCompany?.address ||
        product?.vendorAddress ||
        product?.shopAddress ||
        product?.storeAddress ||
        product?.vendor?.address ||
        product?.vendor?.company?.address ||
        product?.vendor?.profile?.company?.address ||
        null,
      image:
        product?.image ||
        product?.img ||
        product?.imageUrl ||
        product?.photo ||
        product?.media?.cover ||
        product?.images?.[0] ||
        null,
      packaging: formatPackaging(packaging),
      purchases,
      totalAmount,
      commissionAmount,
      vendorNetAmount,
    };
  });
  const cartTotal = orderItemRows.reduce(
    (sum, product) => sum + product.totalAmount,
    0
  );
  const vendorsNetTotal = orderItemRows.reduce(
    (sum, product) => sum + product.vendorNetAmount,
    0
  );
  const totalUnits = orderItemRows.reduce(
    (sum, product) =>
      sum + product.purchases.reduce((quantity, purchase) => quantity + purchase.quantity, 0),
    0
  );
  const isPrimaryActionDisabled = isDeliveryMode
    ? isProcessing || orderDetails?.archived || orderDetails?.delivered
    : isArchivedMode
    ? isProcessing
    : isProcessing || orderDetails?.payed;
  const primaryActionLabel = isArchivedMode
    ? isProcessing
      ? "Traitement..."
      : btnValidation
    : isDeliveryMode
    ? orderDetails?.archived || orderDetails?.delivered
      ? "Livraison déjà archivée"
      : isProcessing
      ? "Traitement..."
      : btnValidation
    : orderDetails?.payed
    ? "Commande déjà validée"
    : isProcessing
    ? "Traitement..."
    : btnValidation;
  const handlePrimaryAction = isArchivedMode
    ? printOrder
    : isDeliveryMode
    ? archiveDeliveryOrder
    : validateOrder;

  if (loading) {
    return (
      <div className="details">
        <Sidebar />
        <div className="detailsContainer">
          <Navbar />
          <div className="detailsOrderPage__state">Chargement de la commande...</div>
        </div>
      </div>
    );
  }

  if (loadError || !orderDetails) {
    return (
      <div className="details">
        <Sidebar />
        <div className="detailsContainer">
          <Navbar />
          <div className="detailsOrderPage__state detailsOrderPage__state--error">
            {loadError || "Commande introuvable."}
          </div>
          <div className="actionsBar">
            <button className="btnSecondary" onClick={goBack}>
              Revenir en arrière
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="details detailsOrderPage">
      <Sidebar />
      <div className="detailsContainer">
        <Navbar />

        <div className="top detailsOrderPage__top">
          <div>
            <h1>{isDeliveryMode ? "Détails de la livraison" : "Détails de la commande"}</h1>
            <p className="detailsOrderPage__subtitle">
              Commande #{orderDetails?.orderId || params.id}
            </p>
          </div>
          <div className="detailsOrderPage__topActions">
            <button
              className="btnPrimary"
              onClick={handlePrimaryAction}
              disabled={isPrimaryActionDisabled}
            >
              {primaryActionLabel}
            </button>
          </div>
        </div>

        {(actionFeedback || actionError) && (
          <div className={`detailsOrderPage__alert ${actionError ? "detailsOrderPage__alert--error" : ""}`}>
            {actionError || actionFeedback}
          </div>
        )}

        <div className="detailsOrderPage__statusRow">
          <span className={`statusBadge ${orderDetails?.payed || isPayedOnline ? "statusBadge--success" : "statusBadge--warning"}`}>
            Paiement: {paymentLabel}
          </span>
          <span className={`statusBadge ${isPayedOnline ? "statusBadge--success" : "statusBadge--neutral"}`}>
            Paiement en ligne: {isPayedOnline ? "Oui" : "Non"}
          </span>
          <span className={`statusBadge ${orderDetails?.delivered ? "statusBadge--success" : "statusBadge--warning"}`}>
            Livraison: {deliveryLabel}
          </span>
          <span className={`statusBadge ${orderDetails?.fakeOrder ? "statusBadge--danger" : "statusBadge--neutral"}`}>
            Fausse commande: {fakeLabel}
          </span>
        </div>

        <div className="formContainer detailsOrderPage__grid">
          <div className="detailsOrderPage__card">
            <h2>Commande</h2>
            <div className="detailsOrderPage__kv"><span>ID</span><strong>{orderDetails?.orderId || params.id}</strong></div>
            <div className="detailsOrderPage__kv"><span>Date</span><strong>{orderDateLabel}</strong></div>
            <div className="detailsOrderPage__kv"><span>Total</span><strong>{formatPrice(orderDetails?.total)}</strong></div>
            <div className="detailsOrderPage__kv"><span>Mode de paiement</span><strong>{orderDetails?.paymentType || "—"}</strong></div>
            <div className="detailsOrderPage__kv"><span>Payé en ligne</span><strong>{isPayedOnline ? "Oui" : "Non"}</strong></div>
          </div>

          <div className="detailsOrderPage__card">
            <h2>Client & livraison</h2>
            <div className="detailsOrderPage__kv"><span>Email</span><strong>{orderDetails?.mail_invoice || "—"}</strong></div>
            <div className="detailsOrderPage__kv"><span>Nom</span><strong>{orderDetails?.deliverInfos?.name || "—"}</strong></div>
            <div className="detailsOrderPage__kv"><span>Téléphone</span><strong>{orderDetails?.deliverInfos?.phone || "—"}</strong></div>
            <div className="detailsOrderPage__kv"><span>Adresse</span><strong>{orderDetails?.deliverInfos?.address || "—"}</strong></div>
            <div className="detailsOrderPage__kv"><span>Description</span><strong>{orderDetails?.deliverInfos?.additionalInfo || "—"}</strong></div>
          </div>

          <div className="detailsOrderPage__card">
            <h2>Historique</h2>
            <div className="detailsOrderPage__kv"><span>Commande créée</span><strong>{formatDateTime(orderDetails?.timeStamp)}</strong></div>
            <div className="detailsOrderPage__kv"><span>Livreur assigné</span><strong>{orderDetails?.assignedDriverUsername || orderDetails?.driverUsername || "—"}</strong></div>
            <div className="detailsOrderPage__kv"><span>UID livreur</span><strong>{orderDetails?.assignedDriverUid || orderDetails?.driverUid || "—"}</strong></div>
            <div className="detailsOrderPage__kv"><span>Assigné le</span><strong>{formatDateTime(orderDetails?.assignedDriverAt)}</strong></div>
            <div className="detailsOrderPage__kv"><span>Dernière modification par</span><strong>{orderDetails?.lastModifiedBy || "—"}</strong></div>
            <div className="detailsOrderPage__kv"><span>Dernière modification le</span><strong>{formatDateTime(orderDetails?.lastModifiedAt)}</strong></div>
            <div className="detailsOrderPage__kv"><span>Marquée fausse le</span><strong>{formatDateTime(orderDetails?.fakeOrderAt)}</strong></div>
            <div className="detailsOrderPage__kv"><span>Message client</span><strong>{orderDetails?.fakeOrderMessage || "—"}</strong></div>
          </div>

          {/* === Produits commandés === */}
          <div className="orderItems detailsOrderPage__products">
            <div className="orderItems__heading">
              <div>
                <h2>Produits commandés</h2>
                <p>
                  {orderItemRows.length} produit{orderItemRows.length > 1 ? "s" : ""}
                  {totalUnits > 0 ? ` · ${totalUnits} article${totalUnits > 1 ? "s" : ""}` : ""}
                </p>
              </div>
              <strong>{formatPrice(cartTotal)}</strong>
            </div>

            {orderItemRows.length > 0 ? (
              <>
                {/* Tableau (desktop) */}
                <div className="orderTableWrap">
                  <table className="orderTable">
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th>Vendeur</th>
                        <th>Conditionnement</th>
                        <th>Achat</th>
                        <th className="money">À payer au vendeur</th>
                        <th className="money">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderItemRows.map((p) => (
                        <tr key={p.rowKey}>
                          <td>
                            <div className="orderProduct">
                              {p.image ? (
                                <button
                                  type="button"
                                  className="orderProduct__imageButton"
                                  onClick={() =>
                                    setPreviewImage({ src: p.image, title: p.displayName })
                                  }
                                  aria-label={`Agrandir l’image de ${p.displayName}`}
                                >
                                  <img src={p.image} alt={p.displayName} className="orderProduct__image" />
                                </button>
                              ) : (
                                <span className="orderProduct__placeholder" aria-hidden="true">
                                  {p.displayName.charAt(0).toUpperCase()}
                                </span>
                              )}
                              <div>
                                {p.productId ? (
                                  <Link
                                    to={`/vendor-products/${encodeURIComponent(p.productId)}`}
                                    className="orderProduct__link"
                                  >
                                    {p.displayName}
                                  </Link>
                                ) : (
                                  <strong>{p.displayName}</strong>
                                )}
                                {p.productId && <small>ID : {p.productId}</small>}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="orderVendor">
                              <strong>{p.vendorName}</strong>
                              {p.vendorPhone && (
                                <a href={`tel:${p.vendorPhone}`}>{p.vendorPhone}</a>
                              )}
                              {p.vendorAddress && <span>{p.vendorAddress}</span>}
                            </div>
                          </td>
                          <td>{p.packaging || "—"}</td>
                          <td>
                            <div className="orderPurchases">
                              {p.purchases.map((purchase) => (
                                <div className="orderPurchase" key={purchase.key}>
                                  <span className={`orderPurchase__type orderPurchase__type--${purchase.key}`}>
                                    {purchase.label}
                                  </span>
                                  <span>
                                    {purchase.quantity} × {formatPrice(purchase.unitPrice)}
                                  </span>
                                  {p.purchases.length > 1 && (
                                    <small>{formatPrice(purchase.amount)}</small>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="money vendorPayoutCell">
                            <strong>{formatPrice(p.vendorNetAmount)}</strong>
                            <small>
                              Commission 5 % : {formatPrice(p.commissionAmount)}
                            </small>
                          </td>
                          <td className="money totalCell">
                            {formatPrice(p.totalAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} className="tfootLabel">
                          Totaux
                        </td>
                        <td className="money vendorPayoutTotal">
                          <small>Net vendeurs</small>
                          {formatPrice(vendorsNetTotal)}
                        </td>
                        <td className="money tfootTotal">
                          {formatPrice(
                            cartTotal
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Cartes (mobile) */}
                <div className="orderCards">
                  {orderItemRows.map((p) => (
                    <div className="orderCard" key={`card-${p.rowKey}`}>
                      <div className="orderProduct">
                        {p.image ? (
                          <button
                            type="button"
                            className="orderProduct__imageButton"
                            onClick={() =>
                              setPreviewImage({ src: p.image, title: p.displayName })
                            }
                            aria-label={`Agrandir l’image de ${p.displayName}`}
                          >
                            <img src={p.image} alt={p.displayName} className="orderProduct__image" />
                          </button>
                        ) : (
                          <span className="orderProduct__placeholder" aria-hidden="true">
                            {p.displayName.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div>
                          {p.productId ? (
                            <Link
                              to={`/vendor-products/${encodeURIComponent(p.productId)}`}
                              className="orderProduct__link"
                            >
                              {p.displayName}
                            </Link>
                          ) : (
                            <strong>{p.displayName}</strong>
                          )}
                          <small>{p.vendorName}</small>
                          {p.vendorPhone && (
                            <a className="orderProduct__vendorContact" href={`tel:${p.vendorPhone}`}>
                              {p.vendorPhone}
                            </a>
                          )}
                          {p.vendorAddress && (
                            <small className="orderProduct__vendorAddress">
                              {p.vendorAddress}
                            </small>
                          )}
                        </div>
                      </div>
                      {p.packaging && (
                        <div className="row">
                          <span className="label">Conditionnement</span>
                          <span className="value">{p.packaging}</span>
                        </div>
                      )}
                      <div className="row orderCard__purchaseRow">
                        <span className="label">Achat</span>
                        <span className="value orderPurchases">
                          {p.purchases.map((purchase) => (
                            <span className="orderPurchase" key={purchase.key}>
                              <span className={`orderPurchase__type orderPurchase__type--${purchase.key}`}>
                                {purchase.label}
                              </span>
                              <span>{purchase.quantity} × {formatPrice(purchase.unitPrice)}</span>
                            </span>
                          ))}
                        </span>
                      </div>
                      <div className="divider" />
                      <div className="row vendorPayoutRow">
                        <span className="label">À payer au vendeur</span>
                        <span className="value">
                          {formatPrice(p.vendorNetAmount)}
                          <small>
                            Commission 5 % : {formatPrice(p.commissionAmount)}
                          </small>
                        </span>
                      </div>
                      <div className="row total">
                        <span className="label">Total</span>
                        <span className="value">
                          {formatPrice(p.totalAmount)}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="grandTotalCard">
                    <div>
                      <span className="label">Net vendeurs</span>
                      <span className="value">{formatPrice(vendorsNetTotal)}</span>
                    </div>
                    <div>
                      <span className="label">Sous-total produits</span>
                      <span className="value">{formatPrice(cartTotal)}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="empty">Aucun produit dans cette commande.</p>
            )}
          </div>
        </div>
        <div className="actionsBar">
          <button className="btnSecondary" onClick={goBack} disabled={isProcessing}>
            Revenir en arrière
          </button>
          {!isArchivedMode ? (
            <button className="btnPrimary" onClick={printOrder} disabled={isProcessing}>
              Imprimer la commande
            </button>
          ) : null}
          {!isArchivedMode ? (
            <button
              className="btnDanger"
              onClick={openFakeOrderModal}
              disabled={isProcessing || orderDetails?.fakeOrder}
            >
              Fausse commande
            </button>
          ) : null}
        </div>
        <ConfirmModal
          open={fakeModalOpen}
          title="Marquer comme fausse commande"
          onClose={closeFakeOrderModal}
          onConfirm={markAsFakeOrder}
          confirmText="Confirmer"
          cancelText="Annuler"
          loading={isProcessing}
        >
          <p className="workModal__text">
            Cette action notifiera le client et incrémentera son compteur de fausses commandes.
          </p>
          <div className="workModal__field">
            <label htmlFor="fake-order-message">Message envoyé au client</label>
            <textarea
              id="fake-order-message"
              value={fakeOrderMessage}
              onChange={(event) => {
                setFakeOrderMessage(event.target.value);
                if (fakeModalError) setFakeModalError("");
              }}
              rows={5}
              disabled={isProcessing}
            />
          </div>
          {fakeModalError ? (
            <p className="workModal__error">{fakeModalError}</p>
          ) : null}
        </ConfirmModal>
        <ConfirmModal
          open={driverModalOpen}
          title="Attribuer un livreur (Conakry)"
          onClose={closeDriverModal}
          onConfirm={confirmDriverAssignmentAndValidate}
          confirmText="Valider la commande"
          cancelText="Annuler"
          loading={isProcessing}
          confirmButtonClassName="confirmModal__button--strongConfirm"
          cancelButtonClassName="confirmModal__button--strongCancel"
        >
          <div className="driverAssignModal">
            <p className="driverAssignModal__intro">
              Cette adresse appartient à une zone de Conakry. Veuillez choisir un livreur actif.
            </p>
            <div className="driverAssignModal__box">
              <div className="workModal__field">
                <label htmlFor="assign-driver-select">Livreur</label>
                <select
                  id="assign-driver-select"
                  value={selectedDriverUid}
                  onChange={(event) => {
                    setSelectedDriverUid(event.target.value);
                    if (driverModalError) setDriverModalError("");
                  }}
                  disabled={isProcessing}
                >
                  {activeDrivers.map((driver) => (
                    <option key={driver.uid} value={driver.uid}>
                      {driver.username}
                    </option>
                  ))}
                </select>
              </div>
              <p className="driverAssignModal__hint">
                {activeDrivers.length} livreur(s) actif(s) disponible(s)
              </p>
            </div>
          </div>
          {driverModalError ? (
            <p className="workModal__error">{driverModalError}</p>
          ) : null}
        </ConfirmModal>
        {previewImage && (
          <div
            className="orderImagePreview"
            role="dialog"
            aria-modal="true"
            aria-label={`Image de ${previewImage.title}`}
            onClick={() => setPreviewImage(null)}
          >
            <div
              className="orderImagePreview__content"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="orderImagePreview__close"
                onClick={() => setPreviewImage(null)}
                aria-label="Fermer l’image"
              >
                ×
              </button>
              <img src={previewImage.src} alt={previewImage.title} />
              <p>{previewImage.title}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DetailsOrder;
