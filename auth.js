import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration
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

// Handle Auth State Changes
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("User detected:", user.email);
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (!userDoc.exists()) {
                await initializeUserData(user);
            }
            window.location.href = 'dashboard.html';
        } catch (error) {
            console.error("Firestore Error:", error);
            // Even if Firestore fails, we might want to try going to dashboard
            window.location.href = 'dashboard.html';
        }
    }
});

// Elements
const authForm = document.getElementById('auth-form');
const googleBtn = document.getElementById('google-login');
const errorMsg = document.getElementById('error-msg');
const loadingOverlay = document.getElementById('loading-overlay');

// Show/Hide Loading
const setLoading = (loading) => {
    if (loadingOverlay) loadingOverlay.style.display = loading ? 'flex' : 'none';
};

// Handle Form Submission
if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const nameEl = document.getElementById('name');
        const isSignUp = !!nameEl;

        setLoading(true);
        if (errorMsg) errorMsg.style.display = 'none';

        try {
            if (isSignUp) {
                const name = nameEl.value;
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: name });
                await initializeUserData(userCredential.user);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            window.location.href = 'dashboard.html';
        } catch (error) {
            console.error("Auth Error:", error);
            if (errorMsg) {
                errorMsg.innerText = error.message;
                errorMsg.style.display = 'block';
            } else {
                alert("Error: " + error.message);
            }
        } finally {
            setLoading(false);
        }
    });
}

// Google Login (Using Popup for better feedback)
if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
        console.log("Starting Google Popup...");
        setLoading(true);
        try {
            const result = await signInWithPopup(auth, googleProvider);
            console.log("Popup Success:", result.user.email);
            // Redirection is handled by onAuthStateChanged
        } catch (error) {
            console.error("Popup Error:", error);
            let msg = error.message;
            if (error.code === 'auth/popup-blocked') {
                msg = "Popup was blocked by your browser. Please allow popups for this site.";
            } else if (error.code === 'auth/popup-closed-by-user') {
                msg = "Login popup was closed before finishing. Please try again.";
            } else if (error.code === 'auth/operation-not-allowed') {
                msg = "Google Sign-In is not enabled in Firebase Console.";
            }
            alert("Google Login Failed: " + msg);
            setLoading(false);
        }
    });
}

// Initialize User Data in Firestore
async function initializeUserData(user) {
    await setDoc(doc(db, "users", user.uid), {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        role: "user",
        isActive: true,
        exportedClipsCount: 0,
        currentPlan: "free",
        subscriptionActivatedByAdmin: false,
        subscriptionEndDate: null,
        subscriptionEndDate: null,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
    }, { merge: true });
}
