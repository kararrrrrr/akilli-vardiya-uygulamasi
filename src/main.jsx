import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom' // Bu satırı ekle

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* App bileşenini BrowserRouter ile sarmala */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
