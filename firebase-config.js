// firebase-config.js
// Inisialisasi Firebase - compatible semua hosting

const firebaseConfig = {
  apiKey: "AIzaSyARk5TlUIp5-DMR48yeMcrDEGfpMHJhtyA",
  authDomain: "tabunganku-5c4e3.firebaseapp.com",
  projectId: "tabunganku-5c4e3",
  storageBucket: "tabunganku-5c4e3.firebasestorage.app",
  messagingSenderId: "34855006823",
  appId: "1:34855006823:web:a39f49e20a44938414dac2",
  measurementId: "G-MZJMCFQQTQ"
};

// Init Firebase - expose ke window supaya bisa diakses auth.js & app.js
window._fbApp  = firebase.initializeApp(firebaseConfig);
window._fbAuth = firebase.auth();
window._fbDb   = firebase.firestore();

console.log('%cFirebase connected ✅', 'color:#2563eb;font-weight:700');
