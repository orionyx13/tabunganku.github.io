// firebase-config.js
// Konfigurasi Firebase TabunganKu

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyARk5TlUIp5-DMR48yeMcrDEGfpMHJhtyA",
  authDomain: "tabunganku-5c4e3.firebaseapp.com",
  projectId: "tabunganku-5c4e3",
  storageBucket: "tabunganku-5c4e3.firebasestorage.app",
  messagingSenderId: "34855006823",
  appId: "1:34855006823:web:a39f49e20a44938414dac2",
  measurementId: "G-MZJMCFQQTQ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

