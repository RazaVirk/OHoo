/* ===== FIREBASE CONFIG ===== */
const firebaseConfig = {
  apiKey: "AIzaSyB08cd_XutBt0eb_9xACnYnNZA9vdCVOHI",
  authDomain: "ohoo-53c86.firebaseapp.com",
  projectId: "ohoo-53c86",
  storageBucket: "ohoo-53c86.firebasestorage.app",
  messagingSenderId: "260228641417",
  appId: "1:260228641417:web:1919428549413d48274c58",
  measurementId: "G-8LQ67YWLDM"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc,
    deleteDoc,
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    limit,
    serverTimestamp,
    onSnapshot,
    where
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

window.FB = {
    app, auth, db,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    doc, getDoc, setDoc, updateDoc, deleteDoc,
    collection, addDoc, getDocs, query, orderBy, limit, where,
    serverTimestamp, onSnapshot
};

console.log("✅ Firebase initialized");
