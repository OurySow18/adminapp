/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 *
 * App Einstellung
 */
import Home from "./pages/home/Home";
import Login from "./pages/login/Login";
import List from "./pages/list/List";
import ListProducts from "./pages/listProducts/ListProducts";
import Single from "./pages/single/Single";
import New from "./pages/new/New";
import NewProduct from "./pages/newProduct/NewProduct";
import Order from "./pages/Order/Order";
import Delivery from "./pages/Delivery/Delivery";
import DetailsOrder from "./components/detailsOrder/DetailsOrder";
import "./style/dark.scss";
import { useContext } from "react";
import { DarkModeContext } from "./context/darkModeContext";
import { productInputs, userInputs, zonesInputs } from "./formSource";
import {
  userColumns,
  productColumns,
  orderColumns,
  zonesColumns,
  gameColumns,
} from "./datatablesource";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { auth } from "./firebase";
import Details from "./pages/productDetails/Details";
import GameDetails from "./pages/Game/GameDetails";
import GameList from "./pages/Game/GameList"; 
import DeliveredOrders from "./components/deliveredOrders/DeliveredOrdersInfos";
import DetailsDeliveryOrders from "./components/DetailsDeliveryOrders/DetailsDeliveryOrders";
import DetailsListDeliveredOrder from "./components/detailsListDeliveredOrder/DetailsListDeliveredOrders";
import Zone from "./pages/zones/Zone";
import GameStartScreen from "./components/game/GameStartScreen";

function App() {
  const { darkMode } = useContext(DarkModeContext);
  const titleUser = "Add new User";
  const titleProduct = "Add new Product";
  const titleZone = "Add new Zone";

  //prüft, ob der User eigeloggtist. Wenn nein bleibt man auf der login Seite
  const RequireAuth = ({ children }) => {
    return auth.currentUser?.email ? children : <Navigate to="/login" />;
  };

  return (
    //prüft, ob der Dark Modus akiviert ist
    <div className={darkMode ? "app dark " : "app"}>
      <BrowserRouter>
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

            {/*Products*/}
            <Route path="products">
              <Route
                index
                // element={<ListProducts typeColumns={productColumns} title="products" />}
                element={<List typeColumns={productColumns} title="products" />}
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
                element={<List typeColumns={zonesColumns} title="zones" />}
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

            {/*Orders*/}
            <Route path="orders">
              <Route
                index
                element={
                  <RequireAuth>
                    <Order typeColumns={orderColumns} title="orders" />
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
                    <DetailsDeliveryOrders
                      title="orders"
                      btnValidation="Archiver la Livraison"
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
                    <DetailsListDeliveredOrder
                      title="archivedOrders"
                      btnValidation="Imprimer la commande"
                    />
                  </RequireAuth>
                }
              />
            </Route>
            <Route path="game">
              <Route
                index
                element={
                  <RequireAuth>
                    <GameStartScreen typeColumns={gameColumns}/>
                  </RequireAuth>
                }
              />
              <Route
                path=":code"
                element={
                  <RequireAuth>
                    <GameDetails />
                  </RequireAuth>
                }
              />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
