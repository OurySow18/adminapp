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
import Single from "./pages/single/Single";
import New from "./pages/new/New";
import Order from "./pages/Order/Order";
import Delivery from "./pages/Delivery/Delivery";
import "./style/dark.scss";
import { useContext } from "react";
import { DarkModeContext } from "./context/darkModeContext";
import { productInputs, userInputs } from "./formSource";
import {userColumns, productColumns} from "./datatablesource";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"; 
import {auth} from "./firebase"
import Details from "./pages/productDetails/Details";

function App() { 
  const { darkMode } = useContext(DarkModeContext); 
  const titleUser = "Add new User";
  const titleProduct = "Add new Product";

  //prüft, ob der User eigeloggtist. Wenn nein bleibt man auf der login Seite
  const RequireAuth = ({ children }) => {
    return auth.currentUser?.email ? (children) : <Navigate to="/login" />;
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
            } />
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
                    <Single  title="users"/>
                  </RequireAuth>
                }
              />
              <Route
                path="new"
                element={
                  <RequireAuth>
                    <New inputs={userInputs} title={titleUser} typeCmp="users" />
                  </RequireAuth>
                }
              />
            </Route>
            <Route path="products">
              <Route index element={<List typeColumns={productColumns} title="products" />} />
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
                    <New inputs={productInputs} title={titleProduct} typeCmp="products" />
                  </RequireAuth>
                }
              />
            </Route>
            <Route
            path="orders"
            element={
              <RequireAuth>
                <Order />
              </RequireAuth>
            }
              >

            </Route>
            <Route
            path="delivery"
            element={
              <RequireAuth>
                <Delivery />
              </RequireAuth>
            }
              >

            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
