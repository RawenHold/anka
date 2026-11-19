// A decorative map derived from the project’s existing GeoJSON; it does not draw a route.
import { readFile, writeFile } from 'node:fs/promises';

const geo = JSON.parse(await readFile(new URL('../data/us-states.geojson', import.meta.url), 'utf8'));
const project = ([lon, lat]) => `${((lon + 125) * 8).toFixed(1)},${((50 - lat) * 11).toFixed(1)}`;
const paths = geo.features.filter(({ properties }) => !['Alaska', 'Hawaii', 'Puerto Rico'].includes(properties.name)).flatMap(({ geometry }) => {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.map((polygon) => polygon.map((ring) => `M${ring.map(project).join(' L')} Z`).join(' '));
});
// These are approximate examples of the marked regions, not a connected route.
const points = [[-119.5,37.2],[-111.9,33.45],[-97.5,32.78],[-80.35,27.27]].map((point) => {
  const [x,y] = project(point).split(',');
  return `<circle cx="${x}" cy="${y}" r="7" fill="#aaff00"/><circle cx="${x}" cy="${y}" r="2.5" fill="#3b0929"/>`;
}).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 472 286"><g fill="#3b0929" stroke="#fc269f" stroke-width=".6">${paths.map((path) => `<path d="${path}"/>`).join('')}</g>${points}</svg>`;
await writeFile(new URL('../public/images/us-states-outline.svg', import.meta.url), svg);
