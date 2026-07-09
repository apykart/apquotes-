import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc, setDoc, updateDoc, addDoc, getDoc, getDocs,
  collection, onSnapshot, deleteDoc,
  query, where, orderBy, serverTimestamp, limit, increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref as storageRef,
  uploadBytesResumable, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyB9wwF-K1AwN8xlrppiKELDXx0NxqJknbc",
  authDomain: "apykart-916.firebaseapp.com",
  projectId: "apykart-916",
  storageBucket: "apykart-916.firebasestorage.app",
  messagingSenderId: "787741109597",
  appId: "1:787741109597:web:883a5eee5e9bb9602f8cb4"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const provider = new GoogleAuthProvider();

// Export Firestore functions
export {
  doc, setDoc, updateDoc, addDoc, getDoc, getDocs,
  collection, onSnapshot, deleteDoc,
  query, where, orderBy, serverTimestamp, limit, increment
};

// Export Storage functions
export { storageRef, uploadBytesResumable, getDownloadURL, deleteObject };

// Export Auth functions
export { signInWithPopup, signOut, onAuthStateChanged };
