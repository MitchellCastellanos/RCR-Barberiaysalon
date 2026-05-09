// ============================================================
// Firebase configuration
// ------------------------------------------------------------
// 1. Create a project at https://console.firebase.google.com
// 2. Enable Authentication (Email/Password) and create one user
// 3. Enable Cloud Firestore (production mode)
// 4. Enable Cloud Storage
// 5. Replace the values below with your project's web config
//    (Project settings → General → Your apps → Web app → SDK setup)
// 6. Apply the rules in firestore.rules and storage.rules
// ============================================================

export const firebaseConfig = {
  apiKey:            "AIzaSyBqHe5V0YB0cMu71J_s1aR6O4t_9bAHe0g",
  authDomain:        "rcr-barbershop.firebaseapp.com",
  projectId:         "rcr-barbershop",
  storageBucket:     "rcr-barbershop.firebasestorage.app",
  messagingSenderId: "1077003368186",
  appId:             "1:1077003368186:web:776ec85da3b912773b3b43"
};

// Set to false to disable Firebase entirely and use only the defaults
// from data.default.json (useful while you finish Firebase setup).
export const FIREBASE_ENABLED = true;
