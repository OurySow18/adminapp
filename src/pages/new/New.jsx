/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 * 
 * Addiert neue Daten in der Datenbank {Products und Users}
 */
import { useState, useEffect } from "react";
import "./new.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { auth, db, storage } from "../../firebase";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useNavigate } from "react-router-dom";

//Array für die User Kategorie
const categorieUser = ['ADMIN', 'CLIENT', 'DRIVER'];
//Array für die Product Type
const categorieType = ['AUTRES','BREAKFAST', 'DEJEUNER','CEREMONIE', 'ENFANTS', 'FEMMES'];
//Array für die Produkt Kategorie
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
const New = ({ inputs, title, typeCmp }) => {
  const [file, setFile] = useState(""); 
  const [categories, setCategories] = useState([]);
  const [data, setData] = useState({});
  const [perc, setPerc] = useState(null);
  const navigate = useNavigate();

  //wählt die aufgerufene Kategorie
  useEffect(() => {
    setCategories(() => {
     return typeCmp === "users" ? 
     categorieUser:
     categorieProduct
    });
    
  }, [typeCmp])
  
  //Aufladung des Bildes
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

  //Input Daten im Array speichern
  const handleInput = (e) => {
    const id = e.target.id;
    const value = e.target.value;

    setData({ ...data, [id]: value });
  };

  //übernimmt die Änderung der Ausgabe in der Input Komponent
  const handleChange = (e) => {    
    setData({ ...data, category: e.target.value }); 
  }

  // zurück zu den vorherige Seite
  const onBack = (e) =>{ 
    e.preventDefault();
    navigate(-1)
  }

  //wird ausgeführt nach dem Druck auf save Button
  const handleAdd = async (e) => {
    e.preventDefault();
    try {
          if (typeCmp=== "users"){
            const res = await createUserWithEmailAndPassword(
              auth,
              data.email,
              data.password
            );
          
            await setDoc(doc(db, typeCmp, res.user.uid), {
              ...data,
              timeStamp: serverTimestamp(),
              status: true,
            });
        } else { 
            await addDoc(collection(db, typeCmp), {
            ...data,
            timeStamp: serverTimestamp(),
            status: false,
          });
      }
        navigate(-1);
    } catch (err) {
      console.log(err);
    } finally {
      console.log("We do cleanup here");
    }
  };

  return (
    <div className="new">
      <Sidebar />
      <div className="newContainer">
        <Navbar />
        <div className="top">
          <h1>{title}</h1>
        </div>
        <div className="bottom">
          <div className="left">
            <img
              src={
                file
                  ? URL.createObjectURL(file)
                  : "https://icon-library.com/images/no-image-icon/no-image-icon-0.jpg"
              }
              alt=""
              className="image"
            />
          </div>
          <div className="right">
            <form onSubmit={handleAdd}>
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
              <div className="formInput" >
                <label>
                  Category {typeCmp}
                  <select label={typeCmp} onChange={handleChange}>
                  {categories.map((item) => (
                    <option value={item}>{item}</option>                 
                  ))} 
                  </select>
                </label>
              </div>

              {inputs.map((input) => (
                <div className="formInput" key={input.id}>
                  <label> {input.label} </label>
                  <input
                    id={input.id}
                    type={input.type}
                    placeholder={input.placeholder}
                    onChange={handleInput}
                  />
                </div>
              ))}
               
             {
              typeCmp === "products" && 
                          <div className="formInput" >
                              <label> Description </label>
                                <textarea 
                                  id= "description"
                                  label= "Description"
                                  type= "textarea"
                                  rows={15}
                                  cols={65}
                                  onChange={handleInput}
                                  placeholder= "Product Description"
                                  value={data.description}
                                />
                                <div className="formInput" >
                                  <label> 
                                    <select label=""onChange={handleChange}>
                                    {categorieType.map((item) => (
                                      <option value={item}>{item}</option>                 
                                    ))} 
                                    </select>
                                  </label>
                              </div>                          
                            </div>
                              
            }
              <div>
                <button onClick={onBack} type="submit">
                back
              </button>
              </div>
              <div>
              <button disabled={perc !== null && perc < 100} type="submit">
                save
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
