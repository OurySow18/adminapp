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
import {AuthContext} from "./context/AuthContext"

function App() {
  const { darkMode } = useContext(DarkModeContext);
  const {currentUser} = useContext(AuthContext);
  const titleUser = "Add new User";
  const titleProduct = "Add new Product";

  const RequireAuth = ({ children }) => {
    return currentUser ? (children) : <Navigate to="/login" />;
  };

  return (
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
                path=":userId"
                element={
                  <RequireAuth>
                    <Single />
                  </RequireAuth>
                }
              />
              <Route
                path="new"
                element={
                  <RequireAuth>
                    <New inputs={userInputs} title={titleUser} typeCmp="user" />
                  </RequireAuth>
                }
              />
            </Route>
            <Route path="products">
              <Route index element={<List typeColumns={productColumns} title="product" />} />
              <Route
                path=":productId"
                element={
                  <RequireAuth>
                    <Single />
                  </RequireAuth>
                }
              />
              <Route
                path="new"
                element={
                  <RequireAuth>
                    <New inputs={productInputs} title={titleProduct} typeCmp="product" />
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
