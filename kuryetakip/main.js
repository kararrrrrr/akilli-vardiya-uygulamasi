// main.js - KURYE TAKİP UYGULAMASI İÇİN TAM VE EKSİKSİZ SÜRÜM

// Gerekli Firebase kütüphanelerini içe aktar
import { initializeApp } from 'firebase/app';
import {
    getAuth, onAuthStateChanged, signInWithEmailAndPassword,
    signOut, sendPasswordResetEmail
} from "firebase/auth";
import {
    getFirestore, doc, onSnapshot, updateDoc, getDoc,
    collection, query, where, getDocs
} from "firebase/firestore";

// Sayfa tamamen yüklendiğinde ana fonksiyonu çalıştır
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. AYARLAR VE BAŞLATMA ---

    // Firebase ve Mapbox ayarlarınız, projenizdeki .env dosyasından otomatik olarak alınır.
    // Buraya manuel olarak bir şey yazmanıza GEREK YOKTUR.
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };
    const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

    // Firebase ve diğer servisleri başlat
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    // HTML'deki elemanları JavaScript'te kullanmak için değişkenlere ata
    const appHeader = document.getElementById('app-header');
    const authScreen = document.getElementById('auth-screen');
    const registerOptionsScreen = document.getElementById('register-options-screen');
    const courierRegisterScreen = document.getElementById('courier-register-screen');
    const courierPanel = document.getElementById('courier-panel');
    const adminPanel = document.getElementById('admin-panel');
    const loadingOverlay = document.getElementById('loading-overlay');
    const passwordResetScreen = document.getElementById('password-reset-screen');
    const mainContainer = document.querySelector('.container');
    const profileEditScreen = document.getElementById('profile-edit-screen');
    const profileToggleBtn = document.getElementById('profile-toggle-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const logoutBtn = document.getElementById('logout-btn');
    const logoSubtitle = document.getElementById('logo-subtitle');
    
    // Global Değişkenler (uygulama genelinde kullanılacak)
    let currentUser = null;
    let currentUserData = null;
    let mapInstances = {};
    let markerInstances = {};
    let firestoreListeners = [];

    const bodrumMilasBounds = [ [27.22, 36.9], [27.85, 37.35] ];

    // --- 2. YARDIMCI FONKSİYONLAR ---

    function showLoading() { loadingOverlay.classList.remove('hidden'); }
    function hideLoading() { loadingOverlay.classList.add('hidden'); }

    function showScreen(screen) {
        [authScreen, registerOptionsScreen, courierRegisterScreen, courierPanel, adminPanel, passwordResetScreen].forEach(s => s.classList.add('hidden'));
        appHeader.classList.add('hidden');
        profileDropdown.classList.add('hidden');

        if (screen) {
            const isFullScreen = screen === courierPanel || screen === adminPanel;
            if (isFullScreen) {
                mainContainer.classList.add('hidden');
                appHeader.classList.remove('hidden');
            } else {
                mainContainer.classList.remove('hidden');
            }
            screen.classList.remove('hidden');
        } else {
            mainContainer.classList.remove('hidden');
            authScreen.classList.remove('hidden');
        }
    }

    function updateHeaderForRole(role) {
        if (role === 'admin') {
            logoSubtitle.textContent = 'Yönetici Paneli';
            logoSubtitle.classList.remove('hidden');
        } else if (role === 'courier') {
            logoSubtitle.textContent = 'Kurye Paneli';
            logoSubtitle.classList.remove('hidden');
        } else {
            logoSubtitle.textContent = '';
            logoSubtitle.classList.add('hidden');
        }
    }
    
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<p>${message}</p>`;
        container.appendChild(toast);
        setTimeout(() => { toast.remove(); }, 6000);
    }
    
    function initMap(containerId, options = {}) {
        if (mapInstances[containerId] && mapInstances[containerId].getContainer()) {
            mapInstances[containerId].remove();
        }
        const map = new maplibregl.Map({
            container: containerId,
            style: `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`,
            center: options.center || [28.6650, 37.0098], // Ortaca merkez
            zoom: options.zoom || 9,
            maxBounds: bodrumMilasBounds, ...options
        });
        mapInstances[containerId] = map;
        return map;
    }

    function createOrUpdateMarker(markerId, lngLat, map, options = {}) {
        if (markerInstances[markerId]) {
            markerInstances[markerId].setLngLat(lngLat);
        } else {
            markerInstances[markerId] = new maplibregl.Marker({ color: options.color || '#0A84FF' })
                .setLngLat(lngLat)
                .addTo(map);
        }
        return markerInstances[markerId];
    }
    
    function cleanup() {
        firestoreListeners.forEach(unsubscribe => unsubscribe());
        firestoreListeners = [];
        Object.values(markerInstances).forEach(marker => marker.remove());
        markerInstances = {};
        Object.values(mapInstances).forEach(map => { if (map && map.getContainer()) map.remove(); });
        mapInstances = {};
        
        currentUser = null;
        currentUserData = null;
        updateHeaderForRole(null);
    }

    // --- 3. PANELLERİ KURAN FONKSİYONLAR ---

    function setupCourierPanel(userData) {
        showScreen(courierPanel);
        const center = userData.currentLocation ? [userData.currentLocation.longitude, userData.currentLocation.latitude] : [28.6650, 37.0098];
        const map = initMap('courier-map', { center, zoom: 14 });
        
        const userUnsubscribe = onSnapshot(doc(db, 'users', currentUser.uid), (doc) => {
            const updatedUserData = doc.data();
            if (updatedUserData && updatedUserData.currentLocation) {
                const newLngLat = [updatedUserData.currentLocation.longitude, updatedUserData.currentLocation.latitude];
                createOrUpdateMarker('courier_self', newLngLat, map, { color: '#FF3B30' });
                map.panTo(newLngLat);
            }
        });
        firestoreListeners.push(userUnsubscribe);
    }

    function setupAdminPanel(userData) {
        showScreen(adminPanel);
        const map = initMap('admin-map', { zoom: 11 });
        
        const couriersQuery = query(collection(db, 'users'), where('restaurantId', '==', userData.restaurantId), where('role', '==', 'courier'));
        const couriersUnsubscribe = onSnapshot(couriersQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                const courier = { id: change.doc.id, ...change.doc.data() };
                const markerId = `courier_${courier.id}`;

                if (change.type === "removed" && markerInstances[markerId]) {
                    markerInstances[markerId].remove();
                    delete markerInstances[markerId];
                    return;
                }
                
                if (courier.currentLocation) {
                    const lngLat = [courier.currentLocation.longitude, courier.currentLocation.latitude];
                    createOrUpdateMarker(markerId, lngLat, map, { color: courier.activeDeliveryId ? '#30D158' : '#8E8E93' });
                }
            });
        });
        firestoreListeners.push(couriersUnsubscribe);
    }

    // --- 4. ANA OTURUM YÖNETİMİ ---

    onAuthStateChanged(auth, async (user) => {
        cleanup();

        if (user) {
            showLoading();
            try {
                const userDocRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(userDocRef);

                if (!docSnap.exists()) throw new Error("Firestore kullanıcı verisi bulunamadı.");

                currentUser = user;
                currentUserData = { id: docSnap.id, ...docSnap.data() };
                updateHeaderForRole(currentUserData.role);
                
                if (currentUserData.role === 'courier') setupCourierPanel(currentUserData);
                else if (currentUserData.role === 'admin') setupAdminPanel(currentUserData);
                else throw new Error("Geçersiz kullanıcı rolü.");

            } catch (error) {
                showToast(error.message, 'error');
                signOut(auth);
            } finally {
                hideLoading();
            }
        } else {
            showScreen(authScreen);
            hideLoading();
        }
    });

    // --- 5. BUTON OLAYLARI (EVENT LISTENERS) ---

    // GİRİŞ EKRANI
    document.getElementById('login-btn').addEventListener('click', () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        if (!email || !password) return showToast('E-posta ve şifre alanları zorunludur.', 'error');
        showLoading();
        signInWithEmailAndPassword(auth, email, password)
            .catch(() => showToast('E-posta veya şifre hatalı.', 'error'))
            .finally(() => hideLoading());
    });
    
    document.getElementById('show-register-options').addEventListener('click', (e) => {
        e.preventDefault();
        showScreen(registerOptionsScreen);
    });

    document.getElementById('forgot-password-link').addEventListener('click', (e) => {
        e.preventDefault();
        showScreen(passwordResetScreen);
    });

    // KAYIT EKRANLARI
    document.getElementById('show-courier-register-btn').addEventListener('click', () => {
        showScreen(courierRegisterScreen);
    });

    document.getElementById('courier-register-btn').addEventListener('click', async () => {
        const payload = {
            role: 'courier',
            name: document.getElementById('courier-name').value,
            phone: document.getElementById('courier-phone').value,
            email: document.getElementById('courier-email').value,
            password: document.getElementById('courier-password').value,
            restaurantCode: document.getElementById('courier-institution-code').value,
            vehiclePlate: document.getElementById('courier-plate').value
        };

        if (Object.values(payload).some(v => !v)) return showToast('Tüm alanları doldurmalısınız.', 'error');

        try {
            await callNetlifyFunction('register-user', payload, true);
            showToast('Kayıt başarılı! Lütfen e-postanızı doğrulayın.', 'success');
            showScreen(authScreen);
        } catch (error) {
            showToast(`Kayıt başarısız: ${error.message}`, 'error');
        }
    });

    // ŞİFRE SIFIRLAMA EKRANI
    document.getElementById('send-reset-email-btn').addEventListener('click', async () => {
        const email = document.getElementById('reset-email').value;
        if (!email) return showToast('Lütfen e-posta adresinizi girin.', 'error');
        showLoading();
        try {
            await sendPasswordResetEmail(auth, email);
            showScreen(authScreen);
            showToast('Şifre sıfırlama e-postası gönderildi.', 'success');
        } catch (error) {
            showToast(`Bir hata oluştu: ${error.message}`, 'error');
        } finally {
            hideLoading();
        }
    });

    // PROFİL MENÜSÜ
    profileToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('hidden');
    });

    logoutBtn.addEventListener('click', (e) => { 
        e.preventDefault(); 
        signOut(auth); 
        showToast('Başarıyla çıkış yapıldı.'); 
    });
    
    // Geri dönme linkleri
    document.querySelectorAll('.back-to-login').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showScreen(authScreen);
        });
    });

    // Kurye panelindeki teslimat başlatma butonu
    const startDeliveryBtn = document.getElementById('start-delivery-btn');
    const customerPhoneInput = document.getElementById('customer-phone-input');

    if (startDeliveryBtn && customerPhoneInput) {
        startDeliveryBtn.addEventListener('click', () => {
            const customerPhone = customerPhoneInput.value;
            if (!customerPhone) return showToast('Lütfen müşteri telefon numarasını girin.', 'error');
            
            showToast('Teslimat başlatılıyor...', 'info');
            // BİR SONRAKİ ADIMDA BURAYI İŞLEVSEL HALE GETİRECEĞİZ
            console.log(`Teslimat ${customerPhone} için başlatılacak.`);
            customerPhoneInput.value = '';
        });
    }

    // --- SUNUCU FONKSİYONU ÇAĞIRMA ---
    // Bu fonksiyon, Netlify'daki backend kodlarımızı çağırmak için kullanılır.
    async function callNetlifyFunction(functionName, payload, isPublic = false, showLoader = true) {
        if (showLoader) showLoading();
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (!isPublic && currentUser) {
                const token = await currentUser.getIdToken();
                headers['Authorization'] = `Bearer ${token}`;
            }
            const response = await fetch(`/.netlify/functions/${functionName}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Bir sunucu hatası oluştu.');
            return data;
        } finally {
            if (showLoader) hideLoading();
        }
    }
});