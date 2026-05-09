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
  apiKey:            "REPLACE_WITH_YOUR_API_KEY",
  authDomain:        "REPLACE_WITH_YOUR_PROJECT.firebaseapp.com",
  projectId:         "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket:     "REPLACE_WITH_YOUR_PROJECT.appspot.com",
  messagingSenderId: "REPLACE_WITH_YOUR_SENDER_ID",
  appId:             "REPLACE_WITH_YOUR_APP_ID"
};

// Set to false to disable Firebase entirely and use only the defaults
// from data.default.json (useful while you finish Firebase setup).
export const FIREBASE_ENABLED = false;
