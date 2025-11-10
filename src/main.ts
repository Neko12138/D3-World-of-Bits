// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import luck from "./_luck.ts"; //deterministic token generation

// Style sheets
import "leaflet/dist/leaflet.css"; // supporting style for Leaflet
import "./style.css"; // student-controlled page style

// Fix missing marker images
import "./_leafletWorkaround.ts"; // fixes for missing Leaflet images

/* -------------------------- control, map, status --------------------------*/
const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
document.body.append(controlPanelDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

/* -------------------------- Constants / Gameplay params --------------------------*/
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

const GAMEPLAY_ZOOM_LEVEL = 19;

// Step 2 grid parameters
const CELL_SIZE = 0.0001; // degrees (~11m)
const GRID_RADIUS = 8; // how many cells outward from player
const TOKEN_PROBABILITY = 0.25; // chance a cell contains a token

/* -------------------------- Create Leaflet map (locked) --------------------------*/
const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LATLNG,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
  doubleClickZoom: false,
  boxZoom: false,
  touchZoom: false,
  dragging: false,
  keyboard: false,
});

/* -------------------------- Background tiles --------------------------*/
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

/* -------------------------- Player marker --------------------------*/
const playerMarker = leaflet.marker(CLASSROOM_LATLNG);
playerMarker.bindTooltip("That's you! (classroom)");
playerMarker.addTo(map);

/* -------------------------- Initial UI state --------------------------*/
let heldToken: number | null = null; // player holds at most one token
statusPanelDiv.innerHTML = `<div><strong>Held token:</strong> none</div>`;

/* -------------------------- Safe debug interface --------------------------*/
// Define an explicit type for our debug object
interface GameStateDebug {
  CLASSROOM_LATLNG: leaflet.LatLng;
  GAMEPLAY_ZOOM_LEVEL: number;
  getHeldToken: () => number | null;
  setHeldToken: (v: number | null) => void;
}

// Create a typed accessor for globalThis
const g = globalThis as typeof globalThis & {
  __GAME_STATE_DEBUG__?: GameStateDebug;
};

// Assign safely with correct type
g.__GAME_STATE_DEBUG__ = {
  CLASSROOM_LATLNG,
  GAMEPLAY_ZOOM_LEVEL,
  getHeldToken: () => heldToken,
  setHeldToken: (v: number | null) => {
    heldToken = v;
    statusPanelDiv.innerHTML = `<div><strong>Held token:</strong> ${
      v === null ? "none" : v
    }</div>`;
  },
};

/* -------------------------- Step 2: Grid rendering with tokens --------------------------*/
function drawGrid(): void {
  for (let i = -GRID_RADIUS; i <= GRID_RADIUS; i++) {
    for (let j = -GRID_RADIUS; j <= GRID_RADIUS; j++) {
      const lat1 = CLASSROOM_LATLNG.lat + i * CELL_SIZE;
      const lng1 = CLASSROOM_LATLNG.lng + j * CELL_SIZE;
      const lat2 = lat1 + CELL_SIZE;
      const lng2 = lng1 + CELL_SIZE;

      const bounds = leaflet.latLngBounds([[lat1, lng1], [lat2, lng2]]);

      // Draw a faint rectangle representing the cell
      const rect = leaflet.rectangle(bounds, {
        color: "#888",
        weight: 1,
        fillOpacity: 0.05,
      });

      rect.addTo(map);

      // deterministic token generation using luck()
      const roll = luck(`${i},${j},token`);
      const hasToken = roll < TOKEN_PROBABILITY; // 25% chance
      const tokenValue = hasToken ? Math.pow(2, Math.floor(roll * 4) + 1) : 0;

      // display token info directly on the cell if present
      if (hasToken) {
        const center = bounds.getCenter();
        leaflet
          .marker(center, {
            icon: leaflet.divIcon({
              className: "token-label",
              html:
                `<div style="font-size:10px;color:#d22;font-weight:bold;">${tokenValue}</div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            }),
            interactive: false,
          })
          .addTo(map);
      }

      // Optional tooltip to help debugging
      rect.bindTooltip(`Cell (${i}, ${j})`, { permanent: false });
    }
  }
}

// Draw grid when map is initialized
drawGrid();
