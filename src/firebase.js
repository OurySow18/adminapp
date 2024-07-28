/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 * 
 * Firebase konfiguration
 */
import { initializeApp } from "firebase/app" 
import { getAuth  } from "firebase/auth";
import { getFirestore}  from "firebase/firestore";
import { getStorage } from "firebase/storage";
 
// Packet die Zugriffsinformationen unseres Firebase-Projekts 
//in die Variable firebaseConfig, die Daten sind für jedes Projekt unterschiedlich
const firebaseConfig = {

    apiKey: process.env.REACT_APP_API_KEY,
  
    authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  
    projectId: process.env.REACT_APP_PROJECT_ID,
  
    storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  
    messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  
    appId: process.env.REACT_APP_APP_ID
  
  }; 
  
  // Initialize Firebase  
  const app = initializeApp(firebaseConfig);
  export const auth = getAuth()

  
  // Initialize Cloud Firestore and get a reference to the service
  export const db = getFirestore(app);

  // Get a reference to the storage service, which is used to create references in your storage bucket
export const storage = getStorage(app);