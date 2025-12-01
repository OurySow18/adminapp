/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 *
 * Zeigt die Details des ausgewählten User
 */
import "./Zone.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { db } from "../../firebase";
import {
  updateDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";

const Zone = ({ title }) => {
  const [data, setData] = useState([]);
  const navigate = useNavigate();

  //bekommt die Daten durch die Navigationsparameters
  const params = useParams();
  console.log("Parametre: ", params.id);
  //ruft die Details eines Produktes von Firestore ab
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, title, params.id),
      (doc) => {
        setData(doc.data());
      },
      (error) => {
        console.log(error);
      }
    );
    return () => {
      unsub();
    };
  }, [params.id, title]);

  // Update Zones details in Firestore
  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const zoneRef = doc(db, title, params.id);
      await updateDoc(zoneRef, {
        ...data, 
      });
      navigate("/zones");
    } catch (err) {
      console.log(err);
    }
  };

  const handleInput = (e) => {
    const { id, value } = e.target;
    setData({ ...data, [id]: value });
  };

  console.log("Data: ", data);
  return (
    <div className="Zone">
      <Sidebar />
      <div className="detailsContainer">
        <Navbar />
        <div className="top">
          <h1>Update Zones</h1>
          <Link to="/products/new" className="link">
            Add new
          </Link>
        </div>
        <div className="bottom">
          <div className="right">
            <form onSubmit={handleUpdate}>
              <div className="formInput">
                <label>Id</label>
                <input
                  id="zone_id"
                  type="text"
                  placeholder="Product Id"
                  value={data.zone_id || ""}
                  onChange={handleInput}
                  disabled
                />
              </div>

              <div className="formInput">
                <label>Nom de Zone</label>
                <input
                  id="zoneName"
                  type="text"
                  placeholder="Zone name"
                  value={data.nameZone || ""}
                  onChange={handleInput}
                  disabled
                />
              </div>

              <div className="formInput">
                <label>Creation</label>
                <input
                  id="createdAt"
                  type="text"
                  placeholder="Creer le"
                  value={data.createdAt || ""}
                  onChange={handleInput}
                  disabled
                />
              </div>

              <div className="formInput">
                <label>Derniere Modification</label>
                <input
                  id="updatedAt"
                  type="text"
                  placeholder="Derniere modification"
                  value={data.updatedAt || ""}
                  onChange={handleInput}
                  disabled
                />
              </div>
              <div className="formInput">
                <label>Prix Minimum</label>
                <input
                  id="priceZoneMinimum"
                  type="text"
                  placeholder="Prix Minimum"
                  value={data.priceZoneMinimum || ""}
                  onChange={handleInput}
                />
              </div>
              <div className="formInput">
                <label>Prix Maximum</label>
                <input
                  id="priceZoneMaximum"
                  type="text"
                  placeholder="Prix Maximum"
                  value={data.priceZoneMaximum || ""}
                  onChange={handleInput}
                />
              </div>

              <div className="formInput">
                <label>Zones</label>
                <input
                  id="stock"
                  type="text"
                  placeholder="Product stock"
                  value={data.stock || ""}
                  onChange={handleInput}
                />
              </div>

              <div className="formButtons">
                <button type="button" onClick={() => navigate("/zones")}>Back</button>
                <button type="submit" >Update</button>
              </div>
              
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Zone;
