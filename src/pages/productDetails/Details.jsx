/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 *
 * Zeigt Produktdetails an und ermöglicht die Aktualisierung
 */
import "./details.scss";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { useNavigate, useParams } from "react-router-dom";

import { db, storage } from "../../firebase";
import {
  updateDoc,
  doc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const categorieProduct = [
  "AUCUN",
  "ENFANT",
  "BEURE",
  "EAUX",
  "FOSCAO",
  "HUILE",
  "LAIT",
  "MAYONNAISE",
  "NESCAFE",
  "OIGNON",
  "POMMEDETERRE",
  "RIZ",
  "SAVON",
  "SUCCRE",
  "TOMATE",
  "THE",
  "PATTE",
  "HARICOTS",
  "JUS",
  "BISCUITS",
  "COUSCOUS",
  "HAMZA",
  "CHOCOLAT",
  "BONBON", 
  "COTON",
  "CHIPS",
  "CORN FLAKES",
  "INSECTICIDE"
];
//Array für die Product Type
const categorieType = ['BREAKFAST', 'DEJEUNER','CEREMONIE', 'ENFANTS', 'FEMMES'];
const contentType = ['AUCUN', 'CARTON','SAC'];

const Details = ({ title }) => {
  const [file, setFile] = useState(null);
  const [data, setData] = useState({});
  const [isChecked, setIsChecked] = useState(false);
  const [isActiv, setIsActiv] = useState(false);
  const [perc, setPerc] = useState(null); 
  const navigate = useNavigate();
  const params = useParams();

 // Fetch product details from Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, title, params.id),
      (doc) => {
        setData(doc.data());
        setIsChecked(doc.data().status);
        setIsActiv(doc.data().homePage);
      },
      (error) => {
        console.log(error);
      }
    );
    return () => {
      unsub();
    };
  }, [params.id, title]);

  // Handle file upload to Firebase Storage
  useEffect(() => {
    const uploadFile = () => {
      const name = new Date().getTime() + file.name;
      const storageRef = ref(storage, name);

      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setPerc(progress);
        },
        (error) => {
          console.log(error);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            setData((prev) => ({ ...prev, img: downloadURL }));
          });
        }
      );
    };
    if (file) uploadFile();
  }, [file]);
  // Handle form inputs
  const handleInput = (e) => {
    const { id, value } = e.target;
    setData({ ...data, [id]: value });
  };

  const handleChangeCategory = (e) => {
    setData({ ...data, category: e.target.value });
  };

  const handleChangeType = (e) => {
    setData({ ...data, type: e.target.value });
  };
  
  const handleChangeContent = (e) => {
    setData({ ...data, content: e.target.value });
  };

  const checkHandler = () => {
    setIsChecked(!isChecked);
    setData({ ...data, status: !isChecked });
  };

  const checkActivHandler = () => {
    setIsActiv(!isActiv);
    setData({ ...data, homePage: !isActiv });
  };

  // Update product details in Firestore
  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const productRef = doc(db, title, params.id);
      await updateDoc(productRef, {
        ...data,
        timeStamp: serverTimestamp(),
      });
      navigate("/products");
    } catch (err) {
      console.log(err);
    }
  };
 
  return (
        <div className="details">
      <Sidebar />
      <div className="detailsContainer">
        <Navbar />
        <div className="top">
          <h1>Update Product</h1>
          <Link to="/products/new" className="link">Add new</Link>
        </div>
        <div className="bottom">
          <div className="left">
            <img src={data.img || "/default-image.png"} alt="Product" className="image" />
          </div>
          <div className="right">
            <form onSubmit={handleUpdate}>
              <div className="formInput">
                <label htmlFor="file">
                  Image <DriveFolderUploadOutlinedIcon className="icon" />
                </label>
                <input
                  type="file"
                  id="file"
                  onChange={(e) => setFile(e.target.files[0])}
                  style={{ display: "none" }}
                />
              </div>

              <div className="formInput">
                <label>Category Product</label>
                <select
                  id="category"
                  onChange={handleChangeCategory}
                  value={data.category || ""}
                >
                  {categorieProduct.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
                  
              <div className="formInput">
                <label>Category Type</label>
                <select
                  id="type"
                  onChange={handleChangeType}
                  value={data.type || ""}
                >
                  {categorieType.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              <div className="formInput">
                <label>Type de contenant</label>
                <select
                  id="content"
                  onChange={handleChangeContent}
                  value={data.content || ""}
                >
                  {contentType.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              <div className="formInput">
                <label>Id</label>
                <input
                  id="product_id"
                  type="text"
                  placeholder="Product Id"
                  value={data.product_id || ""}
                  onChange={handleInput}
                  //disabled
                />
              </div>

              <div className="formInput">
                <label>Name</label>
                <input
                  id="name"
                  type="text"
                  placeholder="Product name"
                  value={data.name || ""}
                  onChange={handleInput}
                />
              </div>

              <div className="formInput">
                <label>Poids</label>
                <input
                  id="poids"
                  type="text"
                  placeholder="Product poids"
                  value={data.poids || ""}
                  onChange={handleInput}
                />
              </div>

              <div className="formInput">
                <label>Prix en gros</label>
                <input
                  id="price"
                  type="text"
                  placeholder="Product price"
                  value={data.price || ""}
                  onChange={handleInput}
                />
              </div>
              <div className="formInput">
                <label>Prix en detail</label>
                <input
                  id="priceInDetail"
                  type="text"
                  placeholder="Product price in detail"
                  value={data.priceInDetail || ""}
                  onChange={handleInput}
                />
              </div>

              <div className="formInput">
                <label>Stock</label>
                <input
                  id="stock"
                  type="text"
                  placeholder="Product stock"
                  value={data.stock || ""}
                  onChange={handleInput}
                />
              </div>

              <div className="formInput">
                <input
                  type="checkbox"
                  id="status"
                  checked={isChecked}
                  onChange={checkHandler}
                />
                {isChecked ? "Active" : "Inactive"}
              </div>

              <div className="formInput">
                <input
                  type="checkbox"
                  id="homePage"
                  checked={isActiv}
                  onChange={checkActivHandler}
                />
                {isActiv ? "Trend" : "Normal"}
              </div>

              <div className="formInput description">
                <label>Description</label>
                <textarea
                  id="description"
                  rows={6}
                  placeholder="Product description"
                  value={data.description || ""}
                  onChange={handleInput}
                />
              </div>


              <div className="formButtons">
                <button type="button" onClick={() => navigate("/products")}>Back</button>
                <button type="submit" disabled={perc !== null && perc < 100}>Update</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};


export default Details;

export const Checkbox = (props) => {
  const [isChecked, setIsChecked] = useState();
  console.log(props);
  useEffect(() => {
    setIsChecked(props.status);
  }, [props.status]);

  const checkHandler = () => {
    setIsChecked(!isChecked);
  };

  return (
    <div>
      <input
        type="checkbox"
        id="checkbox"
        checked={isChecked}
        onChange={checkHandler}
      />
      {isChecked ? "checked" : "unchecked"}
    </div>
  );
};
