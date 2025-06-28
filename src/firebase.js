// Firebase kütüphanesinden gerekli fonksiyonları import et
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Netlify'da tanımladığımız ortam değişkenlerini kullanarak Firebase'i yapılandır
// import.meta.env.VITE_... syntax'ı Vite'in bu değişkenleri okuma yöntemidir.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};

// Firebase uygulamasını başlat
const app = initializeApp(firebaseConfig);

// Diğer dosyalarda kullanmak üzere Firebase servislerini export et
export const db = getFirestore(app);
export const auth = getAuth(app);
