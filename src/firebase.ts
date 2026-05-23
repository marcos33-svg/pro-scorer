import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCB6HpvGzvGT-2OUPsJmScL5qHNR3QkmYE",
  authDomain: "pro-scorer-2a5ef.firebaseapp.com",
  databaseURL: "https://pro-scorer-2a5ef-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pro-scorer-2a5ef",
  storageBucket: "pro-scorer-2a5ef.firebasestorage.app",
  messagingSenderId: "201783156427",
  appId: "1:201783156427:web:10933b1bd40d054ff0854e",
  measurementId: "G-DYNB9PX92F"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export default app;