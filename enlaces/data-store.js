// ============================================================
// Data store: reads from Firestore (config/site) with a graceful
// fallback to data.default.json. Caches in localStorage so the
// page renders instantly on subsequent visits while a fresh copy
// loads in the background.
// ============================================================

import { firebaseConfig, FIREBASE_ENABLED } from "./firebase-config.js";

const CACHE_KEY = "rcr:enlaces:data";
const CACHE_TS_KEY = "rcr:enlaces:data:ts";
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12h

let _firebaseAppPromise = null;
let _firestorePromise = null;

async function getFirebase() {
  if (!_firebaseAppPromise) {
    _firebaseAppPromise = (async () => {
      const { initializeApp } = await import(
        "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js"
      );
      return initializeApp(firebaseConfig);
    })();
  }
  return _firebaseAppPromise;
}

export async function getFirestore() {
  if (!_firestorePromise) {
    _firestorePromise = (async () => {
      const app = await getFirebase();
      const fs = await import(
        "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js"
      );
      return { db: fs.getFirestore(app), ...fs };
    })();
  }
  return _firestorePromise;
}

export async function getAuth() {
  const app = await getFirebase();
  const auth = await import(
    "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js"
  );
  return { auth: auth.getAuth(app), ...auth };
}

export async function getStorage() {
  const app = await getFirebase();
  const storage = await import(
    "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js"
  );
  return { storage: storage.getStorage(app), ...storage };
}

// ---------- Secondary app instances ----------
// Used to sign in as a *different* account (e.g. verifying an admin's
// password to authorize a cashier's void, or creating a new cashier
// account) without disturbing the primary session's currentUser.
export async function createSecondaryApp() {
  const { initializeApp } = await import(
    "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js"
  );
  const name = `secondary-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return initializeApp(firebaseConfig, name);
}

export async function getAuthForApp(app) {
  const auth = await import(
    "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js"
  );
  return { auth: auth.getAuth(app), ...auth };
}

export async function getFirestoreForApp(app) {
  const fs = await import(
    "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js"
  );
  return { db: fs.getFirestore(app), ...fs };
}

export async function destroySecondaryApp(app) {
  try {
    const { deleteApp } = await import(
      "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js"
    );
    await deleteApp(app);
  } catch (_) { /* best effort */ }
}

// ---------- Default data ----------
async function loadDefaults() {
  // Use a relative path from this script's location to find the JSON.
  // This is more robust than a hardcoded absolute path.
  const url = new URL("./data.default.json", import.meta.url);
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error("Could not load data.default.json");
  return res.json();
}

// Merge fetched config over defaults so missing fields don't crash the UI.
function mergeWithDefaults(defaults, remote) {
  if (!remote || typeof remote !== "object") return defaults;
  return {
    business: { ...defaults.business, ...(remote.business || {}) },
    links:    { ...defaults.links,    ...(remote.links    || {}) },
    hours:    { ...defaults.hours,    ...(remote.hours    || {}) },
    services: Array.isArray(remote.services) ? remote.services : defaults.services,
    gallery:  Array.isArray(remote.gallery)  ? remote.gallery  : defaults.gallery,
  };
}

// ---------- Public API ----------

/**
 * Subscribes to live data updates. Calls onData(data, source) immediately
 * with the cached/default value, then again whenever Firestore pushes a
 * change. Returns an unsubscribe function.
 */
export async function subscribeData(onData) {
  let unsubscribed = false;
  let unsubFirestore = null;

  // 1. Render cached data immediately if we have it.
  const cached = readCache();
  if (cached) onData(cached, "cache");

  // 2. Always load defaults so we have a fallback.
  let defaults;
  try {
    defaults = await loadDefaults();
  } catch (e) {
    defaults = {
      business: {}, links: {}, hours: {}, services: [], gallery: [],
    };
  }
  if (!cached) onData(defaults, "defaults");

  // 3. If Firebase is disabled, stop here.
  if (!FIREBASE_ENABLED) {
    return () => { unsubscribed = true; };
  }

  // 4. Subscribe to Firestore.
  try {
    const { db, doc, onSnapshot } = await getFirestore();
    if (unsubscribed) return () => {};
    unsubFirestore = onSnapshot(
      doc(db, "config", "site"),
      (snap) => {
        if (!snap.exists()) {
          onData(defaults, "defaults");
          return;
        }
        const merged = mergeWithDefaults(defaults, snap.data());
        writeCache(merged);
        onData(merged, "firestore");
      },
      (err) => {
        console.warn("[rcr] Firestore subscription error:", err.message);
      }
    );
  } catch (err) {
    console.warn("[rcr] Firebase init failed, staying on defaults:", err.message);
  }

  return () => {
    unsubscribed = true;
    if (unsubFirestore) unsubFirestore();
  };
}

/** One-shot read. Returns { data, fromRemote }. */
export async function fetchData() {
  const defaults = await loadDefaults();
  if (!FIREBASE_ENABLED) return { data: defaults, fromRemote: false };
  try {
    const { db, doc, getDoc } = await getFirestore();
    const snap = await getDoc(doc(db, "config", "site"));
    if (!snap.exists()) return { data: defaults, fromRemote: false };
    return { data: mergeWithDefaults(defaults, snap.data()), fromRemote: true };
  } catch (err) {
    console.warn("[rcr] fetchData fell back to defaults:", err.message);
    return { data: defaults, fromRemote: false };
  }
}

/** Returns the current defaults loaded from data.default.json. */
export async function getDefaults() {
  return loadDefaults();
}

/** Persist the entire config doc. Admin-only. */
export async function saveData(data) {
  if (!FIREBASE_ENABLED) {
    throw new Error("Firebase no está habilitado. Activa FIREBASE_ENABLED en firebase-config.js.");
  }
  const { db, doc, setDoc } = await getFirestore();
  await setDoc(doc(db, "config", "site"), data, { merge: false });
  writeCache(data);
}

// ---------- Cache ----------
function readCache() {
  try {
    const ts = parseInt(localStorage.getItem(CACHE_TS_KEY) || "0", 10);
    if (!ts || Date.now() - ts > CACHE_TTL_MS) return null;
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
  } catch { /* private mode, quota, etc. */ }
}
