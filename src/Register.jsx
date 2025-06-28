import { useState } from 'react';
// Firebase Authentication'dan kullanıcı oluşturma fonksiyonunu ve auth nesnemizi import ediyoruz
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase'; // Bir önceki adımda oluşturduğumuz firebase.js dosyasından

const Register = () => {
  // Formdaki e-posta ve şifre alanlarının değerlerini tutmak için state'ler oluşturuyoruz
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null); // Olası hataları göstermek için

  // Form gönderildiğinde çalışacak olan asenkron fonksiyon
  const handleRegister = async (e) => {
    e.preventDefault(); // Formun varsayılan davranışı olan sayfa yenilemeyi engelle
    setError(null); // Önceki hataları temizle

    try {
      // Firebase'in bize sağladığı fonksiyon ile yeni kullanıcı oluşturuyoruz
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("Kullanıcı başarıyla oluşturuldu:", user);
      alert("Kayıt başarılı!");
      // Burada kayıt sonrası giriş yap sayfasına yönlendirme yapabiliriz.
    } catch (error) {
      // Bir hata oluşursa, kullanıcıya bilgi veriyoruz
      console.error("Kayıt sırasında hata oluştu:", error.message);
      setError(error.message); // Hata mesajını state'e ata
      alert("Hata: " + error.message);
    }
  };

  return (
    <div>
      <h2>Kayıt Ol</h2>
      <form onSubmit={handleRegister}>
        <div>
          <label>E-posta:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Şifre:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength="6"
          />
        </div>
        <button type="submit">Kayıt Ol</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default Register;
