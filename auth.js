// auth.js
// Handle semua logic Google Authentication
// Tidak pakai ES Module - kompatibel semua hosting

const Auth = (() => {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  provider.setCustomParameters({ prompt: 'select_account' });

  // Set persistence - login tetap ada walau browser ditutup
  window._fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);

  // ===== LOGIN =====
  async function loginWithGoogle() {
    try {
      await window._fbAuth.signInWithPopup(provider);
    } catch (e) {
      if (e.code === 'auth/popup-blocked') {
        // Fallback ke redirect kalau popup diblokir
        try { await window._fbAuth.signInWithRedirect(provider); }
        catch (e2) { App.showToast('Login gagal: ' + e2.message, 'error', '❌'); }
      } else if (
        e.code !== 'auth/popup-closed-by-user' &&
        e.code !== 'auth/cancelled-popup-request'
      ) {
        App.showToast('Login gagal: ' + e.message, 'error', '❌');
      }
    }
  }

  // ===== LOGOUT =====
  async function logout() {
    await window._fbAuth.signOut();
    document.getElementById('app').style.display        = 'none';
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('fab').classList.remove('show');
  }

  // ===== GET USER INFO =====
  function getUserInfo(user) {
    if (!user) return null;
    return {
      uid:      user.uid,
      name:     user.displayName || 'User',
      email:    user.email || '',
      photoURL: user.photoURL || null,
      initial:  (user.displayName || 'U')[0].toUpperCase(),
    };
  }

  // ===== INIT OBSERVER =====
  function init(onLogin, onLogout) {
    // Cek hasil redirect (fallback dari popup blocked)
    window._fbAuth.getRedirectResult()
      .then(r => { if (r && r.user) console.log('Login via redirect:', r.user.displayName); })
      .catch(() => {});

    // Observer status login
    window._fbAuth.onAuthStateChanged(user => {
      if (user) { onLogin(user); }
      else       { onLogout();   }
    });
  }

  // Expose ke window
  return { loginWithGoogle, logout, getUserInfo, init };
})();

window.Auth = Auth;
