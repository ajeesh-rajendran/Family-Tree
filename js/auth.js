/* ============================================
   auth.js — Admin Authentication
   ============================================ */

const Auth = (() => {
  // Default admin password: admin123
  // SHA-256 hash of "admin123"
  const ADMIN_HASH = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';

  async function sha256(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function isAdmin() {
    return sessionStorage.getItem('isAdmin') === 'true';
  }

  async function login(password) {
    const hash = await sha256(password);
    if (hash === ADMIN_HASH) {
      sessionStorage.setItem('isAdmin', 'true');
      return true;
    }
    return false;
  }

  function logout() {
    sessionStorage.removeItem('isAdmin');
  }

  return { isAdmin, login, logout };
})();
