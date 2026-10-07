/**
 * store.js — data layer.
 * All reads/writes go through the Store object, so when you add a real
 * database later you only need to change this file (see README.md).
 */

const Store = (() => {
  const KEY = 'ebms.camptinio.v1';

  // Admin login. NOTE: this runs in the browser, so it only keeps casual visitors out.
  // Real security needs a server/database (see README). Change these before use.
  const ADMIN = { username: 'admin', password: 'camptinio2024' };

  const STATUS = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    RETURNED: 'Returned',
    LOST: 'Lost/Damaged',
    REJECTED: 'Rejected',
  };

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

  function isValid(s) {
    return s && Array.isArray(s.requests) && Array.isArray(s.items) && typeof s.counter === 'number';
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValid(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Could not read saved data, using defaults.', e);
    }
    return seed();
  }

  let state = load();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('Could not save data.', e);
      return false;
    }
  }

  return {
    STATUS,

    // ── requests ──
    getRequests: () => state.requests,
    getRequest: (id) => state.requests.find((r) => r.id === id),
    findRequest(query) {
      const q = String(query).trim().toLowerCase();
      return state.requests.find((r) => r.id.toLowerCase() === q || r.name.toLowerCase() === q);
    },
    addRequest(data) {
      const req = { id: 'REQ-' + state.counter++, ...data, status: STATUS.PENDING };
      state.requests.unshift(req);
      if (!save()) {
        state.requests.shift();
        state.counter--;
        return null; // storage full
      }
      return req;
    },
    setStatus(id, status, extra = {}) {
      const r = state.requests.find((x) => x.id === id);
      if (!r) return null;
      r.status = status;
      Object.assign(r, extra);
      save();
      return r;
    },

    // ── items ──
    getItems: () => state.items,
    getItem: (name) => state.items.find((i) => i.name === name),
    addItem(name, total) {
      state.items.push({ name, icon: '📦', total, lost: 0 });
      save();
    },
    updateItem(index, { total, lost }) {
      const it = state.items[index];
      if (!it) return;
      it.total = total;
      it.lost = lost;
      save();
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
      save();
    },
  };
})();

