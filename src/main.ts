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
// Anchor the coordinate system at Null Island (0° latitude, 0° longitude)
const ORIGIN_LATLNG = leaflet.latLng(0, 0);
const GAMEPLAY_ZOOM_LEVEL = 4; // smaller zoom to show global area
const CELL_SIZE = 1; // 1 degree grid cell (suitable for global scale)
const TOKEN_PROBABILITY = 0.25;
const TOKEN_VALUE = 5; // $5 per token

/* -------------------------- Create Leaflet map --------------------------*/
const map = leaflet.map(mapDiv, {
  center: ORIGIN_LATLNG,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: true,
  scrollWheelZoom: true, // enable zoom with mouse wheel
  dragging: true, // enable map dragging
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 10,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

/* -------------------------- Persistence --------------------------*/
let heldToken = Number(sessionStorage.getItem("heldToken") || 0);
function updateUI() {
  statusPanelDiv.innerHTML = `
    <div>${
    heldToken === 0
      ? "No Token"
      : `Token on Hand: ${heldToken} ($${heldToken * TOKEN_VALUE})`
  }</div>
    <div>Press SPACE to place token</div>
    <div>Selected Direction: ${selectedDirection ?? "-"}</div>
    <div>Selected Steps: ${selectedSteps ?? "-"}</div>
  `;
}

/* -------------------------- Grid and Tokens --------------------------*/
interface TokenData {
  marker: leaflet.Marker | null;
  value: number;
  canPickup: boolean;
  rect?: leaflet.Rectangle;
}
const tokenMarkers: Map<string, TokenData> = new Map();
let playerI = 0;
let playerJ = 0;
let _playerMarker: leaflet.Marker | null = null;

// load saved grid
const savedGrid = JSON.parse(sessionStorage.getItem("grid") || "{}") as Record<
  string,
  TokenData
>;
for (const key in savedGrid) tokenMarkers.set(key, savedGrid[key]);

/* -------------------------- Coordinate Conversion --------------------------*/
function latLngToCell(lat: number, lng: number): [number, number] {
  const i = Math.floor((lat - ORIGIN_LATLNG.lat) / CELL_SIZE);
  const j = Math.floor((lng - ORIGIN_LATLNG.lng) / CELL_SIZE);
  return [i, j];
}

function cellToLatLng(i: number, j: number): leaflet.LatLngBounds {
  const lat1 = ORIGIN_LATLNG.lat + i * CELL_SIZE;
  const lng1 = ORIGIN_LATLNG.lng + j * CELL_SIZE;
  const lat2 = lat1 + CELL_SIZE;
  const lng2 = lng1 + CELL_SIZE;
  return leaflet.latLngBounds([[lat1, lng1], [lat2, lng2]]);
}

/* -------------------------- Dynamic Grid Rendering --------------------------*/
function updateGrid() {
  const bounds = map.getBounds();
  const visibleRadiusLat = Math.ceil(
    (bounds.getNorth() - bounds.getSouth()) / CELL_SIZE / 2,
  );
  const visibleRadiusLng = Math.ceil(
    (bounds.getEast() - bounds.getWest()) / CELL_SIZE / 2,
  );

  // Use the map center to determine which cells are visible.
  // This uses the latLngToCell helper so the function is actually referenced.
  const mapCenter = map.getCenter();
  const [mapCenterI, mapCenterJ] = latLngToCell(mapCenter.lat, mapCenter.lng);

  // You can choose to center grid on the map center (mapCenterI/mapCenterJ)
  // or on playerI/playerJ. Currently we prefer the map center so the grid
  // matches what the user currently sees.
  const centerI = mapCenterI;
  const centerJ = mapCenterJ;

  for (
    let i = centerI - visibleRadiusLat;
    i <= centerI + visibleRadiusLat;
    i++
  ) {
    for (
      let j = centerJ - visibleRadiusLng;
      j <= centerJ + visibleRadiusLng;
      j++
    ) {
      const key = `${i},${j}`;
      const cellBounds = cellToLatLng(i, j);

      if (tokenMarkers.get(key)?.rect) continue;

      // black grid border
      const rect = leaflet.rectangle(cellBounds, {
        color: "#000",
        weight: 1,
        fillOpacity: 0.05,
      }).addTo(map);

      if (!tokenMarkers.has(key)) {
        const hasToken = luck(`${i},${j},token`) < TOKEN_PROBABILITY;
        const tokenData: TokenData = {
          marker: null,
          value: hasToken ? 1 : 0,
          canPickup: true,
          rect,
        };
        if (hasToken) {
          const center = cellBounds.getCenter();
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
        tokenMarkers.set(key, tokenData);
      } else {
        tokenMarkers.get(key)!.rect = rect;
      }
    }
  }
}

/* -------------------------- Player Marker --------------------------*/
function updatePlayerMarker() {
  const center = cellToLatLng(playerI, playerJ).getCenter();
  if (_playerMarker) map.removeLayer(_playerMarker);
  _playerMarker = leaflet.marker(center, {
    icon: leaflet.divIcon({
      className: "player-label",
      html: `<div style="font-size:16px;color:#00a;">🧍</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    }),
    interactive: false,
  }).addTo(map);

  // recenter map after each move
  map.panTo(center);
}

/* -------------------------- Direction & Step Controls --------------------------*/
let selectedDirection: string | null = null;
let selectedSteps: number | null = null;

const directionDiv = document.createElement("div");
controlPanelDiv.append(directionDiv);
["North", "South", "East", "West"].forEach((dir) => {
  const btn = document.createElement("button");
  btn.textContent = dir;
  btn.addEventListener("click", () => {
    selectedDirection = dir;
    updateUI();
  });
  directionDiv.append(btn);
});

const stepsDiv = document.createElement("div");
controlPanelDiv.append(stepsDiv);
[1, 2, 3].forEach((step) => {
  const btn = document.createElement("button");
  btn.textContent = step.toString();
  btn.addEventListener("click", () => {
    selectedSteps = step;
    movePlayerSelected();
    selectedDirection = null;
    selectedSteps = null;
    updateUI();
  });
  stepsDiv.append(btn);
});

/* -------------------------- Move Player --------------------------*/
function movePlayerSelected() {
  if (!selectedDirection || !selectedSteps) return;

  switch (selectedDirection) {
    case "North":
      playerI -= selectedSteps;
      break;
    case "South":
      playerI += selectedSteps;
      break;
    case "East":
      playerJ += selectedSteps;
      break;
    case "West":
      playerJ -= selectedSteps;
      break;
  }

  updateGrid();
  updatePlayerMarker();

  // auto pickup token
  const key = `${playerI},${playerJ}`;
  const data = tokenMarkers.get(key);
  if (data && data.canPickup && data.value > 0 && heldToken === 0) {
    heldToken = data.value;
    data.value = 0;
    data.canPickup = false;
    if (data.marker) map.removeLayer(data.marker);
    data.marker = null;
    updateUI();
  }
}

/* -------------------------- Place Token --------------------------*/
addEventListener("keydown", (e) => {
  if (e.code !== "Space" || heldToken === 0) return;

  const key = `${playerI},${playerJ}`;
  const data = tokenMarkers.get(key);

  const center = cellToLatLng(playerI, playerJ).getCenter();

  if (!data || data.value === 0) {
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
  }

  updateUI();
  sessionStorage.setItem("heldToken", heldToken.toString());
  sessionStorage.setItem(
    "grid",
    JSON.stringify(Object.fromEntries(tokenMarkers)),
  );
});

/* -------------------------- Auto-pickup on leaving cell --------------------------*/
let prevI = 0, prevJ = 0;
setInterval(() => {
  if (prevI !== playerI || prevJ !== playerJ) {
    const key = `${prevI},${prevJ}`;
    const data = tokenMarkers.get(key);
    if (data && data.value > 0) data.canPickup = true;
    prevI = playerI;
    prevJ = playerJ;
    sessionStorage.setItem(
      "grid",
      JSON.stringify(Object.fromEntries(tokenMarkers)),
    );
  }
}, 100);

/* -------------------------- Update Grid on Map Move --------------------------*/
map.on("moveend", () => {
  updateGrid();
});

/* -------------------------- Initial Render --------------------------*/
updateGrid();
updatePlayerMarker();
updateUI();
