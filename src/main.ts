// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import luck from "./_luck.ts"; // deterministic token generation

import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import "./style.css";

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

/* -------------------------- Persistence --------------------------*/
// load heldToken from session
let heldToken = Number(sessionStorage.getItem("heldToken") || 0);

function updateUI() {
  if (heldToken === 0) {
    statusPanelDiv.innerHTML = `<div>No Token</div>`;
  } else {
    statusPanelDiv.innerHTML =
      `<div>Token on Hand<br>Token: ${heldToken} Value: $${
        heldToken * TOKEN_VALUE
      }</div>`;
  }
}
updateUI();

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

/* -------------------------- Grid rendering with tokens --------------------------*/
interface TokenData {
  marker: leaflet.Marker | null;
  value: number;
  canPickup: boolean;
}

const tokenMarkers: Map<string, TokenData> = new Map();
let playerI = 0;
let playerJ = 0;
let _playerCellMarker: leaflet.Marker | null = null;

// load grid state from sessionStorage
const savedGrid = JSON.parse(sessionStorage.getItem("grid") || "{}") as Record<
  string,
  TokenData
>;

function drawGrid(): void {
  for (let i = -GRID_RADIUS; i <= GRID_RADIUS; i++) {
    for (let j = -GRID_RADIUS; j <= GRID_RADIUS; j++) {
      const lat1 = CLASSROOM_LATLNG.lat + i * CELL_SIZE;
      const lng1 = CLASSROOM_LATLNG.lng + j * CELL_SIZE;
      const lat2 = lat1 + CELL_SIZE;
      const lng2 = lng1 + CELL_SIZE;
      const bounds = leaflet.latLngBounds([[lat1, lng1], [lat2, lng2]]);
      const key = `${i},${j}`;

      const rect = leaflet.rectangle(bounds, {
        color: "#888",
        weight: 1,
        fillOpacity: 0.05,
      });
      rect.addTo(map);

      // restore or generate token
      let tokenData: TokenData;
      if (savedGrid[key]) {
        tokenData = savedGrid[key];
        if (tokenData.value > 0 && tokenData.marker === null) {
          const center = bounds.getCenter();
          const marker = leaflet.marker(center, {
            icon: leaflet.divIcon({
              className: "token-label",
              html:
                `<div style="font-size:12px;color:#d22;font-weight:bold;">${tokenData.value}</div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            }),
            interactive: false,
          }).addTo(map);
          tokenData.marker = marker;
        }
      } else {
        const roll = luck(`${i},${j},token`);
        const hasToken = roll < TOKEN_PROBABILITY;
        tokenData = {
          marker: null,
          value: hasToken ? 1 : 0,
          canPickup: true,
        };
        if (hasToken) {
          const center = bounds.getCenter();
          const marker = leaflet.marker(center, {
            icon: leaflet.divIcon({
              className: "token-label",
              html:
                `<div style="font-size:12px;color:#d22;font-weight:bold;">1</div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            }),
            interactive: false,
          }).addTo(map);
          tokenData.marker = marker;
        }
      }
      tokenMarkers.set(key, tokenData);

      // initial player location
      if (i === 0 && j === 0) {
        const center = bounds.getCenter();
        _playerCellMarker = leaflet.marker(center, {
          icon: leaflet.divIcon({
            className: "player-label",
            html: `<div style="font-size:14px;color:#00a;">🧍</div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          }),
          interactive: false,
        }).addTo(map);
      }

      // handle movement & token collection
      rect.on("click", () => {
        const distI = Math.abs(i - playerI);
        const distJ = Math.abs(j - playerJ);
        if (distI > INTERACTION_RADIUS || distJ > INTERACTION_RADIUS) return;

        playerI = i;
        playerJ = j;
        if (_playerCellMarker) map.removeLayer(_playerCellMarker);
        const center = bounds.getCenter();
        _playerCellMarker = leaflet.marker(center, {
          icon: leaflet.divIcon({
            className: "player-label",
            html: `<div style="font-size:14px;color:#00a;">🧍</div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          }),
          interactive: false,
        }).addTo(map);

        const data = tokenMarkers.get(key)!;
        if (heldToken === 0 && data.canPickup && data.value > 0) {
          heldToken = data.value;
          data.value = 0;
          data.canPickup = false;
          if (data.marker) map.removeLayer(data.marker);
          data.marker = null;
          updateUI();
          sessionStorage.setItem("heldToken", heldToken.toString());
        }

        // save grid state
        sessionStorage.setItem(
          "grid",
          JSON.stringify(Object.fromEntries(tokenMarkers)),
        );
      });

      rect.bindTooltip(`Cell (${i}, ${j})`, { permanent: false });
    }
  }
}

drawGrid();

/* -------------------------- Handle placing & merging --------------------------*/
addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  if (heldToken === 0) return;

  const key = `${playerI},${playerJ}`;
  const data = tokenMarkers.get(key)!;

  if (!data || data.value === 0) {
    const centerLat = CLASSROOM_LATLNG.lat + playerI * CELL_SIZE +
      CELL_SIZE / 2;
    const centerLng = CLASSROOM_LATLNG.lng + playerJ * CELL_SIZE +
      CELL_SIZE / 2;
    const center = leaflet.latLng(centerLat, centerLng);
    const newMarker = leaflet.marker(center, {
      icon: leaflet.divIcon({
        className: "token-label",
        html:
          `<div style="font-size:12px;color:#d22;font-weight:bold;">${heldToken}</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
      interactive: false,
    }).addTo(map);
    tokenMarkers.set(key, {
      marker: newMarker,
      value: heldToken,
      canPickup: false,
    });
    heldToken = 0;
    updateUI();
  } else if (data.value === heldToken) {
    data.value *= 2;
    data.canPickup = false;
    data.marker?.setIcon(
      leaflet.divIcon({
        className: "token-label",
        html:
          `<div style="font-size:12px;color:#d22;font-weight:bold;">${data.value}</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    );
    heldToken = 0;
    updateUI();
  }

  sessionStorage.setItem("heldToken", heldToken.toString());
  sessionStorage.setItem(
    "grid",
    JSON.stringify(Object.fromEntries(tokenMarkers)),
  );
});

/* -------------------------- Detect leaving cell for pickup --------------------------*/
let prevI = 0, prevJ = 0;
setInterval(() => {
  if (prevI !== playerI || prevJ !== playerJ) {
    const prevKey = `${prevI},${prevJ}`;
    if (tokenMarkers.has(prevKey)) {
      const data = tokenMarkers.get(prevKey)!;
      if (data.value > 0) data.canPickup = true;
    }
    prevI = playerI;
    prevJ = playerJ;
    sessionStorage.setItem(
      "grid",
      JSON.stringify(Object.fromEntries(tokenMarkers)),
    );
  }
}, 100);
