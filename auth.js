// ============================================
// TabunganKu - auth.js
// Handle semua logic Google Authentication
// ============================================

import { auth } from './firebase-config.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// ===== PROVIDER =====
const provider = new GoogleAuthProvider();

// Tambahkan scope tambahan jika perlu
provider.addScope('profile');
provider.addScope('email');

// Custom parameter (opsional: paksa pilih akun tiap login)
provider.setCustomParameters({
  prompt: 'select_account'
});

// ===== SET PERSISTENCE =====
// browserLocalPersistence = login tetap tersimpan walau browser ditutup
setPersistence(auth, browserLocalPersistence).catch(console.error);

// ===== LOGIN DENGAN POPUP =====
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user   = result.user;
    console.log('%c✅ Login berhasil:', 'color:green;font-weight:bold', user.displayName);
    return { success: true, user };
  } catch (error) {
    // Handle error spesifik
    switch (error.code) {
      case 'auth/popup-blocked':
        // Fallback ke redirect kalau popup diblokir browser
        console.warn('Popup diblokir, mencoba redirect...');
        return loginWithRedirect();

      case 'auth/popup-closed-by-user':
        return { success: false, error: 'Login dibatalkan.' };

      case 'auth/cancelled-popup-request':
        return { success: false, error: 'Permintaan login dibatalkan.' };

      case 'auth/network-request-failed':
        return { success: false, error: 'Tidak ada koneksi internet.' };

      case 'auth/unauthorized-domain':
        return { success: false, error: 'Domain tidak diizinkan. Tambahkan domain ini di Firebase Console.' };

      default:
        console.error('Auth error:', error);
        return { success: false, error: error.message };
    }
  }
}

// ===== LOGIN DENGAN REDIRECT (fallback) =====
export async function loginWithRedirect() {
  try {
    await signInWithRedirect(auth, provider);
    return { success: true };
  } catch (error) {
    console.error('Redirect error:', error);
    return { success: false, error: error.message };
  }
}

// ===== CEK HASIL REDIRECT =====
// Dipanggil saat app pertama load, untuk handle hasil dari signInWithRedirect
export async function checkRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      console.log('%c✅ Login via redirect berhasil:', 'color:green;font-weight:bold', result.user.displayName);
      return { success: true, user: result.user };
    }
    return { success: false };
  } catch (error) {
    console.error('Redirect result error:', error);
    return { success: false, error: error.message };
  }
}

// ===== LOGOUT =====
export async function logoutUser() {
  try {
    await signOut(auth);
    console.log('%c👋 Logout berhasil', 'color:orange;font-weight:bold');
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: error.message };
  }
}

// ===== OBSERVER AUTH STATE =====
// Callback dipanggil tiap kali status login berubah
// onUserLogin  → dipanggil saat user berhasil login
// onUserLogout → dipanggil saat user logout / belum login
export function initAuthObserver(onUserLogin, onUserLogout) {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log('%c🔐 Auth state: Login sebagai', 'color:#2563eb;font-weight:bold', user.displayName);
      onUserLogin(user);
    } else {
      console.log('%c🔓 Auth state: Tidak ada user', 'color:#888;font-weight:bold');
      onUserLogout();
    }
  });
}

// ===== GET CURRENT USER =====
export function getCurrentUser() {
  return auth.currentUser;
}

// ===== CEK APAKAH USER SUDAH LOGIN =====
export function isLoggedIn() {
  return !!auth.currentUser;
}

// ===== GET USER INFO (helper) =====
export function getUserInfo(user) {
  if (!user) return null;
  return {
    uid:         user.uid,
    name:        user.displayName || 'User',
    email:       user.email || '',
    photoURL:    user.photoURL || null,
    initial:     (user.displayName || 'U')[0].toUpperCase(),
    provider:    user.providerData[0]?.providerId || 'google.com',
    createdAt:   user.metadata.creationTime,
    lastLogin:   user.metadata.lastSignInTime,
  };
}
