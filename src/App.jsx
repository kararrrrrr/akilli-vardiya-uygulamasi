import { Routes, Route, Link } from 'react-router-dom';
import Register from './pages/Register'; // Oluşturduğumuz Kayıt Ol sayfası

// Ana sayfa için basit bir bileşen
const Home = () => <h2>Ana Sayfa</h2>;

function App() {
  return (
    <div>
      {/* Basit bir navigasyon menüsü */}
      <nav>
        <Link to="/">Ana Sayfa</Link> | <Link to="/register">Kayıt Ol</Link>
      </nav>

      <hr />

      {/* Rotaların tanımlandığı alan */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </div>
  );
}

export default App;
