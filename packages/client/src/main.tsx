import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Set --app-height CSS variable to the actual visible viewport height.
// On Android, 100vh includes the system UI; window.innerHeight is the real value.
function setAppHeight() {
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
}
setAppHeight();
window.addEventListener('resize', setAppHeight);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
