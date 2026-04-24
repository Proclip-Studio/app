import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBeqI9Quekbx_m6l6tQUSyGF6iKC-ixaJI",
  authDomain: "proclip-studio.firebaseapp.com",
  projectId: "proclip-studio",
  storageBucket: "proclip-studio.firebasestorage.app",
  messagingSenderId: "18246462392",
  appId: "1:18246462392:web:1a9ebb1362c29e78873d4d",
  measurementId: "G-VP1ZJPZSWL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider };
