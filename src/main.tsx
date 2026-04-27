import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error("FATAL ERROR RENDERING APP:", error);
  rootElement.innerHTML = `<div style="padding: 20px; color: red;"><h1>Erro Fatal na Aplicação</h1><pre>${error}</pre></div>`;
}
