// Шрифты self-hosted, а не с Google CDN: игра идёт на полигоне со слабой связью,
// внешний CDN был бы лишней точкой отказа при старте. Fontsource режет файлы по
// unicode-range, поэтому браузер тянет только кириллицу и латиницу.
// Playfair в макете встречается ровно в одном весе — 900, остальные не грузим.
import '@fontsource-variable/manrope';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource/playfair-display/900.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { initTheme } from './stores/themeStore';

initTheme();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
