/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 *
 * App Einstellung
 */
import { lazy, Suspense, useContext } from "react";
import "./style/dark.scss";
import { DarkModeContext } from "./context/darkModeContext";
import { AuthContext } from "./context/AuthContext";
import { productInputs, userInputs, zonesInputs } from "./formSource";
import {
  userColumns,
  adminColumns,
  driverColumns,
  productColumns,
  orderColumns,
  zonesColumns,
} from "./datatablesource";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider } from "./context/sidebarContext";
import { useIdleLogout } from "./hooks/useIdleLogout";
import IdleLogoutWarning from "./components/idleLogout/IdleLogoutWarning";

// Chaque page est chargee a la demande (code-splitting par route) plutot que
// regroupee dans un seul bundle : l'admin ne telecharge que le code des
// pages qu'il visite reellement au lieu de tout charger au premier lancement.
const Home = lazy(() => import("./pages/home/Home"));
const Login = lazy(() => import("./pages/login/Login"));
const List = lazy(() => import("./pages/list/List"));
const Single = lazy(() => import("./pages/single/Single"));
const New = lazy(() => import("./pages/new/New"));
const NewProduct = lazy(() => import("./pages/newProduct/NewProduct"));
const Order = lazy(() => import("./pages/Order/Order"));
const Delivery = lazy(() => import("./pages/Delivery/Delivery"));
const DetailsOrder = lazy(() => import("./components/detailsOrder/DetailsOrder"));
const Details = lazy(() => import("./pages/productDetails/Details"));
const DeliveredOrders = lazy(() =>
  import("./components/deliveredOrders/DeliveredOrdersInfos")
);
const Zone = lazy(() => import("./pages/zones/Zone"));
const VendorsList = lazy(() => import("./pages/vendors/VendorsList"));
const VendorDetails = lazy(() => import("./pages/vendors/VendorDetails"));
const VendorProductsList = lazy(() =>
  import("./pages/vendorProducts/VendorProductsList")
);
const VendorProductDetails = lazy(() =>
  import("./pages/vendorProducts/VendorProductDetails")
);
const PublicCatalogList = lazy(() => import("./pages/publicCatalog/PublicCatalogList"));
const MarketingOverview = lazy(() => import("./pages/marketing/MarketingOverview"));
const BannerList = lazy(() => import("./pages/marketing/BannerList"));
const BannerEditor = lazy(() => import("./pages/marketing/BannerEditor"));
const SponsorList = lazy(() => import("./pages/marketing/SponsorList"));
const SponsorEditor = lazy(() => import("./pages/marketing/SponsorEditor"));
const BestsellerList = lazy(() => import("./pages/marketing/BestsellerList"));
const BestsellerEditor = lazy(() => import("./pages/marketing/BestsellerEditor"));
const MarketingCategories = lazy(() => import("./pages/marketing/MarketingCategories"));
const MarketingCategoryCoverEditor = lazy(() =>
  import("./pages/marketing/MarketingCategoryCoverEditor")
);
const VendorPayoutsList = lazy(() => import("./pages/vendorPayouts/VendorPayoutsList"));
const VendorPayoutDetails = lazy(() =>
  import("./pages/vendorPayouts/VendorPayoutDetails")
);
const GuineaCitiesList = lazy(() => import("./pages/cities/GuineaCitiesList"));
const CityEditor = lazy(() => import("./pages/cities/CityEditor"));
const StatisticsOverview = lazy(() => import("./pages/statistics/StatisticsOverview"));
const StatisticsSales = lazy(() => import("./pages/statistics/StatisticsSales"));
const StatisticsVendors = lazy(() => import("./pages/statistics/StatisticsVendors"));
const StatisticsPayouts = lazy(() => import("./pages/statistics/StatisticsPayouts"));
const StatisticsCatalog = lazy(() => import("./pages/statistics/StatisticsCatalog"));
const ProductDeletionsList = lazy(() =>
  import("./pages/productDeletions/ProductDeletionsList")
);
const ImageOptimization = lazy(() => import("./pages/imageOptimization/ImageOptimization"));
const Notifications = lazy(() => import("./pages/notifications/Notifications"));

function App() {
  const { darkMode } = useContext(DarkModeContext);
  const titleUser = "Add new User";
  const titleProduct = "Add new Product";
  const titleZone = "Add new Zone";

  // Verifie que l'utilisateur est connecte ET que son statut admin a ete
  // confirme cote Firestore (admin/{uid} ou super-admin), pas seulement
  // qu'une session Firebase Auth existe.
  const { authChecked, isAdmin } = useContext(AuthContext);
  const RequireAuth = ({ children }) => {
    if (!authChecked) return null;
    return isAdmin ? children : <Navigate to="/login" />;
  };

  // Deconnexion automatique apres 30 minutes d'inactivite (avec
  // avertissement 1 minute avant), active uniquement pour une session
  // admin confirmee.
  const { showWarning, remainingSeconds, stayLoggedIn, logoutNow } = useIdleLogout(isAdmin);

  return (
    //prüft, ob der Dark Modus akiviert ist
    <div className={darkMode ? "app dark " : "app"}>
      <SidebarProvider>
        <BrowserRouter>
          <Suspense fallback={null}>
          <Routes>
          <Route path="/">
            <Route path="login" element={<Login />} />
            <Route
              index
              element={
                <RequireAuth>
                  <Home />
                </RequireAuth>
              }
            />
            {/*User*/}
            <Route path="users">
              <Route
                index
                element={
                  <RequireAuth>
                    <List typeColumns={userColumns} title="users" />
                  </RequireAuth>
                }
              />
              <Route
                path=":id"
                element={
                  <RequireAuth>
                    <Single title="users" />
                  </RequireAuth>
                }
              />
              <Route
                path="new"
                element={
                  <RequireAuth>
                    <New
                      inputs={userInputs}
                      title={titleUser}
                      typeCmp="users"
                    />
                  </RequireAuth>
                }
              />
            </Route>

            {/*Admins*/}
            <Route path="admins">
              <Route
                index
                element={
                  <RequireAuth>
                    <List
                      typeColumns={adminColumns}
                      title="admin"
                      pageTitle="administrateurs"
                      disableCreate
                    />
                  </RequireAuth>
                }
              />
              <Route
                path=":id"
                element={
                  <RequireAuth>
                    <Single title="admin" />
                  </RequireAuth>
                }
              />
            </Route>

            {/*Drivers*/}
            <Route path="drivers">
              <Route
                index
                element={
                  <RequireAuth>
                    <List
                      typeColumns={driverColumns}
                      title="drivers"
                      pageTitle="livreurs"
                      disableCreate
                    />
                  </RequireAuth>
                }
              />
              <Route
                path=":id"
                element={
                  <RequireAuth>
                    <Single title="drivers" />
                  </RequireAuth>
                }
              />
            </Route>

            {/*Vendors*/}
            <Route path="vendors">
              <Route
                index
                element={
                  <RequireAuth>
                    <VendorsList />
                  </RequireAuth>
                }
              />
              <Route
                path="status/:statusId"
                element={
                  <RequireAuth>
                    <VendorsList />
                  </RequireAuth>
                }
              />
              <Route
                path="status/:statusId/:id"
                element={
                  <RequireAuth>
                    <VendorDetails />
                  </RequireAuth>
                }
              />
              <Route
                path=":id"
                element={
                  <RequireAuth>
                    <VendorDetails />
                  </RequireAuth>
                }
              />
            </Route>

            {/*Vendor Products*/}
            <Route
              path="product-deletions"
              element={
                <RequireAuth>
                  <ProductDeletionsList />
                </RequireAuth>
              }
            />
            <Route
              path="image-optimization"
              element={
                <RequireAuth>
                  <ImageOptimization />
                </RequireAuth>
              }
            />
            <Route
              path="notifications"
              element={
                <RequireAuth>
                  <Notifications />
                </RequireAuth>
              }
            />
            <Route path="vendor-products">
              <Route
                index
                element={
                  <RequireAuth>
                    <VendorProductsList scope="vendors" />
                  </RequireAuth>
                }
              />
              <Route
                path="status/:statusId"
                element={
                  <RequireAuth>
                    <VendorProductsList scope="vendors" />
                  </RequireAuth>
                }
              />
              <Route
                path=":productId"
                element={
                  <RequireAuth>
                    <VendorProductDetails />
                  </RequireAuth>
                }
              />
              <Route
                path=":vendorId/:productId"
                element={
                  <RequireAuth>
                    <VendorProductDetails />
                  </RequireAuth>
                }
              />
            </Route>

            {/*Monmarche products*/}
            <Route path="monmarche-products">
              <Route
                index
                element={
                  <RequireAuth>
                    <VendorProductsList scope="monmarche" />
                  </RequireAuth>
                }
              />
            </Route>

            {/*Public catalog*/}
            <Route
              path="catalogue-public"
              element={
                <RequireAuth>
                  <PublicCatalogList />
                </RequireAuth>
              }
            />
            <Route
              path="catalogue-public/:vendorId/:productId"
              element={
                <RequireAuth>
                  <VendorProductDetails />
                </RequireAuth>
              }
            />
            <Route
              path="admin/marketing"
              element={
                <RequireAuth>
                  <MarketingOverview />
                </RequireAuth>
              }
            />
            <Route
              path="admin/marketing/banners"
              element={
                <RequireAuth>
                  <BannerList />
                </RequireAuth>
              }
            />
            <Route
              path="admin/marketing/banners/new"
              element={
                <RequireAuth>
                  <BannerEditor />
                </RequireAuth>
              }
            />
            <Route
              path="admin/marketing/banners/:bannerId"
              element={
                <RequireAuth>
                  <BannerEditor />
                </RequireAuth>
              }
            />
            <Route
              path="admin/marketing/bestsellers"
              element={
                <RequireAuth>
                  <BestsellerList />
                </RequireAuth>
              }
            />
            <Route
              path="admin/marketing/bestsellers/new"
              element={
                <RequireAuth>
                  <BestsellerEditor />
                </RequireAuth>
              }
            />
            <Route
              path="admin/marketing/bestsellers/:bestsellerId"
              element={
                <RequireAuth>
                  <BestsellerEditor />
                </RequireAuth>
              }
            />
            <Route
              path="admin/marketing/sponsors"
              element={
                <RequireAuth>
                  <SponsorList />
                </RequireAuth>
              }
            />
            <Route
              path="admin/marketing/sponsors/new"
              element={
                <RequireAuth>
                  <SponsorEditor />
                </RequireAuth>
              }
            />
            <Route
              path="admin/marketing/sponsors/:sponsorId"
              element={
                <RequireAuth>
                  <SponsorEditor />
                </RequireAuth>
              }
            />
            <Route
              path="admin/marketing/categories"
              element={
                <RequireAuth>
                  <MarketingCategories />
                </RequireAuth>
              }
            />
            <Route
              path="admin/marketing/categories/:categoryId"
              element={
                <RequireAuth>
                  <MarketingCategoryCoverEditor />
                </RequireAuth>
              }
            />
            <Route path="VendorProductsList">
              <Route
                path=":productId"
                element={
                  <RequireAuth>
                    <VendorProductDetails />
                  </RequireAuth>
                }
              />
              <Route
                path=":vendorId/:productId"
                element={
                  <RequireAuth>
                    <VendorProductDetails />
                  </RequireAuth>
                }
              />
            </Route>

            {/*Products*/}
            <Route path="products">
              <Route
                index
                element={
                  <RequireAuth>
                    <List typeColumns={productColumns} title="products" />
                  </RequireAuth>
                }
              />
              <Route
                path=":id"
                element={
                  <RequireAuth>
                    <Details inputs={productInputs} title="products" />
                  </RequireAuth>
                }
              />
              <Route
                path="new"
                element={
                  <RequireAuth>
                    <NewProduct inputs={productInputs} title={titleProduct} />
                  </RequireAuth>
                }
              />
            </Route>

            {/*Zones*/}
            <Route path="zones">
              <Route
                index
                element={
                  <RequireAuth>
                    <List typeColumns={zonesColumns} title="zones" />
                  </RequireAuth>
                }
              />
              <Route
                path=":id"
                element={
                  <RequireAuth>
                    <Zone inputs={zonesInputs} title="zones" />
                  </RequireAuth>
                }
              />
              <Route
                path="new"
                element={
                  <RequireAuth>
                    <New
                      inputs={zonesInputs}
                      title={titleZone}
                      typeCmp="zones"
                    />
                  </RequireAuth>
                }
              />
            </Route>

            {/*Cities*/}
            <Route
              path="cities"
              element={
                <RequireAuth>
                  <GuineaCitiesList />
                </RequireAuth>
              }
            />
            <Route
              path="cities/:id"
              element={
                <RequireAuth>
                  <CityEditor />
                </RequireAuth>
              }
            />

            {/*Orders*/}
            <Route path="orders">
              <Route
                index
                element={
                  <RequireAuth>
                    <Order
                      typeColumns={orderColumns}
                      title="orders"
                      listTitle="Commandes"
                      showFakeOrders={false}
                    />
                  </RequireAuth>
                }
              />
              <Route
                path=":id"
                element={
                  <RequireAuth>
                    <DetailsOrder
                      title="orders"
                      btnValidation="Valider la Commande"
                    />
                  </RequireAuth>
                }
              />
            </Route>

            {/*Fake Orders*/}
            <Route path="fake-orders">
              <Route
                index
                element={
                  <RequireAuth>
                    <Order
                      typeColumns={orderColumns}
                      title="orders"
                      listTitle="Fausses commandes"
                      showFakeOrders
                    />
                  </RequireAuth>
                }
              />
              <Route
                path=":id"
                element={
                  <RequireAuth>
                    <DetailsOrder
                      title="orders"
                      btnValidation="Valider la Commande"
                    />
                  </RequireAuth>
                }
              />
            </Route>

            {/*Delivery*/}
            <Route path="delivery">
              <Route
                index
                element={
                  <RequireAuth>
                    <Delivery typeColumns={orderColumns} title="orders" />
                  </RequireAuth>
                }
              />
              <Route
                path=":id"
                element={
                  <RequireAuth>
                    <DetailsOrder
                      title="orders"
                      btnValidation="Archiver la Livraison"
                      mode="delivery"
                    />
                  </RequireAuth>
                }
              />
            </Route>

            {/*Delivery Orders*/}
            <Route path="delivredOrders">
              <Route
                index
                element={
                  <RequireAuth>
                    <DeliveredOrders
                      typeColumns={orderColumns}
                      title="delivredOrders"
                    />
                  </RequireAuth>
                }
              />
              <Route
                path=":id"
                element={
                  <RequireAuth>
                    <DetailsOrder
                      title="archivedOrders"
                      btnValidation="Imprimer la commande"
                      mode="archived"
                    />
                  </RequireAuth>
                }
              />
            </Route>

            {/*Vendor Payouts*/}
            <Route path="vendor-payouts">
              <Route
                index
                element={
                  <RequireAuth>
                    <VendorPayoutsList />
                  </RequireAuth>
                }
              />
              <Route
                path=":vendorId"
                element={
                  <RequireAuth>
                    <VendorPayoutDetails />
                  </RequireAuth>
                }
              />
            </Route>

            {/*Statistics*/}
            <Route
              path="stats"
              element={
                <RequireAuth>
                  <StatisticsOverview />
                </RequireAuth>
              }
            />
            <Route
              path="stats/sales"
              element={
                <RequireAuth>
                  <StatisticsSales />
                </RequireAuth>
              }
            />
            <Route
              path="stats/vendors"
              element={
                <RequireAuth>
                  <StatisticsVendors />
                </RequireAuth>
              }
            />
            <Route
              path="stats/catalog"
              element={
                <RequireAuth>
                  <StatisticsCatalog />
                </RequireAuth>
              }
            />
            <Route
              path="stats/payouts"
              element={
                <RequireAuth>
                  <StatisticsPayouts />
                </RequireAuth>
              }
            />
          </Route>
        </Routes>
        </Suspense>
      </BrowserRouter>
      </SidebarProvider>
      <IdleLogoutWarning
        open={showWarning}
        remainingSeconds={remainingSeconds}
        onStayLoggedIn={stayLoggedIn}
        onLogoutNow={logoutNow}
      />
    </div>
  );
}

export default App;
