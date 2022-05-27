import { initializeApp } from "firebase/app" 
import { getAuth } from "firebase/auth";
import { getFirestore}  from "firebase/firestore";
import { getStorage } from "firebase/storage";


 
const firebaseConfig = {

    apiKey: "AIzaSyDCENsh0tZlNtbcNAZZHqt1RtkNIsWsNuE",
  
    authDomain: "monmarhe.firebaseapp.com",
  
    projectId: "monmarhe",
  
    storageBucket: "monmarhe.appspot.com",
  
    messagingSenderId: "810364309186",
  
    appId: "1:810364309186:web:3042a0b4f1564492db755b"
  
  };
  
  
  // Initialize Firebase
  
  const app = initializeApp(firebaseConfig);
  export const auth = getAuth()
  
  // Initialize Cloud Firestore and get a reference to the service
  export const db = getFirestore(app);

  // Get a reference to the storage service, which is used to create references in your storage bucket
export const storage = getStorage(app);


  