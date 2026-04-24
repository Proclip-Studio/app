import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    onSnapshot
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

const loadingOverlay = document.getElementById('loading-overlay');
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const userPhoto = document.getElementById('user-photo');
const userPlanBadge = document.getElementById('user-plan-badge');
const clipsCount = document.getElementById('clips-count');
const expiryDays = document.getElementById('expiry-days');
const pricingContainer = document.getElementById('pricing-container');
const statusText = document.getElementById('status-text');
const userUid = document.getElementById('user-uid');

// Check Auth State
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Simple, live loading logic using onSnapshot
        const userDocRef = doc(db, "users", user.uid);
        onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.role === 'admin') {
                    const adminBtn = document.getElementById('admin-panel-btn');
                    if (adminBtn) {
                        adminBtn.classList.remove('admin-btn-hidden');
                        adminBtn.classList.add('admin-btn-visible');
                    }
                }
                applyUserData(data, user);
                loadPricing(user, data); // Pass data directly to avoid duplicate reads
                setLoading(false);
            } else {
                console.warn("User document does not exist.");
                setLoading(false);
            }
        }, (error) => {
            console.error("Error listening to user data:", error);
            setLoading(false);
        });
    } else {
        window.location.href = 'auth.html';
    }
});

const setLoading = (loading) => {
    if (loadingOverlay) loadingOverlay.style.display = loading ? 'flex' : 'none';
};

// Extracted Plan Resolution Logic to prevent duplication
function resolvePlan(data) {
    // 1. Find the subscription status and plan type
    let status = data.subscriptionStatus;
    let planType = data.subscriptionPlan || data.plan;

    // 2. Fallback to latest history entry if root fields are missing
    if (!status && data.subscriptionHistory && data.subscriptionHistory.length > 0) {
        const latestHistory = data.subscriptionHistory[0];
        status = status || latestHistory.subscriptionStatus;
        planType = planType || latestHistory.subscriptionPlan || latestHistory.plan;
    }

    // 3. Determine final plan based on status
    if (status && status.toLowerCase() === 'premium') {
        return planType ? planType.toLowerCase() : 'premium';
    }

    return 'free';
}

// Apply data to UI
function applyUserData(data, user) {
    const name = data.displayName || user.displayName || "User";
    userName.innerText = name;
    userEmail.innerText = data.email || user.email;
    if (userUid) userUid.innerText = user.uid;

    // Safer DOM manipulation for Avatar
    const photo = data.photoURL || user.photoURL;
    const avatarContainer = document.getElementById('avatar-container');
    if (avatarContainer) {
        avatarContainer.innerHTML = ''; // Clear existing
        if (photo) {
            const img = document.createElement('img');
            img.src = photo;
            img.alt = name;
            img.className = 'profile-img';
            img.onerror = function () {
                this.style.display = 'none';
                const div = document.createElement('div');
                div.className = 'avatar-placeholder';
                div.innerText = name.charAt(0);
                avatarContainer.appendChild(div);
            };
            avatarContainer.appendChild(img);
        } else {
            const div = document.createElement('div');
            div.className = 'avatar-placeholder';
            div.innerText = name.charAt(0);
            avatarContainer.appendChild(div);
        }
    }

    const plan = resolvePlan(data);

    userPlanBadge.innerText = `${plan} Plan`;
    userPlanBadge.style.background = (plan === 'free') ? 'rgba(255,255,255,0.05)' : 'rgba(0, 229, 255, 0.1)';
    userPlanBadge.style.color = (plan === 'free') ? 'var(--text-muted)' : 'var(--primary)';

    // Stats logic (Standardized fields)
    clipsCount.innerText = data.clipsExported || data.exportedClipsCount || 0;
    const uploadedCountEl = document.getElementById('clips-uploaded');
    if (uploadedCountEl) {
        uploadedCountEl.innerText = data.clipsUploaded || data.uploadedClipsCount || 0;
    }

    if (data.subscriptionExpiry) {
        let endDate;
        if (typeof data.subscriptionExpiry.toDate === 'function') {
            endDate = data.subscriptionExpiry.toDate();
        } else if (data.subscriptionExpiry.seconds) {
            endDate = new Date(data.subscriptionExpiry.seconds * 1000);
        } else {
            endDate = new Date(data.subscriptionExpiry);
        }

        const now = new Date();
        const diffTime = endDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        expiryDays.innerText = diffDays > 0 ? diffDays : "0";
        statusText.innerText = `Your ${plan} subscription is active until ${endDate.toLocaleDateString()}.`;
    } else {
        expiryDays.innerText = "∞";
        statusText.innerText = plan === 'free' ? "You are on the Free plan. Upgrade to unlock more features." : "Your subscription status is active.";
    }
}

// Load Pricing (now accepts user data to avoid duplicate reads)
async function loadPricing(user, userData) {
    if (!pricingContainer) return;

    // Show simple loading state for pricing
    pricingContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted);">Loading pricing...</div>';

    try {
        const pricingDoc = await getDoc(doc(db, "appConfig", "subscriptionPricing"));
        if (pricingDoc.exists()) {
            const pricing = pricingDoc.data();
            const currency = pricing.currency || "PKR";

            const plans = [
                { id: 'free', name: 'Free', price: 0, period: '' },
                { id: 'weekly', name: 'Weekly', price: pricing.weeklyPrice, period: '/ week' },
                { id: 'monthly', name: 'Monthly', price: pricing.monthlyPrice, period: '/ month' },
                { id: 'yearly', name: 'Yearly', price: pricing.yearlyPrice, period: '/ year' }
            ];

            const currentPlan = resolvePlan(userData);

            pricingContainer.innerHTML = plans.map(plan => `
                <div class="pricing-card ${plan.id === currentPlan ? 'active' : ''}">
                    <div class="plan-name">${plan.name}</div>
                    <div class="plan-price">${currency} ${plan.price.toLocaleString()}<span>${plan.period}</span></div>
                    <button class="btn ${plan.id === currentPlan ? 'btn-secondary' : 'btn-primary'} plan-btn" 
                            onclick="window.changePlan('${plan.id}')"
                            ${plan.id === currentPlan ? 'disabled' : ''}>
                        ${plan.id === currentPlan ? 'Current Plan' : 'Contact to Upgrade'}
                    </button>
                </div>
            `).join('');
        } else {
            pricingContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted);">Pricing information unavailable.</div>';
        }
    } catch (error) {
        console.error("Pricing Load Error:", error);
        pricingContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #ff4444;">Error loading pricing. Please try again.</div>';
    }
}

// Change Plan Logic (Now points to WhatsApp)
window.changePlan = (planId) => {
    const whatsappNumber = "+923165451573";
    const message = encodeURIComponent(`Hi ProClip Studio! I would like to change my plan to the ${planId} plan. My email is ${auth.currentUser.email}.`);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;

    alert(`To change or upgrade your plan, please contact our support team on WhatsApp. Opening chat...`);
    window.open(whatsappUrl, '_blank');
};

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = 'auth.html';
    });
});
