import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize dark mode from localStorage before render to prevent flash
if (localStorage.getItem('theme') === 'dark') {
  document.documentElement.classList.add('dark');
}

// Register the service worker so the PWA can install and provide offline support.
// Do this after the first render so a registration failure never blocks the app.
const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
    void registration.update().catch(() => undefined);
  } catch (error) {
    console.error('Service Worker registration failed:', error);
  }
};

// Make default favicon rounded
function roundFavicon() {
  const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
  if (!link) return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const s = 32;
      const r = 8;
      const canvas = document.createElement('canvas');
      canvas.width = s; canvas.height = s;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(s - r, 0);
      ctx.quadraticCurveTo(s, 0, s, r);
      ctx.lineTo(s, s - r);
      ctx.quadraticCurveTo(s, s, s - r, s);
      ctx.lineTo(r, s);
      ctx.quadraticCurveTo(0, s, 0, s - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, 0, 0, s, s);
      link.href = canvas.toDataURL('image/png');
    } catch (e) { /* ignore */ }
  };
  img.src = link.href;
}
roundFavicon();

createRoot(document.getElementById("root")!).render(<App />);

if (document.readyState === 'complete') {
  void registerServiceWorker();
} else {
  window.addEventListener('load', () => void registerServiceWorker(), { once: true });
}
