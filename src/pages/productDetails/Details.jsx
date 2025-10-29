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
  "INSECTICIDE",
  "SAC à MAIN "
];
//Array für die Product Type
const categorieType = ['AUTRES','BREAKFAST', 'DEJEUNER','CEREMONIE', 'ENFANTS', 'FEMMES'];
const contentType = ['AUCUN', 'CARTON','SAC'];

const Details = ({ title }) => {
  const [file, setFile] = useState(null);
  const [data, setData] = useState({});
  const [isChecked, setIsChecked] = useState(false);
  const [isActiv, setIsActiv] = useState(false);
  const [perc, setPerc] = useState(null);   
  const [imageObjects, setImageObjects] = useState([]); // État pour stocker les objets d'image avec URL et référence
  const [mainImageIndex, setMainImageIndex] = useState(0); // État pour définir l'index de l'image principale

  const navigate = useNavigate();
  const params = useParams();

 // Fetch product details from Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, title, params.id),
      (docSnap) => {
        if (!docSnap.exists()) {
          setData({});
          setIsChecked(false);
          setIsActiv(false);
          setImageObjects([]);
          return;
        }

        const raw = docSnap.data() || {};
        const resolvedImg =
          raw.img ||
          raw.image ||
          (Array.isArray(raw.images) ? raw.images[0] : null) ||
          raw.media?.cover ||
          raw.core?.media?.cover ||
          raw.draft?.core?.media?.cover ||
          "";

        const resolvedImages =
          raw.images ||
          raw.media?.gallery ||
          raw.core?.media?.gallery ||
          raw.draft?.core?.media?.gallery ||
          [];

        const resolvedPrice =
          raw.price ??
          raw.pricing?.basePrice ??
          raw.core?.pricing?.basePrice ??
          raw.draft?.core?.pricing?.basePrice;

        const resolvedStock =
          raw.stock ??
          raw.inventory?.stock ??
          raw.core?.inventory?.stock ??
          raw.draft?.core?.inventory?.stock;

        const resolvedStatus =
          typeof raw.status === "boolean"
            ? raw.status
            : raw.status === "active" ||
              raw.core?.status === "active" ||
              raw.draft?.core?.status === "active";

        const resolvedHome =
          raw.homePage ??
          raw.core?.homePage ??
          raw.draft?.core?.homePage ??
          false;

        setData({
          ...raw,
          img: resolvedImg,
          price: resolvedPrice,
          stock: resolvedStock,
          status: resolvedStatus,
          homePage: resolvedHome,
          images: resolvedImages,
        });
        setIsChecked(Boolean(resolvedStatus));
        setIsActiv(Boolean(resolvedHome));
        const mappedImages = Array.isArray(resolvedImages)
          ? resolvedImages.map((url) =>
              typeof url === "string" ? { url, ref: null } : url
            )
          : [];
        setImageObjects(mappedImages);
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

  const handleImageDelete = async (index) => {
    // Fonction de suppression d'une image du produit
    try {
      const target = imageObjects[index];
      if (target?.ref) {
        const imageRef = ref(storage, target.ref);
        //await deleteObject(imageRef);
      }
      const updatedImages = [...imageObjects];
      updatedImages.splice(index, 1);
      setImageObjects(updatedImages);
      setData((prev) => ({
        ...prev,
        images: updatedImages,
      }));
    } catch (error) {
      console.error("Error deleting image: ", error);
    }
  };

  const setMainImage = (index) => {
    // Fonction pour définir l'image principale
    setMainImageIndex(index);
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
            <img
              src={
                data.img ||
                data.image ||
                (Array.isArray(data.images) ? data.images[0] : null) ||
                data.media?.cover ||
                data.core?.media?.cover ||
                data.draft?.core?.media?.cover ||
                "/default-image.png"
              }
              alt="Product"
              className="image"
            />
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
                  id="priceWholesale"
                  type="text"
                  placeholder="Product price"
                  value={data.priceWholesale || ""}
                  onChange={handleInput}
                />
              </div>
              <div className="formInput">
                <label>Nombre d´unité</label>
                <input
                  id="nbUnit"
                  type="text"
                  placeholder="Nombre de pieces dans un Carton"
                  value={data.nbUnit || ""}
                  onChange={handleInput}
                />
              </div> 
              <div className="formInput">
                <label>Prix en detail</label>
                <input
                  id="price"
                  type="text"
                  placeholder="Product price in detail"
                  value={data.price || ""}
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
