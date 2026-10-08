/**
 * store.js — data layer (Firebase Realtime Database).
 *
 * Same public API as before, so the rest of the app keeps working.
 * Reads are synchronous (from a live local cache); writes go to Firebase.
 * Firebase pushes changes to every open browser in real time.
 *
 * REQUIRED in your HTML, BEFORE store.js:
 *   <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js"></script>
 *   <script src="store.js"></script>
 *
 * In your page code, wait for data before the first render:
 *   Store.ready.then(render);
 *   Store.onChange(render);   // re-render whenever data changes (any device)
 */

const firebaseConfig = {
  apiKey: "AIzaSyCUJJRxAYfMZPNel5vcGlNUGVassrgXuXY",
  authDomain: "barangayborrowingsystem-82048.firebaseapp.com",
  databaseURL: "https://barangayborrowingsystem-82048-default-rtdb.firebaseio.com",
  projectId: "barangayborrowingsystem-82048",
  storageBucket: "barangayborrowingsystem-82048.firebasestorage.app",
  messagingSenderId: "41992388816",
  appId: "1:41992388816:web:9847dc4de4886876d61ed5",
  measurementId: "G-2YFR9CMZJK"
};

const Store = (() => {
  // Admin login. NOTE: this runs in the browser, so it only keeps casual visitors out.
  // Real security needs Firebase Authentication + database rules. Change these before use.
  const ADMIN = { username: 'admin', password: 'camptinio2024' };

  const STATUS = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    RETURNED: 'Returned',
    LOST: 'Lost/Damaged',
    REJECTED: 'Rejected',
  };

  // ── Firebase setup ──
  firebase.initializeApp(firebaseConfig);
  const root = firebase.database().ref('ebms-camptinio');

  function seed() {
    return {
      counter: 103,
      requests: [
        { id: 'REQ-102', name: 'Juan Dela Cruz', contact: '09171234567', item: 'Monoblock Chairs', qty: 20, purpose: 'Birthday party', dateNeeded: '2026-06-15', returnDate: '2026-06-16', idNum: 'VID-001', status: STATUS.APPROVED },
        { id: 'REQ-101', name: 'Maria Santos', contact: '09281234567', item: 'Collapsible Tents', qty: 2, purpose: 'Community event', dateNeeded: '2026-05-20', returnDate: '2026-05-21', idNum: 'VID-002', status: STATUS.APPROVED },
        { id: 'REQ-100', name: 'Maria De Cruz', contact: '09391234567', item: 'Monoblock Chairs', qty: 15, purpose: 'Graduation celebration', dateNeeded: '2026-05-10', returnDate: '2026-05-11', idNum: 'VID-003', status: STATUS.RETURNED },
        { id: 'REQ-99', name: 'Pedro Reyes', contact: '09501234567', item: 'Wooden Tables', qty: 3, purpose: 'Fiesta', dateNeeded: '2026-05-05', returnDate: '2026-05-06', idNum: 'VID-004', status: STATUS.PENDING },
        { id: 'REQ-98', name: 'Ana Garcia', contact: '09611234567', item: 'Monoblock Chairs', qty: 10, purpose: 'Wedding', dateNeeded: '2026-04-20', returnDate: '2026-04-21', idNum: 'VID-005', status: STATUS.PENDING },
        { id: 'REQ-97', name: 'Carlos Bautista', contact: '09721234567', item: 'Collapsible Tents', qty: 1, purpose: 'Company outing', dateNeeded: '2026-04-10', returnDate: '2026-04-11', idNum: 'VID-006', status: STATUS.LOST },
        { id: 'REQ-96', name: 'Maria De Cruz', contact: '09391234567', item: 'Monoblock Chairs', qty: 8, purpose: 'Community meeting', dateNeeded: '2026-05-10', returnDate: '2026-05-11', idNum: 'VID-003', status: STATUS.PENDING },
      ],
      // "lost" = quantity currently lost/damaged. "in use" is computed from Approved requests.
      items: [
        { name: 'Monoblock Chairs', icon: '🪑', total: 100, lost: 4 },
        { name: 'Collapsible Tents', icon: '⛺', total: 10, lost: 2 },
        { name: 'Wooden Tables', icon: '🪵', total: 5, lost: 1 },
      ],
    };
  }

  // ── conversion helpers (Firebase stores keyed objects, the app uses arrays) ──
  const clean = (obj) => JSON.parse(JSON.stringify(obj)); // Firebase rejects `undefined`
  const reqNum = (id) => parseInt(String(id).replace(/\D/g, ''), 10) || 0;

  function toDb(s) {
    const requests = {};
    s.requests.forEach((r) => { requests[r.id] = clean(r); });
    const items = {};
    s.items.forEach((it, i) => { items[i] = clean(it); });
    return { counter: s.counter, requests, items };
  }

  function fromDb(v) {
    const requests = Object.values(v.requests || {}).sort((a, b) => reqNum(b.id) - reqNum(a.id)); // newest first
    const itemsObj = v.items || {};
    const items = Object.keys(itemsObj)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => itemsObj[k]);
    return { counter: typeof v.counter === 'number' ? v.counter : 1, requests, items };
  }

  // ── state + change notifications ──
  let state = { counter: 1, requests: [], items: [] };
  const listeners = [];
  const notify = () => listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });

  const fail = (what) => (err) => console.error(`Firebase: could not ${what}.`, err);

  // Resolves after the first data load (or after a failure, using defaults).
  const ready = new Promise((resolve) => {
    let first = true;
    root.on(
      'value',
      (snap) => {
        const v = snap.val();
        if (!v) {
          // Empty database → upload starter data once. The listener fires again afterwards.
          root.set(toDb(seed())).catch(fail('seed database'));
          return;
        }
        state = fromDb(v);
        if (first) { first = false; resolve(); }
        notify();
      },
      (err) => {
        console.error('Firebase: could not read data (check database rules / network).', err);
        if (first) { first = false; state = seed(); resolve(); notify(); }
      }
    );
  });

  return {
    STATUS,
    ready,
    onChange: (fn) => { listeners.push(fn); },

    // ── requests ──
    getRequests: () => state.requests,
    getRequest: (id) => state.requests.find((r) => r.id === id),
    findRequest(query) {
      const q = String(query).trim().toLowerCase();
      return state.requests.find((r) => r.id.toLowerCase() === q || r.name.toLowerCase() === q);
    },
    addRequest(data) {
      const req = clean({ id: 'REQ-' + state.counter++, ...data, status: STATUS.PENDING });
      state.requests.unshift(req); // optimistic local update
      root
        .update({ ['requests/' + req.id]: req, counter: state.counter })
        .catch((e) => {
          fail('save request')(e);
          state.requests = state.requests.filter((r) => r.id !== req.id);
          state.counter--;
          notify();
        });
      return req;
    },
    setStatus(id, status, extra = {}) {
      const r = state.requests.find((x) => x.id === id);
      if (!r) return null;
      r.status = status;
      Object.assign(r, extra);
      root.child('requests/' + id).update(clean({ status, ...extra })).catch(fail('update status'));
      return r;
    },

    // ── items ──
    getItems: () => state.items,
    getItem: (name) => state.items.find((i) => i.name === name),
    addItem(name, total) {
      const item = { name, icon: '📦', total, lost: 0 };
      const index = state.items.length;
      state.items.push(item);
      root.child('items/' + index).set(item).catch(fail('add item'));
    },
    updateItem(index, { total, lost }) {
      const it = state.items[index];
      if (!it) return;
      it.total = total;
      it.lost = lost;
      root.child('items/' + index).update({ total, lost }).catch(fail('update item'));
    },

    // ── computed inventory ──
    inUse(name) {
      return state.requests
        .filter((r) => r.status === STATUS.APPROVED && r.item === name)
        .reduce((sum, r) => sum + r.qty, 0);
    },
    available(item) {
      return Math.max(0, item.total - item.lost - this.inUse(item.name));
    },

    // ── admin login ──
    checkLogin: (user, pass) => user === ADMIN.username && pass === ADMIN.password,

    // ── maintenance ──
    reset() {
      state = seed();
      root.set(toDb(state)).catch(fail('reset data'));
      notify();
    },
  };
})();
