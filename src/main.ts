// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import luck from "./_luck.ts"; // deterministic token generation

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./_leafletWorkaround.ts";

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
const CELL_SIZE = 0.0001;
const GRID_RADIUS = 8;
const TOKEN_PROBABILITY = 0.25;
const INTERACTION_RADIUS = 3;
const TOKEN_VALUE = 5; // $5 per token

/* -------------------------- Create Leaflet map --------------------------*/
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
let heldToken = 0; // number of tokens
statusPanelDiv.innerHTML =
  `<div><strong>Tokens owned:</strong> ${heldToken} (Total: $${
    heldToken * TOKEN_VALUE
  })</div>`;

/* -------------------------- Grid rendering with tokens --------------------------*/
const tokenMarkers: Map<string, leaflet.Marker> = new Map();
let playerI = 0;
let playerJ = 0;
let _playerCellMarker: leaflet.Marker | null = null;

function drawGrid(): void {
  for (let i = -GRID_RADIUS; i <= GRID_RADIUS; i++) {
    for (let j = -GRID_RADIUS; j <= GRID_RADIUS; j++) {
      const lat1 = CLASSROOM_LATLNG.lat + i * CELL_SIZE;
      const lng1 = CLASSROOM_LATLNG.lng + j * CELL_SIZE;
      const lat2 = lat1 + CELL_SIZE;
      const lng2 = lng1 + CELL_SIZE;
      const bounds = leaflet.latLngBounds([[lat1, lng1], [lat2, lng2]]);

      const rect = leaflet.rectangle(bounds, {
        color: "#888",
        weight: 1,
        fillOpacity: 0.05,
      });
      rect.addTo(map);

      const roll = luck(`${i},${j},token`);
      const hasToken = roll < TOKEN_PROBABILITY;

      // token marker showing "1" only
      if (hasToken) {
        const center = bounds.getCenter();
        const tokenMarker = leaflet
          .marker(center, {
            icon: leaflet.divIcon({
              className: "token-label",
              html:
                `<div style="font-size:12px;color:#d22;font-weight:bold;">1</div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            }),
            interactive: false,
          })
          .addTo(map);
        tokenMarkers.set(`${i},${j}`, tokenMarker);
      }

      // initial player location
      if (i === 0 && j === 0) {
        const center = bounds.getCenter();
        _playerCellMarker = leaflet
          .marker(center, {
            icon: leaflet.divIcon({
              className: "player-label",
              html: `<div style="font-size:14px;color:#00a;">🧍</div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            }),
            interactive: false,
          })
          .addTo(map);
      }

      // handle movement & token collection
      rect.on("click", () => {
        const distI = Math.abs(i - playerI);
        const distJ = Math.abs(j - playerJ);
        if (distI > INTERACTION_RADIUS || distJ > INTERACTION_RADIUS) return;

        // move player
        playerI = i;
        playerJ = j;
        if (_playerCellMarker) map.removeLayer(_playerCellMarker);
        const center = bounds.getCenter();
        _playerCellMarker = leaflet
          .marker(center, {
            icon: leaflet.divIcon({
              className: "player-label",
              html: `<div style="font-size:14px;color:#00a;">🧍</div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            }),
            interactive: false,
          })
          .addTo(map);

        // collect token if player has none
        const key = `${i},${j}`;
        if (tokenMarkers.has(key) && heldToken === 0) {
          const marker = tokenMarkers.get(key)!;
          heldToken = 1; // pick up only one token
          statusPanelDiv.innerHTML =
            `<div><strong>Tokens owned:</strong> ${heldToken} (Total: $${
              heldToken * TOKEN_VALUE
            })</div>`;
          map.removeLayer(marker);
          tokenMarkers.delete(key);
        }
      });

      rect.bindTooltip(`Cell (${i}, ${j})`, { permanent: false });
    }
  }
}

drawGrid();
