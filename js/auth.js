/* ============================================
   auth.js — Admin Authentication
   ============================================ */

const Auth = (() => {
  function isAdmin() {
    return sessionStorage.getItem('isAdmin') === 'true';
  }

  async function login(password) {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem('isAdmin', 'true');
        return true;
      }
    } catch (e) {
      console.error('Login failed:', e);
    }
    return false;
  }

  function logout() {
    sessionStorage.removeItem('isAdmin');
  }

  return { isAdmin, login, logout };
})();
