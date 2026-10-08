/**
 * store.js — data layer backed by Firebase Realtime Database + Auth.
 * Exposes the same Store API the UI uses, and sets window.Store so ui.js
 * (a classic script) can read it.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, set, update, remove, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCUJJRxAYfMZPNel5vcGlNUGVassrgXuXY",
  authDomain: "barangayborrowingsystem-82048.firebaseapp.com",
  databaseURL: "https://barangayborrowingsystem-82048-default-rtdb.firebaseio.com",
  projectId: "barangayborrowingsystem-82048",
  storageBucket: "barangayborrowingsystem-82048.firebasestorage.app",
  messagingSenderId: "41992388816",
  appId: "1:41992388816:web:9847dc4de4886876d61ed5"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  RETURNED: 'Returned',
  LOST: 'Lost/Damaged',
  REJECTED: 'Rejected',
};

const DEFAULT_ITEMS = [
  { name: 'Monoblock Chairs', icon: '🪑', total: 100, lost: 4 },
  { name: 'Collapsible Tents', icon: '⛺', total: 10, lost: 2 },
  { name: 'Wooden Tables', icon: '🪵', total: 5, lost: 1 },
];

let items = [];      // live cache (public can read)
let requests = [];   // live cache (admin only)
const listeners = [];
const notify = () => listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });

// Firebase keys can't contain . $ # [ ] /
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || ('item_' + Date.now());

function seedItems() {
  const obj = {};
  DEFAULT_ITEMS.forEach((it, i) => { obj[slug(it.name)] = { ...it, inUse: 0, order: i }; });
  return set(ref(db, 'items'), obj);
}

// Keep each item's "inUse" number up to date so the public page can show
// availability without being allowed to read the requests.
async function syncInUse(name) {
  const it = items.find((i) => i.name === name);
  if (!it) return;
  const n = requests
    .filter((r) => r.item === name && r.status === STATUS.APPROVED)
    .reduce((sum, r) => sum + r.qty, 0);
  if (n !== it.inUse) await update(ref(db, 'items/' + it.key), { inUse: n });
}

// ── Items: everyone can read ──
onValue(ref(db, 'items'), (snap) => {
  const val = snap.val() || {};
  items = Object.entries(val)
    .map(([key, v]) => ({ key, icon: '📦', inUse: 0, lost: 0, ...v }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  notify();
}, (err) => console.error('Items listener:', err));

// ── Requests: only while an admin is signed in ──
let unsubRequests = null;
onAuthStateChanged(auth, async (user) => {
  if (unsubRequests) { unsubRequests(); unsubRequests = null; }
  requests = [];
  if (user) {
    unsubRequests = onValue(ref(db, 'requests'), (snap) => {
      requests = Object.values(snap.val() || {})
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      notify();
    }, (err) => console.error('Requests listener:', err));
    try {
      const s = await get(ref(db, 'items'));
      if (!s.exists()) await seedItems();   // first run: create sample items
    } catch (e) { console.error(e); }
  }
  notify();
});

export const Store = {
  STATUS,
  onChange: (fn) => listeners.push(fn),

  // ── requests ──
  getRequests: () => requests,
  getRequest: (id) => requests.find((r) => r.id === id),

  async addRequest(data) {
    const id = 'REQ-' + Date.now().toString(36).toUpperCase();
    const req = { id, ...data, status: STATUS.PENDING, createdAt: new Date().toISOString() };
    try {
      await set(ref(db, 'requests/' + id), req);
      return req;
    } catch (e) {
      console.error('addRequest failed:', e);
      return null;
    }
  },

  async setStatus(id, status, extra = {}) {
    const r = requests.find((x) => x.id === id);
    if (!r) return null;
    await update(ref(db, 'requests/' + id), { status, ...extra });
    r.status = status;
    Object.assign(r, extra);
    await syncInUse(r.item);
    return r;
  },

  // ── items ──
  getItems: () => items,
  getItem: (name) => items.find((i) => i.name === name),

  addItem(name, total) {
    return set(ref(db, 'items/' + slug(name)), { name, icon: '📦', total, lost: 0, inUse: 0, order: Date.now() });
  },
  updateItem(index, { total, lost }) {
    const it = items[index];
    if (!it) return Promise.resolve();
    return update(ref(db, 'items/' + it.key), { total, lost });
  },

  // ── computed inventory ──
  inUse(name) {
    const it = items.find((i) => i.name === name);
    return it ? (it.inUse || 0) : 0;
  },
  available(item) {
    return item ? Math.max(0, item.total - item.lost - (item.inUse || 0)) : 0;
  },

  // ── admin auth (Firebase Authentication) ──
  async login(email, password) {
    try { await signInWithEmailAndPassword(auth, email, password); return true; }
    catch (e) { console.warn('Login failed:', e.code); return false; }
  },
  logout: () => signOut(auth),
  isAdmin: () => !!auth.currentUser,

  // ── maintenance ──
  async reset() {
    await remove(ref(db, 'requests'));
    await seedItems();
  },
};

window.Store = Store;   // so ui.js can use it
