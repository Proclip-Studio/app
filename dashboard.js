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

    const submitFormContainer = document.getElementById('submit-form-container');
    if (submitFormContainer && plan !== 'free' && !window.isSubmitFormInitialized) {
        submitFormContainer.innerHTML = `
            <section class="dashboard-section glass reveal active" id="submit-form-section">
                <h3 class="section-title"><i class="fa-solid fa-file-lines"></i> Submit Form</h3>
                
                <div class="form-group" style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; color: var(--text-light); font-weight: 500;">Google Form URL</label>
                    <div style="display: flex; gap: 10px;">
                        <input type="text" id="formUrl" placeholder="https://forms.gle/..." style="flex: 1; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.05); color: #fff;">
                        <button id="fetchFieldsBtn" class="btn btn-secondary" style="white-space: nowrap;">Fetch Fields</button>
                        <button id="resetFormBtn" class="btn btn-secondary" style="background: transparent; border: 1px solid var(--border-color);">Reset</button>
                    </div>
                    <p id="fetchStatus" style="font-size: 0.85rem; color: var(--text-muted); margin-top: 8px; min-height: 20px;"></p>
                </div>

                <div class="form-group" style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <label style="color: var(--text-light); font-weight: 500;">Video Links (Paste from Sheet)</label>
                    </div>
                    <textarea id="linksArea" placeholder="Paste your links here (one per line)..." style="width: 100%; height: 120px; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.05); color: #fff; resize: vertical; box-sizing: border-box;"></textarea>
                </div>

                <div id="dynamicFieldsContainer" style="margin-bottom: 20px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid var(--border-color);">
                    <p style="margin: 0; font-style: italic; color: var(--text-muted); font-size: 0.9rem;">Enter a Form URL and click Fetch to see fields.</p>
                </div>

                <div style="display: flex; gap: 10px; align-items: center;">
                    <button id="submitBtn" class="btn btn-primary">Start Bulk Submission</button>
                    <button id="stopSubmitBtn" class="btn btn-secondary" style="display:none; background: #ef4444; border-color: #ef4444;">Stop</button>
                </div>

                <div id="progressSection" style="display:none; margin-top: 20px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.9rem;">
                        <span>Progress</span>
                        <span id="progressCount">0/0</span>
                    </div>
                    <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
                        <div id="progressFill" style="width: 0%; height: 100%; background: var(--primary); transition: width 0.3s ease;"></div>
                    </div>
                    <div id="statusMessage" style="font-size: 0.85rem; color: var(--text-muted); margin-top: 8px;">Ready</div>
                </div>
            </section>
        `;
        window.isSubmitFormInitialized = true;
        if (typeof window.initializeSubmitForm === 'function') {
            window.initializeSubmitForm();
        }
    } else if (submitFormContainer && plan === 'free') {
        submitFormContainer.innerHTML = '';
        window.isSubmitFormInitialized = false;
    }


    // Stats logic (Standardized fields)
    clipsCount.innerText = data.clipsExported || data.exportedClipsCount || 0;
    const uploadedCountEl = document.getElementById('clips-uploaded');
    if (uploadedCountEl) {
        uploadedCountEl.innerText = data.clipsUploaded || data.uploadedClipsCount || 0;
    }

    if (data.subscriptionEndDate) {
        let endDate;
        if (typeof data.subscriptionEndDate.toDate === 'function') {
            endDate = data.subscriptionEndDate.toDate();
        } else if (data.subscriptionEndDate.seconds) {
            endDate = new Date(data.subscriptionEndDate.seconds * 1000);
        } else {
            endDate = new Date(data.subscriptionEndDate);
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

// Change Plan Logic (Now points to Email)
window.changePlan = (planId) => {
    const emailAddress = "proclipstudio.contact@gmail.com";
    const subject = encodeURIComponent(`Plan Upgrade Request: ${planId}`);
    const body = encodeURIComponent(`Hi ProClip Studio!\n\nI would like to change my plan to the ${planId} plan. My email is ${auth.currentUser.email}.\n\nPlease let me know the next steps.`);
    const mailtoUrl = `mailto:${emailAddress}?subject=${subject}&body=${body}`;

    alert(`To change or upgrade your plan, please contact our support team via email. Opening your email client...`);
    window.location.href = mailtoUrl;
};

// Logout
// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = 'auth.html';
    });
});

// --- Submit Form Logic ---
window.initializeSubmitForm = function() {
    const formUrlInput = document.getElementById('formUrl');
    const fetchFieldsBtn = document.getElementById('fetchFieldsBtn');
    const resetFormBtn = document.getElementById('resetFormBtn');
    const linksArea = document.getElementById('linksArea');
    const dynamicFieldsContainer = document.getElementById('dynamicFieldsContainer');
    const fetchStatus = document.getElementById('fetchStatus');
    const submitBtn = document.getElementById('submitBtn');
    const stopSubmitBtn = document.getElementById('stopSubmitBtn');
    const progressSection = document.getElementById('progressSection');
    const progressCount = document.getElementById('progressCount');
    const progressFill = document.getElementById('progressFill');
    const statusMessage = document.getElementById('statusMessage');

    let currentFields = [];
    let resolvedFormResponseUrl = "";
    let submissionInterrupt = false;

    if (fetchFieldsBtn) {
        fetchFieldsBtn.addEventListener('click', async () => {
            const url = formUrlInput.value.trim();
            if (!url) {
                fetchStatus.textContent = "⚠️ Please enter a Google Form URL.";
                fetchStatus.style.color = "#ef4444";
                return;
            }

            fetchFieldsBtn.disabled = true;
            fetchFieldsBtn.textContent = "Fetching...";
            fetchStatus.style.color = "var(--text-muted)";
            fetchStatus.textContent = "⏳ Fetching form structure...";

            try {
                // Point to our Vercel Serverless Function
                const response = await fetch(`/api/fetch-form?url=${encodeURIComponent(url)}`);
                const data = await response.json();

                if (!response.ok || data.error) {
                    throw new Error(data.error || `HTTP ${response.status}`);
                }

                if (!data.fields || data.fields.length === 0) {
                    fetchStatus.textContent = "⚠️ No fields found. Is this a public Google Form?";
                    fetchStatus.style.color = "#fbbf24";
                    return;
                }

                resolvedFormResponseUrl = data.formResponseUrl;

                currentFields = data.fields.map((f, i) => ({
                    ...f,
                    value: "",
                    isRepeatable: (i === data.fields.length - 1)
                }));

                renderFields();
                fetchStatus.style.color = "#22c55e";
                fetchStatus.textContent = `✅ Found ${currentFields.length} field(s). Set static values below.`;
            } catch (error) {
                console.error(error);
                fetchStatus.textContent = "❌ Error: " + error.message;
                fetchStatus.style.color = "#ef4444";
            } finally {
                fetchFieldsBtn.disabled = false;
                fetchFieldsBtn.textContent = "Fetch Fields";
            }
        });
    }

    if (resetFormBtn) {
        resetFormBtn.addEventListener('click', () => {
            if (confirm("Clear current form structure and values?")) {
                currentFields = [];
                resolvedFormResponseUrl = "";
                if (formUrlInput) formUrlInput.value = "";
                renderFields();
                fetchStatus.textContent = "Form cleared.";
                fetchStatus.style.color = "var(--text-muted)";
            }
        });
    }

    function renderFields() {
        if (!dynamicFieldsContainer) return;
        dynamicFieldsContainer.innerHTML = "";

        if (currentFields.length === 0) {
            dynamicFieldsContainer.innerHTML = '<p style="margin: 0; font-style: italic; color: var(--text-muted); font-size: 0.9rem;">Enter a Form URL and click Fetch to see fields.</p>';
            return;
        }

        currentFields.forEach((field, index) => {
            const div = document.createElement('div');
            div.style.marginBottom = "15px";
            div.style.padding = "10px";
            div.style.background = "rgba(255,255,255,0.02)";
            div.style.borderRadius = "8px";
            div.style.border = field.isRepeatable ? "1px solid var(--primary)" : "1px solid transparent";

            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 500; color: var(--text-light);">${field.label}</span>
                    <label style="cursor:pointer; user-select:none; display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--text-muted);">
                        <input type="radio" name="repeatableField" value="${index}" ${field.isRepeatable ? 'checked' : ''} style="cursor:pointer;">
                        Links go here
                    </label>
                </div>
                <input type="text" value="${field.value}" placeholder="Enter static value..." ${field.isRepeatable ? 'disabled' : ''} style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.05); color: #fff; box-sizing: border-box;">
            `;

            const textInput = div.querySelector('input[type="text"]');
            textInput.addEventListener('input', (e) => {
                currentFields[index].value = e.target.value;
            });

            const radio = div.querySelector('input[type="radio"]');
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    currentFields.forEach((f, i) => f.isRepeatable = (i === index));
                    renderFields();
                }
            });

            dynamicFieldsContainer.appendChild(div);
        });
    }

    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const links = linksArea.value.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
            if (!links.length) return alert("No links to process.");
            if (!resolvedFormResponseUrl) return alert("Please fetch form fields first.");

            console.log(`Starting bulk submission of ${links.length} links to ${resolvedFormResponseUrl}`);

            const repeatableField = currentFields.find(f => f.isRepeatable);
            if (!repeatableField) return alert("Please select which field should receive the links.");

            submissionInterrupt = false;
            submitBtn.style.display = 'none';
            if (stopSubmitBtn) stopSubmitBtn.style.display = 'inline-block';
            if (progressSection) progressSection.style.display = 'block';

            const total = links.length;
            let successCount = 0;

            for (let i = 0; i < total; i++) {
                if (submissionInterrupt) break;

                const currentLink = links[i];
                statusMessage.textContent = `Submitting (${i + 1}/${total}): ${currentLink.substring(0, 30)}...`;

                try {
                    const body = new URLSearchParams();
                    currentFields.forEach(f => {
                        const value = f.isRepeatable ? currentLink : f.value;
                        body.append(f.id, value);
                    });

                    console.log(`Submitting link ${i + 1}: ${currentLink}`);

                    await fetch(resolvedFormResponseUrl, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: body.toString()
                    });
                    successCount++;
                } catch (e) {
                    console.error("Submission failed for link " + (i + 1), e);
                }

                const progress = Math.round(((i + 1) / total) * 100);
                if (progressFill) progressFill.style.width = `${progress}%`;
                if (progressCount) progressCount.textContent = `${i + 1}/${total}`;

                if (i < total - 1) await new Promise(r => setTimeout(r, 2000));
            }

            statusMessage.textContent = submissionInterrupt ? 'Stopped.' : `Done! ${successCount} entries submitted.`;
            submitBtn.style.display = 'inline-block';
            if (stopSubmitBtn) stopSubmitBtn.style.display = 'none';
        });
    }

    if (stopSubmitBtn) {
        stopSubmitBtn.addEventListener('click', () => {
            submissionInterrupt = true;
        });
    }
};
