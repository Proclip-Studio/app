import Cors from 'cors';
import admin from 'firebase-admin';

// Initialize Firebase Admin (Only once)
if (!admin.apps.length) {
  // Use environment variables provided by Vercel
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Replace literal \n with actual newlines for the private key
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

// Initialize CORS middleware
const cors = Cors({ methods: ['POST', 'OPTIONS'] });

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  // Run CORS middleware
  await runMiddleware(req, res, cors);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Validate Origin (Security)
  // Set ALLOWED_EXTENSION_ID in Vercel Environment Variables.
  const allowedOriginId = process.env.ALLOWED_EXTENSION_ID; 
  if (allowedOriginId) {
    const allowedOrigin = `chrome-extension://${allowedOriginId}`;
    if (req.headers.origin && req.headers.origin !== allowedOrigin) {
      return res.status(403).json({ error: 'Unauthorized Origin' });
    }
  }

  try {
    const { token, email: bodyEmail, password, agentId } = req.body;

    if (!agentId) {
      return res.status(400).json({ error: 'Missing agentId' });
    }
    
    if (!token && (!bodyEmail || !password)) {
      return res.status(400).json({ error: 'Missing authentication credentials (token or email/password)' });
    }

    let userEmail = null;
    let returnToken = token || null;

    if (token) {
      if (token === "email_auth_token") {
        return res.status(401).json({ error: 'Session expired. Please log in again.' });
      }

      // Verify Access Token via Google OAuth2 API
      const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (userInfoResponse.ok) {
        const user = await userInfoResponse.json();
        userEmail = user.email;
      } else {
        // Fallback: Check if it's a Firebase ID token (from email/password login)
        try {
          const decodedToken = await admin.auth().verifyIdToken(token);
          userEmail = decodedToken.email;
        } catch (err) {
          return res.status(401).json({ error: 'Invalid or expired token' });
        }
      }
    } else if (bodyEmail && password) {
      // 2B. Verify Email/Password via Firebase Identity Toolkit REST API
      const apiKey = process.env.FIREBASE_API_KEY || "AIzaSyBeqI9Quekbx_m6l6tQUSyGF6iKC-ixaJI";
      
      const identityRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: bodyEmail, password, returnSecureToken: true })
      });
      
      const identityData = await identityRes.json();
      
      if (!identityRes.ok) {
        let msg = 'Authentication failed';
        if (identityData.error && identityData.error.message) {
          msg = identityData.error.message.replace(/_/g, ' ');
        }
        return res.status(401).json({ error: msg });
      }
      
      userEmail = identityData.email;
      // We return the real ID token so the extension can use it for refreshing
      returnToken = identityData.idToken;
    }

    if (!userEmail) {
      return res.status(400).json({ error: 'No email associated with these credentials' });
    }

    // 3. Find User in Firestore by email
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', userEmail).limit(1).get();

    if (snapshot.empty) {
       return res.status(403).json({ allowed: false, reason: 'Account not found. Please register via the Android or Web App first.' });
    }

    const userDoc = snapshot.docs[0];
    const data = userDoc.data();
    
    // 4. Premium Check
    const status = (data.subscriptionStatus || 'free').toLowerCase();
    
    let isPremium = false;
    if (status === 'premium' || status === 'active') {
        const expiry = data.subscriptionExpiry;
        if (expiry) {
            if (expiry.toDate() > new Date()) {
                isPremium = true;
            }
        } else {
            isPremium = true;
        }
    }

    // 5. Device Restriction (Extension Agent ID)
    if (!data.extensionSession) {
      // First time login on extension for this account
      await userDoc.ref.set({
        extensionSession: { deviceId: agentId, lastLogin: admin.firestore.FieldValue.serverTimestamp() }
      }, { merge: true });

      return res.status(200).json({ 
        allowed: true, 
        isPremium, 
        token: returnToken,
        message: 'Device bound successfully.' 
      });
    }

    if (data.extensionSession.deviceId === agentId) {
      // Same device, update last login
      await userDoc.ref.set({
        extensionSession: { lastLogin: admin.firestore.FieldValue.serverTimestamp() }
      }, { merge: true });

      return res.status(200).json({ 
        allowed: true, 
        isPremium, 
        token: returnToken,
        message: 'Login successful.' 
      });
    }

    // Different device
    return res.status(403).json({
      allowed: false,
      reason: 'This account is already logged in on another extension instance. Please reset it from the Admin panel.'
    });

  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
