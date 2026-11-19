import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

// These are editorial markers reused from the existing archive map, not GPS points.
const coordinates = {
  Florida: [28.5, -82.0], California: [37.2, -119.5], Oregon: [44.0, -120.55], Washington: [47.4, -120.7],
  Arizona: [34.3, -111.7], Nevada: [39.3, -116.6], 'New Mexico': [34.5, -106.1], Texas: [31.5, -99.3],
  Oklahoma: [35.6, -97.5], Colorado: [39.0, -105.5], Utah: [39.3, -111.7], Montana: [47.0, -110.5],
  Tennessee: [35.8, -86.2], Georgia: [32.7, -83.5], 'New Jersey': [40.1, -74.6], 'New York': [42.9, -75.5],
  'North Carolina': [35.6, -79.8], 'South Carolina': [33.9, -80.9], Louisiana: [31.1, -91.9],
  Alabama: [32.8, -86.8], Missouri: [38.5, -92.5], Kansas: [38.5, -98.4], Iowa: [42.1, -93.5], Idaho: [44.2, -114.5],
  'Las Vegas': [36.17, -115.14], Sacramento: [38.58, -121.49], Cupertino: [37.32, -122.03],
  'Grand Canyon': [36.06, -112.14], Istanbul: [41.01, 28.98], Nassau: [25.05, -77.35],
};

export default function TravelMap({ places, selectedId, onSelect, theme }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const map = L.map(containerRef.current, {
      center: [38.2, -98.5],
      zoom: containerRef.current.clientWidth < 520 ? 3 : 4,
      minZoom: 3,
      maxZoom: 12,
      scrollWheelZoom: false,
      zoomControl: true,
    });
    mapRef.current = map;

    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    }).addTo(map);
    tiles.on('tileerror', () => setTileError(true));

    places.forEach((place) => {
      const point = coordinates[place.id] || coordinates[place.state];
      if (!point) return;
      const marker = L.circleMarker(point, {
        radius: 6,
        color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#a86643',
        weight: 2,
        fillColor: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#fff',
        fillOpacity: 1,
        bubblingMouseEvents: false,
      });
      marker.bindTooltip(place.ru, { direction: 'top', offset: [0, -7], opacity: 0.96 });
      marker.on('click', () => onSelect(place.id));
      marker.on('add', () => {
        const element = marker.getElement();
        if (!element) return;
        element.setAttribute('role', 'button');
        element.setAttribute('aria-label', `${place.id === place.state ? 'Штат ' : ''}${place.ru}. Показать выпуски`);
        element.setAttribute('tabindex', '0');
        element.setAttribute('focusable', 'true');
      });
      marker.on('keydown', (event) => {
        if (event.originalEvent.key === 'Enter' || event.originalEvent.key === ' ') {
          event.originalEvent.preventDefault();
          onSelect(place.id);
        }
      });
      marker.addTo(map);
      markersRef.current.set(place.id, marker);
    });

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    const timer = window.setTimeout(() => map.invalidateSize(), 100);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [places, onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#a86643';
    const surface = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#fff';
    markersRef.current.forEach((marker, placeId) => {
      const active = placeId === selectedId;
      marker.setStyle({ color: accent, fillColor: active ? accent : surface, radius: active ? 8 : 6, weight: active ? 3 : 2 });
      if (active) marker.bringToFront();
    });

    if (selectedId) {
      const point = coordinates[selectedId] || coordinates[places.find((place) => place.id === selectedId)?.state];
      if (point) map.flyTo(point, Math.max(map.getZoom(), 5), { duration: 0.55 });
    } else {
      map.flyTo([38.2, -98.5], map.getSize().x < 520 ? 3 : 4, { duration: 0.45 });
    }
  }, [selectedId, places, theme]);

  return (
    <div className="map-canvas-wrap">
      <div ref={containerRef} className="usa-map leaflet-map" role="application" aria-label="Карта мест, упомянутых в наших видео" />
      {tileError && <p className="map-status" role="status">Подложка карты не загрузилась. Выберите место в списке — выпуски останутся доступны.</p>}
    </div>
  );
}
