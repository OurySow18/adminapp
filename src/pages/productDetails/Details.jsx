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
  "BISCUITS",
  "COTON",
  "CHIPS",
  "CORN FLAKES"
];
//Array für die Product Type
const categorieType = ["ACTUEL", "BREAKFAST", "CEREMONIE", "ENFANTS"];

const Details = ({ title }) => {
  const [file, setFile] = useState("");
  const [data, setData] = useState({});
  const [activStatus, setActivStatus] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [isActiv, setIsActiv] = useState(false);
  const navigate = useNavigate();
  const [perc, setPerc] = useState(null);
  //bekommt die Daten durch die Navigationsparameters
  const params = useParams();

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
  }, []);

  //lädt das Bild ein
  useEffect(() => {
    const uploadFile = () => {
      const name = new Date().getTime() + file.name;
      const storageRef = ref(storage, name);

      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log("Upload is " + progress + "% done");
          setPerc(progress);
          switch (snapshot.state) {
            case "paused":
              console.log("Upload is paused");
              break;
            case "running":
              console.log("Upload is running");
              break;
            default:
              break;
          }
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
    file && uploadFile();
  }, [file]);

  useEffect(() => {
    setIsChecked(isChecked);
  }, [isChecked]);
  useEffect(() => {
    setIsChecked(isActiv);
  }, [isActiv]);

  //zurück zu den Produkten
  const onBack = () => {
    navigate("/products");
  };
  const handleInput = (e) => {
    const id = e.target.id;
    const value = e.target.value;

    setData({ ...data, [id]: value });
  };
  const handleChange = (e) => {
    setData({ ...data, category: e.target.value });
  };
  const handleChangeType = (e) => {
    setData({ ...data, type: e.target.value });
  };
  const checkHandler = () => {
    setIsChecked(!isChecked);
    setData({ ...data, status: isChecked });
  };
  const checkActivHandler = () => {
    setIsActiv(!isActiv);
    setData({ ...data, homePage: isActiv });
  };
  
  //aktualisiert die productsdaten
  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const productRef = doc(db, "products", params.id);

      await updateDoc(productRef, {
        ...data,
        timeStamp: serverTimestamp(),
      });
      navigate("/products");
    } catch (err) {
      console.log(err);
    } finally {
      console.log("We do cleanup here");
    }
  };


  return (
    <div className="details">
      <Sidebar />
      <div className="detailsContainer">
        <Navbar />
        <div className="top">
          <h1>Update Product</h1>
          <Link to={"/products/new"} className="link">
            Add new
          </Link>
        </div>
        <div className="bottom">
          <div className="left">
            <img src={data.img} alt="" className="image" />
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
                <label>
                  Category Product
                  <select
                    id="cat"
                    label="Product category"
                    onChange={handleChange}
                    value={data.category}
                    defaultValue={data.category}
                  >
                    {categorieProduct.map((item) => (
                      <option value={item}>{item}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="formInput">
                <label> ProductId </label>
                <input
                  id="product_id"
                  label="ProductId"
                  type="text"
                  placeholder="Product Id"
                  value={data.product_id}
                  onChange={handleInput}
                  disabled={true}
                />
              </div>

              <div className="formInput">
                <label> Name </label>
                <input
                  id="name"
                  label="Name"
                  type="text"
                  placeholder="Product name"
                  value={data.name}
                  onChange={handleInput}
                />
              </div>

              <div className="formInput">
                <label> Poids </label>
                <input
                  id="poids"
                  label="Poids"
                  type="text"
                  placeholder="Product poids"
                  value={data.poids}
                  onChange={handleInput}
                />
              </div>

              <div className="formInput">
                <label> Price </label>
                <input
                  id="price"
                  label="Price"
                  type="text"
                  placeholder="Product price"
                  value={data.price}
                  onChange={handleInput}
                />
              </div>

              <div className="formInput">
                <label> Stock </label>
                <input
                  id="stock"
                  label="Stock"
                  type="text"
                  placeholder="Product stock"
                  value={data.stock}
                  onChange={handleInput}
                />
              </div>
              <div className="formInput">
                <input
                  type="checkbox"
                  id="checkbox"
                  checked={data.status}
                  onChange={checkHandler}
                />
                {data.status ? "Activ" : "Inactiv"}
              </div>
              <div className="formInput">
                <input
                  type="checkbox"
                  id="checkbox"
                  checked={data.homePage}
                  onChange={checkActivHandler}
                />
                {data.homePage ? "Trend" : "Normal"}
              </div>
              {
                //<div className="formInput">
                //<Checkbox status={data.status} />
                // <input  value={activStatus} type='radio' text="Activ" onChange={handle_checkbox_Change} />
                //activStatus ? <CheckBox  />   :  <CheckBoxOutlineBlankIcon />}
                // {activStatus ? "Activ" : "Inactiv"
                //</div>
              }

              <div className="formInput">
                <label> Description </label>
                <textarea
                  id="description"
                  label="Description"
                  type="textarea"
                  rows={15}
                  cols={48}
                  placeholder="Product description"
                  value={data.description}
                  onChange={handleInput}
                />
              </div>
              <div className="formInput">
                <select
                  id="categorie"
                  label="categorieType"
                  onChange={handleChangeType}
                  value={data.type}
                  defaultValue={data.type}
                >
                  {categorieType.map((item) => (
                    <option value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <button onClick={onBack}>Back</button>
              <button disabled={perc !== null && perc < 100} type="submit">
                Update
              </button>
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
