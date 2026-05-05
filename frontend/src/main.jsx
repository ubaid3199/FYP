import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css'; // <-- KEEPING THIS SO IT DOESN'T LOOK LIKE 1995!
import { AuthProvider } from './context/AuthContext'; // 🔥 1. IMPORT THIS

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 🔥 2. WRAP YOUR APP IN THE PROVIDER */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);