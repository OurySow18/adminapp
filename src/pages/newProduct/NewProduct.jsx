import React, { useState, useEffect } from "react";
import "./newProduct.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { db, storage } from "../../firebase";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { useNavigate } from "react-router-dom";

const categorieType = [
  "AUTRES",
  "BREAKFAST",
  "DEJEUNER",
  "CEREMONIE",
  "ENFANTS",
  "FEMMES",
];

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
  "CORN FLAKES",
];

const New = ({ inputs, title }) => {
  const [fileArray, setFileArray] = useState([]);
  const [data, setData] = useState([]);
  const [imageObjects, setImageObjects] = useState([]); // Tableau pour stocker les objets d'image
  const [perc, setPerc] = useState(null);
  const [mainImageIndex, setMainImageIndex] = useState(0); // Index de l'image principale, initialisé à 0
  const navigate = useNavigate();

  useEffect(() => {
    const uploadFile = () => {
      Array.from(fileArray).forEach((file) => {
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
              // Ajoute l'objet d'image contenant l'URL et la référence de l'objet de stockage
              setImageObjects((prev) => [
                ...prev,
                { url: downloadURL, ref: uploadTask.snapshot.ref },
              ]);
            });
          }
        );
      });
    };
    fileArray.length && uploadFile();
  }, [fileArray]);

  const handleInput = (e) => {
    const id = e.target.id;
    const value = e.target.value;

    // Met à jour l'état local des données
    setData({ ...data, [id]: value });
  };

  const handleChange = (e) => {
    setData({ ...data, category: e.target.value });
  };

  const onBack = (e) => {
    e.preventDefault();
    navigate(-1);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "products"), {
        ...data,
        timeStamp: serverTimestamp(),
        status: false,
        img: mainImageIndex !== -1 ? imageObjects[mainImageIndex].url : "", // Enregistre l'URL de l'image principale
        // Ajouter les URLs des images dans les données à enregistrer
        images: imageObjects.map((obj) => obj.url),
      });
      navigate(-1);
    } catch (err) {
      console.log(err);
    } finally {
      console.log("Cleanup here");
    }
  };

  const handleImageDelete = (index) => {
    const { ref: imageRef } = imageObjects[index]; // Récupère la référence de l'objet de stockage

    deleteObject(imageRef)
      .then(() => {
        console.log("Image deleted successfully from storage");

        // Met à jour l'état local en supprimant l'objet d'image du tableau
        setImageObjects((prev) =>
          prev.filter((_, idx) => idx !== index)
        );

        // Si l'image principale est supprimée, réinitialise mainImageIndex à -1
        if (index === mainImageIndex) {
          setMainImageIndex(-1);
        } else if (index < mainImageIndex) {
          setMainImageIndex((prev) => prev - 1); // Ajuste l'index si nécessaire
        }
      })
      .catch((error) => {
        console.error("Error deleting image from storage", error);
      });
  };

  const setMainImage = (index) => {
    setMainImageIndex(index); // Définit cette image comme l'image principale
  };

  return (
    <div className="newProduct">
      <Sidebar />
      <div className="newProductContainer">
        <Navbar />
        <div className="top">
          <h1>{title}</h1>
        </div>
        <div className="bottom">
          <div className="left">
            <div className="uploadedImages">
              {imageObjects.map((obj, index) => (
                <div key={index} className="uploadedImageContainer">
                  <img
                    src={obj.url}
                    alt={`Uploaded ${index}`}
                    className="image"
                  />
                  <div>
                    <button
                      onClick={() => handleImageDelete(index)}
                      className="deleteButton"
                    >
                      Supprimer
                    </button>
                    <input
                      type="radio"
                      name="mainImage"
                      onChange={() => setMainImage(index)}
                      checked={index === mainImageIndex} 
                    /> 
                  </div>
                </div>
              ))}
            </div>
            <label htmlFor="file" className="uploadLabel">
              Image <DriveFolderUploadOutlinedIcon className="icon" />
            </label>
            <input
              type="file"
              id="file"
              onChange={(e) => setFileArray(e.target.files)}
              multiple
              style={{ display: "none" }}
            />
          </div>
          <div className="right">
            <form onSubmit={handleAdd}>
              <div className="formProductInput">
                <label>
                  Category Products
                  <select label="products" onChange={handleChange}>
                    {categorieProduct.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {inputs.map((input) => (
                <div className="formProductInput" key={input.id}>
                  <label>{input.label}</label>
                  <input
                    id={input.id}
                    type={input.type}
                    placeholder={input.placeholder}
                    onChange={handleInput}
                  />
                </div>
              ))}

              <div className="formProductInput">
                <label>Description</label>
                <textarea
                  id="description"
                  rows={15}
                  cols={65}
                  onChange={handleInput}
                  placeholder="Product Description"
                  value={data.description}
                />
              </div>

              <div className="formProductInput">
                <label>Category Type</label>
                <select onChange={handleChange}>
                  {categorieType.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <button onClick={onBack} type="button">
                  Back
                </button>
                <button
                  disabled={perc !== null && perc < 100}
                  type="submit"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default New;
