// netlify/functions/start-delivery.js
const admin = require('firebase-admin');
const twilio = require('twilio');
const crypto = require('crypto'); // Benzersiz token üretmek için

// Firebase'i başlat (eğer başlatılmadıysa)
function initializeFirebaseAdmin() {
    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_SDK_CONFIG))
        });
    }
}
initializeFirebaseAdmin();
const db = admin.firestore();

// Twilio istemcisini başlat
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    try {
        // 1. Yetkilendirme: Fonksiyonu çağıran kullanıcının kimliğini doğrula
        const { authorization } = event.headers;
        if (!authorization || !authorization.startsWith('Bearer ')) {
            return { statusCode: 401, body: JSON.stringify({ message: 'Yetkilendirme başlığı eksik.' }) };
        }
        const token = authorization.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        const courierId = decodedToken.uid;

        // Kullanıcı verisini al
        const courierDoc = await db.collection('users').doc(courierId).get();
        if (!courierDoc.exists) {
            return { statusCode: 404, body: JSON.stringify({ message: 'Kurye bulunamadı.' }) };
        }
        const courierData = courierDoc.data();
        
        // Eğer kurye zaten bir teslimattaysa yeni bir tane başlatmasını engelle
        if (courierData.activeDeliveryId) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Mevcut bir teslimatı bitirmeden yenisini başlatamazsınız.' }) };
        }

        // 2. Gelen veriyi işle: Müşteri telefon numarasını al
        const { customerPhone } = JSON.parse(event.body);
        if (!customerPhone) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Müşteri telefon numarası gerekli.' }) };
        }

        // 3. Benzersiz Takip Linki Oluştur
        const trackingToken = crypto.randomBytes(20).toString('hex');
        const now = new Date();
        const expirationTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 saat sonrası

        // 4. Veritabanı İşlemleri (Transaction ile güvenli)
        const newDeliveryRef = db.collection('deliveries').doc(); // Yeni teslimat belgesi referansı
        const courierRef = db.collection('users').doc(courierId);

        await db.runTransaction(async (transaction) => {
            // Yeni teslimat belgesini oluştur
            transaction.set(newDeliveryRef, {
                courierId: courierId,
                courierName: courierData.name,
                customerPhone: customerPhone,
                status: 'active',
                startTime: admin.firestore.FieldValue.serverTimestamp(),
                courierLocation: courierData.currentLocation || null,
                trackingLink: {
                    token: trackingToken,
                    expiresAt: admin.firestore.Timestamp.fromDate(expirationTime)
                }
            });

            // Kuryenin durumunu "teslimatta" olarak güncelle
            transaction.update(courierRef, { activeDeliveryId: newDeliveryRef.id });
        });

        // 5. Müşteriye SMS Gönder
        const trackingUrl = `${process.env.NETLIFY_URL}/track?token=${trackingToken}`;
        const smsMessage = `Merhaba! Siparişiniz yola çıktı. Kuryenizi canlı olarak takip etmek için linke tıklayın: ${trackingUrl} (Link 1 saat geçerlidir)`;

        await twilioClient.messages.create({
            body: smsMessage,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: customerPhone // Müşterinin telefon numarası
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Teslimat başarıyla başlatıldı ve müşteriye SMS gönderildi.', deliveryId: newDeliveryRef.id })
        };

    } catch (error) {
        console.error('start-delivery fonksiyonunda hata:', error);
        // Twilio hata kodlarını daha anlaşılır gösterme
        if (error.code === 21211) {
             return { statusCode: 500, body: JSON.stringify({ message: 'SMS gönderilemedi: Geçersiz telefon numarası.' }) };
        }
        return { statusCode: 500, body: JSON.stringify({ message: 'Sunucuda bir hata oluştu: ' + error.message }) };
    }
};
