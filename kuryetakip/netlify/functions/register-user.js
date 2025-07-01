// netlify/functions/register-user.js
const admin = require('firebase-admin');

function initializeFirebaseAdmin() {
    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_SDK_CONFIG))
        });
    }
}

initializeFirebaseAdmin();
const db = admin.firestore();
const auth = admin.auth();

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    try {
        const data = JSON.parse(event.body);
        // DEĞİŞİKLİK: 'schoolName' yerine 'restaurantCode' ve yeni roller bekleniyor.
        const { email, password, phone, role, name, restaurantCode, vehiclePlate } = data;

        // Gerekli alanların kontrolü
        if (!email || !password || !phone || !role || !name || !restaurantCode) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Tüm zorunlu alanlar doldurulmalıdır.' }) };
        }
        if (role === 'courier' && !vehiclePlate) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Kurye için araç plakası zorunludur.' }) };
        }


        await db.runTransaction(async (transaction) => {
            // DEĞİŞİKLİK: 'schools' koleksiyonu yerine 'restaurants' koleksiyonu kullanılıyor.
            const restaurantRef = db.collection('restaurants').doc(restaurantCode);
            const restaurantDoc = await transaction.get(restaurantRef);

            if (!restaurantDoc.exists) {
                throw new Error('Geçersiz Restoran Kodu. Lütfen yöneticinizden aldığınız kodu doğru girdiğinizden emin olun.');
            }

            const restaurantData = restaurantDoc.data();

            // DEĞİŞİKLİK: Kontenjan kontrolü kuryeler için yapılıyor.
            if (role === 'courier') {
                const currentCourierCount = restaurantData.currentCourierCount || 0;
                const maxCouriers = restaurantData.maxCouriers || 0;
                if (currentCourierCount >= maxCouriers) {
                    throw new Error('Bu restoran için kurye kontenjanı dolu.');
                }
            }
            
            // Telefon ve e-posta'nın daha önce kayıtlı olup olmadığını kontrol et
            const phoneQuery = await db.collection('users').where('phone', '==', phone).limit(1).get();
            if (!phoneQuery.empty) {
                throw new Error('Bu telefon numarası zaten kayıtlı.');
            }
            try {
                await auth.getUserByEmail(email);
                throw new Error('Bu e-posta adresi zaten kullanılıyor.');
            } catch (error) {
                if (error.code !== 'auth/user-not-found') { throw error; }
            }

            // Firebase Auth üzerinde yeni kullanıcı oluştur
            const userRecord = await auth.createUser({
                email: email,
                password: password,
                displayName: name,
                emailVerified: false // E-posta doğrulaması isteyeceğiz
            });

            // Firestore'a kaydedilecek yeni kullanıcı verisi
            const userData = {
                name: name,
                phone: phone,
                email: email,
                role: role, // 'courier' veya 'admin'
                restaurantId: restaurantCode, // DEĞİŞİKLİK: 'schoolName' yerine 'restaurantId'
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                profileUpdateLastAt: null
            };

            // Role göre ek verileri ekle
            if (role === 'courier') {
                userData.vehiclePlate = vehiclePlate.toUpperCase();
                userData.activeDeliveryId = null;
                userData.currentLocation = null;
            }
            
            const userRef = db.collection('users').doc(userRecord.uid);
            transaction.set(userRef, userData);

            // DEĞİŞİKLİK: Rol'e göre restoran belgesini güncelle
            if (role === 'courier') {
                // Kurye ise sayacı artır
                transaction.update(restaurantRef, { 
                    currentCourierCount: admin.firestore.FieldValue.increment(1) 
                });
            } else if (role === 'admin') {
                // Yönetici ise admin listesine ekle
                transaction.update(restaurantRef, {
                    adminUids: admin.firestore.FieldValue.arrayUnion(userRecord.uid)
                });
            }
        });

        return {
            statusCode: 201,
            body: JSON.stringify({ message: 'Kayıt başarıyla oluşturuldu! Lütfen hesabınızı doğrulamak için e-postanızı kontrol edin.' })
        };

    } catch (error) {
        console.error('register-user fonksiyonunda hata:', error);
        const userFriendlyMessage = error.message.includes('Geçersiz Restoran Kodu') || error.message.includes('kontenjanı dolu') || error.message.includes('zaten kayıtlı') || error.message.includes('zaten kullanılıyor')
            ? error.message
            : 'Sunucuda bir hata oluştu. Lütfen daha sonra tekrar deneyin.';
        return { statusCode: 500, body: JSON.stringify({ message: userFriendlyMessage }) };
    }
};