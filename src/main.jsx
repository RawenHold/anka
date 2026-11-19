import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/literata';
import '@fontsource-variable/manrope';
import '@fontsource-variable/exo-2';
import '@fontsource-variable/exo-2/wght-italic.css';
import App from './App.jsx';
import '../css/style.css';
import './site.css';
import 'leaflet/dist/leaflet.css';
import './concepts.css';
import './concept-album.css';
import './concept-neon.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
