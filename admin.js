import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBeqI9Quekbx_m6l6tQUSyGF6iKC-ixaJI",
    authDomain: "proclip-studio.firebaseapp.com",
    projectId: "proclip-studio",
    storageBucket: "proclip-studio.firebasestorage.app",
    messagingSenderId: "18246462392",
    appId: "1:18246462392:web:1a9ebb1362c29e78873d4d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const loadingOverlay = document.getElementById('loading-overlay');
const usersTableBody = document.getElementById('users-table-body');
const searchInput = document.getElementById('search-input');
const filterPlan = document.getElementById('filter-plan');
const filterStatus = document.getElementById('filter-status');
const refreshBtn = document.getElementById('refresh-btn');

// Stats Elements
const statTotalUsers = document.getElementById('stat-total-users');
const statActiveUsers = document.getElementById('stat-active-users');
const statTotalPremiumUsers = document.getElementById('stat-premium-users');
const statTotalExports = document.getElementById('stat-total-exports');
const statTotalUploads = document.getElementById('stat-total-uploads');

// Modal Elements
const editModal = document.getElementById('edit-modal');
const closeModalBtn = document.getElementById('close-modal');
const saveUserBtn = document.getElementById('save-user-btn');
const resetAndroidBtn = document.getElementById('reset-android-btn');
const resetExtensionBtn = document.getElementById('reset-extension-btn');
const deleteUserBtn = document.getElementById('delete-user-btn');

let allUsers = [];

// Check Admin Status
onAuthStateChanged(auth, async (user) => {
    if (user) {
        setLoading(true);
        try {
            const docSnap = await getDoc(doc(db, "users", user.uid));
            if (docSnap.exists() && docSnap.data().role === 'admin') {
                await loadData();
            } else {
                alert("Unauthorized. Redirecting to dashboard.");
                window.location.href = 'dashboard.html';
            }
        } catch (e) {
            console.error(e);
            window.location.href = 'dashboard.html';
        } finally {
            setLoading(false);
        }
    } else {
        window.location.href = 'auth.html';
    }
});

const setLoading = (loading) => {
    if (loadingOverlay) loadingOverlay.style.display = loading ? 'flex' : 'none';
};

async function loadData() {
    setLoading(true);
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        allUsers = [];
        let totalExports = 0;
        let totalUploads = 0;
        let premiumCount = 0;
        let activeCount = 0;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            data.id = doc.id;
            allUsers.push(data);

            totalExports += (data.clipsExported || data.exportedClipsCount || 0);
            totalUploads += (data.clipsUploaded || data.uploadedClipsCount || 0);
            if (data.isActive !== false) activeCount++;
            
            const status = (data.subscriptionStatus || 'free').toLowerCase();
            if (status === 'premium' || status === 'active') premiumCount++;
        });

        // Update Stats
        if (statTotalUsers) statTotalUsers.innerText = allUsers.length;
        if (statActiveUsers) statActiveUsers.innerText = activeCount;
        if (statTotalPremiumUsers) statTotalPremiumUsers.innerText = premiumCount;
        if (statTotalExports) statTotalExports.innerText = totalExports;
        if (statTotalUploads) statTotalUploads.innerText = totalUploads;

        applyFilters();
    } catch (e) {
        console.error("Error fetching users:", e);
        let msg = "Failed to load users.";
        if (e.code === 'permission-denied') {
            msg = `Firestore Permission Denied.\n\nPlease update your Firestore Security Rules to allow admins to read all users.\n\nGo to Firebase Console → Firestore → Rules and add:\n\nallow read: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';`;
        } else {
            msg = `Error: ${e.message || e.code || 'Unknown error'}`;
        }
        usersTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: #ff4757; padding: 30px;">${msg.split('\n')[0]}<br><small style="color: var(--text-muted); font-size: 0.8rem;">Check browser console for details.</small></td></tr>`;
        alert(msg);
    } finally {
        setLoading(false);
    }
}

function renderTable(users) {
    usersTableBody.innerHTML = '';
    if (users.length === 0) {
        usersTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No users found.</td></tr>';
        return;
    }

    users.forEach(user => {
        const tr = document.createElement('tr');
        
        const roleClass = user.role === 'admin' ? 'admin' : 'user';
        const subStatus = (user.subscriptionStatus || 'free').toLowerCase();
        const planClass = (subStatus === 'premium' || subStatus === 'active') ? 'premium' : 'free';
        const activeClass = user.isActive === false ? 'blocked' : 'active';
        
        const exports = user.clipsExported || user.exportedClipsCount || 0;
        const uploads = user.clipsUploaded || user.uploadedClipsCount || 0;
        
        let dateJoined = 'N/A';
        if (user.createdAt) {
            const d = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
            dateJoined = d.toLocaleDateString();
        }

        let expiryDisplay = '<span style="color: var(--muted); font-size: 0.8rem;">N/A</span>';
        if (user.subscriptionEndDate) {
            const expDate = user.subscriptionEndDate.toDate ? user.subscriptionEndDate.toDate() : new Date(user.subscriptionEndDate);
            const isExpired = expDate < new Date();
            const formatted = expDate.toLocaleDateString();
            expiryDisplay = isExpired
                ? `<span style="color: var(--danger); font-size: 0.82rem;">${formatted} <small>(Expired)</small></span>`
                : `<span style="color: var(--success); font-size: 0.82rem;">${formatted}</span>`;
        }

        tr.innerHTML = `
            <td>
                <div style="font-weight: 600;">${user.displayName || 'User'}</div>
                <div style="font-size: 0.8rem; color: var(--muted);">${user.email}</div>
            </td>
            <td><span class="badge badge-${roleClass}">${user.role || 'user'}</span></td>
            <td><span class="badge badge-${planClass}">${subStatus}</span></td>
            <td><span class="badge badge-${activeClass}">${user.isActive === false ? 'Blocked' : 'Active'}</span></td>
            <td>${exports}</td>
            <td>${uploads}</td>
            <td>${expiryDisplay}</td>
            <td>${dateJoined}</td>
        `;
        
        tr.onclick = () => openEditModal(user);
        usersTableBody.appendChild(tr);
    });
}

// Filter Logic
function applyFilters() {
    const term = searchInput.value.toLowerCase();
    const plan = filterPlan.value;
    const status = filterStatus.value;

    const filtered = allUsers.filter(u => {
        // Search Term
        const matchesSearch = (u.email && u.email.toLowerCase().includes(term)) || 
                             (u.displayName && u.displayName.toLowerCase().includes(term));
        
        // Plan Filter
        const userPlan = (u.subscriptionStatus || 'free').toLowerCase();
        const resolvedPlan = (userPlan === 'premium' || userPlan === 'active') ? 'premium' : 'free';
        const matchesPlan = plan === 'all' || resolvedPlan === plan;
        
        // Status Filter
        const userStatus = u.isActive === false ? 'blocked' : 'active';
        const matchesStatus = status === 'all' || userStatus === status;

        return matchesSearch && matchesPlan && matchesStatus;
    });

    renderTable(filtered);
}

searchInput.addEventListener('input', applyFilters);
filterPlan.addEventListener('change', applyFilters);
filterStatus.addEventListener('change', applyFilters);

refreshBtn.addEventListener('click', loadData);

// ─── Plan/Sub Helpers ───────────────────────────────────────────
window.handleSubChange = (value) => {
    const planCol = document.getElementById('plan-type-col');
    const planSelect = document.getElementById('edit-plan');
    const expiryInput = document.getElementById('edit-expiry');
    if (value === 'free') {
        if (planCol) planCol.style.display = 'none';
        if (planSelect) planSelect.value = '';
        if (expiryInput) expiryInput.value = ''; // clear expiry for free
    } else {
        if (planCol) planCol.style.display = 'flex';
        // Auto-set expiry based on current plan selection
        if (planSelect && planSelect.value) handlePlanChange(planSelect.value);
    }
};

// Track if admin manually changed the date
let adminOverrideDateSet = false;

window.handlePlanChange = (plan) => {
    if (adminOverrideDateSet) return; // respect admin's manual date
    const expiryInput = document.getElementById('edit-expiry');
    if (!expiryInput || !plan) return;
    const now = new Date();
    const days = plan === 'weekly' ? 7 : plan === 'monthly' ? 30 : plan === 'yearly' ? 365 : 0;
    if (days > 0) {
        now.setDate(now.getDate() + days);
        expiryInput.value = now.toISOString().split('T')[0];
    }
};

// Detect admin manually editing the date
document.getElementById('edit-expiry')?.addEventListener('input', () => {
    adminOverrideDateSet = true;
});

// Modal Logic
function openEditModal(user) {
    adminOverrideDateSet = false; // reset override flag each time modal opens
    document.getElementById('modal-user-name').innerText = `Edit: ${user.displayName || user.email}`;
    document.getElementById('edit-uid').value = user.id;
    document.getElementById('edit-role').value = user.role || 'user';
    document.getElementById('edit-is-active').value = user.isActive === false ? 'false' : 'true';
    
    const subStatus = (user.subscriptionStatus || 'free').toLowerCase();
    const resolvedSub = (subStatus === 'premium' || subStatus === 'active') ? 'premium' : 'free';
    document.getElementById('edit-sub-status').value = resolvedSub;
    document.getElementById('edit-plan').value = user.subscriptionPlan || user.plan || '';
    
    if (user.subscriptionEndDate) {
        const d = user.subscriptionEndDate.toDate ? user.subscriptionEndDate.toDate() : new Date(user.subscriptionEndDate);
        document.getElementById('edit-expiry').value = d.toISOString().split('T')[0];
        adminOverrideDateSet = true; // existing date is treated as admin override
    } else {
        document.getElementById('edit-expiry').value = '';
    }

    // Show or hide plan type based on subscription
    handleSubChange(resolvedSub);

    editModal.classList.add('open');
}

closeModalBtn.addEventListener('click', () => {
    editModal.classList.remove('open');
});

// Save User
saveUserBtn.addEventListener('click', async () => {
    const uid = document.getElementById('edit-uid').value;
    const role = document.getElementById('edit-role').value;
    const isActive = document.getElementById('edit-is-active').value === 'true';
    const subStatus = document.getElementById('edit-sub-status').value;
    const plan = document.getElementById('edit-plan').value;
    const expiryStr = document.getElementById('edit-expiry').value;
    
    setLoading(true);
    try {
        const updates = {
            role: role,
            isActive: isActive,
            subscriptionStatus: subStatus,
            subscriptionPlan: plan || null
        };
        
        if (expiryStr) {
            updates.subscriptionEndDate = Timestamp.fromDate(new Date(expiryStr));
        } else {
            updates.subscriptionEndDate = null;
        }

        await updateDoc(doc(db, "users", uid), updates);
        alert("User updated successfully!");
        editModal.classList.remove('open');
        loadData();
    } catch (e) {
        console.error("Error updating user:", e);
        alert("Failed to update user.");
    } finally {
        setLoading(false);
    }
});

// Security Actions
resetAndroidBtn.addEventListener('click', async () => {
    const uid = document.getElementById('edit-uid').value;
    if (confirm("Reset Android Device binding for this user?")) {
        try {
            await updateDoc(doc(db, "users", uid), { boundDeviceId: null });
            alert("Android device reset successfully.");
        } catch (e) { alert("Failed to reset Android device."); }
    }
});

resetExtensionBtn.addEventListener('click', async () => {
    const uid = document.getElementById('edit-uid').value;
    if (confirm("Reset Extension Device binding for this user?")) {
        try {
            await updateDoc(doc(db, "users", uid), { extensionSession: null });
            alert("Extension device reset successfully.");
        } catch (e) { alert("Failed to reset Extension device."); }
    }
});

deleteUserBtn.addEventListener('click', async () => {
    const uid = document.getElementById('edit-uid').value;
    if (confirm("Are you sure you want to completely delete this user? This action cannot be undone.")) {
        try {
            await deleteDoc(doc(db, "users", uid));
            alert("User deleted from Firestore.");
            editModal.classList.remove('open');
            loadData();
        } catch (e) { alert("Failed to delete user."); }
    }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = 'auth.html';
    });
});
