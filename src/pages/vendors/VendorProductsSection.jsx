// Tableau des produits d'un vendeur (statuts vendeur/admin, prix, stock,
// actions bloquer/reactiver). Extrait de VendorDetails.jsx.
import { Link } from "react-router-dom";
import {
  formatDateTime,
  getProductLabel,
  toStatusFlag,
} from "./vendorDetailsHelpers";

const VendorProductsSection = ({
  productsLoading,
  productsError,
  canModerateProducts,
  products,
  actionBusy,
  openDialog,
}) => {
  return (
    <section>
      <h2>Produits du vendeur</h2>
      <div className="vendorDetails__card vendorDetails__products">
        {productsLoading ? (
          <p>Chargement des produits...</p>
        ) : productsError ? (
          <p className="vendorDetails__productsMessage vendorDetails__productsMessage--error">
            {productsError}
          </p>
        ) : !canModerateProducts ? (
          <p className="vendorDetails__productsMessage">
            Aucun identifiant vendeur n'a ete trouve pour rattacher des produits.
          </p>
        ) : products.length === 0 ? (
          <p className="vendorDetails__productsMessage">
            Aucun produit associé à ce vendeur pour le moment.
          </p>
        ) : (
          <div className="vendorDetails__productsTableWrapper">
            <table className="vendorDetails__productsTable">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Statut</th>
                  <th>Prix</th>
                  <th>Stock</th>
                  <th>Dernière mise à jour</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const productLabel = getProductLabel(product);
                  // vm_status est le champ reellement ecrit par le vendeur
                  // (meme source que la page detail produit) ; blocked/status/
                  // active/isActive sont des champs legacy non maintenus par
                  // cette app et peuvent diverger de vm_status.
                  const vendorStatusFlag = toStatusFlag(
                    product?.vm_status ??
                      product?.core?.vm_status ??
                      product?.draft?.core?.vm_status
                  );
                  const vendorStatusLabel = vendorStatusFlag
                    ? "Actif vendeur"
                    : "Inactif vendeur";
                  const vendorStatusClass = vendorStatusFlag
                    ? "vendorDetails__statusChip--active"
                    : "vendorDetails__statusChip--blocked";
                  const adminStatusFlag = toStatusFlag(
                    product?.mm_status ??
                      product?.core?.mm_status ??
                      product?.draft?.core?.mm_status
                  );
                  const adminStatusLabel = adminStatusFlag
                    ? "Actif admin"
                    : "Inactif admin";
                  const adminStatusClass = adminStatusFlag
                    ? "vendorDetails__statusChip--active"
                    : "vendorDetails__statusChip--blocked";
                  // Le bouton Bloquer/Activer de cette table ne touche que
                  // mm_status (cf. blockProductsForVendor/
                  // reactivateProductsForVendor) : son affichage doit donc
                  // suivre adminStatusFlag, pas le statut vendeur.
                  const isProductBlocked = !adminStatusFlag;
                  const blockedReason =
                    product?.blockedReason ??
                    product?.core?.blockedReason ??
                    product?.draft?.core?.blockedReason ??
                    null;
                  const priceValue =
                    product?.price ??
                    product?.pricing?.basePrice ??
                    product?.core?.pricing?.basePrice ??
                    product?.draft?.core?.pricing?.basePrice;
                  const currencyValue =
                    product?.pricing?.currency ??
                    product?.core?.pricing?.currency ??
                    product?.draft?.core?.pricing?.currency ??
                    "";
                  const priceDisplay =
                    priceValue === undefined || priceValue === null
                      ? "-"
                      : `${priceValue}${currencyValue ? ` ${currencyValue}` : ""}`;
                  const stockValue =
                    product?.stock ??
                    product?.inventory?.stock ??
                    product?.core?.inventory?.stock ??
                    product?.draft?.core?.inventory?.stock ??
                    "-";
                  const lastUpdated =
                    product?.updatedAt ??
                    product?.core?.updatedAt ??
                    product?.draft?.core?.updatedAt ??
                    product?.timeStamp ??
                    product?.createdAt ??
                    product?.created_at ??
                    product?.draft?.updatedAt;
                  return (
                    <tr
                      key={product.id}
                      className={
                        isProductBlocked
                          ? "vendorDetails__productRow vendorDetails__productRow--blocked"
                          : "vendorDetails__productRow"
                      }
                    >
                      <td>
                        <div className="vendorDetails__productMain">
                          <span className="vendorDetails__productName">
                            {productLabel || "Produit"}
                          </span>
                          {product?.product_id && (
                            <span className="vendorDetails__productMeta">
                              #{product.product_id}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="vendorDetails__statusColumn">
                          <span
                            className={`vendorDetails__statusChip ${vendorStatusClass}`}
                          >
                            {vendorStatusLabel}
                          </span>
                          <span
                            className={`vendorDetails__statusChip ${adminStatusClass}`}
                          >
                            {adminStatusLabel}
                          </span>
                        </div>
                        {blockedReason && (
                          <span className="vendorDetails__productReason">
                            {blockedReason}
                          </span>
                        )}
                      </td>
                      <td>{priceDisplay}</td>
                      <td>{stockValue}</td>
                      <td>{formatDateTime(lastUpdated)}</td>
                      <td>
                        <div className="vendorDetails__productActions">
                          <Link
                            to={`/VendorProductsList/${product.id}`}
                            className="vendorDetails__tableButton vendorDetails__tableButton--link"
                          >
                            Voir
                          </Link>
                          {isProductBlocked ? (
                            <button
                              type="button"
                              className="vendorDetails__tableButton vendorDetails__tableButton--success"
                              disabled={actionBusy}
                              onClick={() =>
                                openDialog({
                                  type: "reactivateProduct",
                                  product,
                                })
                              }
                            >
                              Activer
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="vendorDetails__tableButton vendorDetails__tableButton--danger"
                              disabled={actionBusy}
                              onClick={() =>
                                openDialog({ type: "blockProduct", product })
                              }
                            >
                              Bloquer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export default VendorProductsSection;
