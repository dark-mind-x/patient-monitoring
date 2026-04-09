// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDn7FP0O1p9aaHWecYyBJy9PJPzWGEJgsA",
  authDomain: "patient-monitoring-58e18.firebaseapp.com",
  databaseURL: "https://patient-monitoring-58e18-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "patient-monitoring-58e18",
  storageBucket: "patient-monitoring-58e18.firebasestorage.app",
  messagingSenderId: "319621497294",
  appId: "1:319621497294:web:5768bacac50f903d57eb9f",
  measurementId: "G-530F2XJ0DT"
};

// Initialize Firebase

const app = initializeApp(firebaseConfig);

// THIS IS THE LINE THAT IS MISSING OR NOT SAVED
export const db = getDatabase(app);
