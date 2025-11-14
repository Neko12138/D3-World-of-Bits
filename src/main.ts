// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import luck from "./_luck.ts";

import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import "./style.css";

/* -------------------------- Control, Map, Status --------------------------*/
const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
document.body.append(controlPanelDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

/* -------------------------- Constants --------------------------*/
const ORIGIN_LATLNG = leaflet.latLng(0, 0);
const GAMEPLAY_ZOOM_LEVEL = 6;
const CELL_SIZE = 1;
const TOKEN_PROBABILITY = 0.25;
const TOKEN_VALUE = 5;
const CRAFTING_GOAL = 32;

/* -------------------------- Map --------------------------*/
const map = leaflet.map(mapDiv, {
  center: ORIGIN_LATLNG,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: true,
  scrollWheelZoom: true,
  dragging: true,
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
    <span>${
    heldToken === 0
      ? "No Token"
      : `Token: ${heldToken} ($${heldToken * TOKEN_VALUE})`
  }</span>
    <span>Press SPACE to place token</span>
    <span>Direction: ${selectedDirection ?? "-"}</span>
    <span>Steps: ${selectedSteps ?? "-"}</span>
  `;
}

/* -------------------------- Modified Cells --------------------------*/
interface CellState {
  value: number;
  canPickup: boolean;
}
const modifiedCells: Map<string, CellState> = new Map();
void modifiedCells;

/* -------------------------- Grid and Tokens --------------------------*/
interface TokenData {
  marker: leaflet.Marker | null;
  value: number;
  canPickup: boolean;
  rect: leaflet.Rectangle | undefined;
}
const tokenMarkers: Map<string, TokenData> = new Map();
let playerI = 0;
let playerJ = 0;
let _playerMarker: leaflet.Marker | null = null;

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

/* -------------------------- Crafting / Victory --------------------------*/
function checkVictory() {
  if (heldToken >= CRAFTING_GOAL) {
    alert(`🎉 Victory! You have collected ${heldToken} tokens!`);
  }
}

/* -------------------------- Grid Rendering --------------------------*/
function updateGrid() {
  const bounds = map.getBounds();
  const visibleRadiusLat = Math.ceil(
    (bounds.getNorth() - bounds.getSouth()) / CELL_SIZE / 2,
  );
  const visibleRadiusLng = Math.ceil(
    (bounds.getEast() - bounds.getWest()) / CELL_SIZE / 2,
  );
  const [centerI, centerJ] = latLngToCell(
    map.getCenter().lat,
    map.getCenter().lng,
  );

  const visibleKeys = new Set<string>();
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
      visibleKeys.add(`${i},${j}`);
    }
  }

  // Save state & remove out-of-view cells, reset for memoryless
  for (const [key, data] of tokenMarkers) {
    if (!visibleKeys.has(key)) {
      modifiedCells.set(key, { value: data.value, canPickup: data.canPickup });
      if (data.rect) map.removeLayer(data.rect);
      if (data.marker) map.removeLayer(data.marker);
      tokenMarkers.delete(key);
    }
  }

  // Render visible cells
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
      if (tokenMarkers.has(key)) continue;

      const cellBounds = cellToLatLng(i, j);
      const rect = leaflet.rectangle(cellBounds, {
        color: "#000",
        weight: 1,
        fillOpacity: 0.05,
      }).addTo(map);

      const restored = modifiedCells.get(key);
      const value: number = restored
        ? restored.value
        : (luck(`${i},${j},token`) < TOKEN_PROBABILITY ? 1 : 0);
      const canPickup: boolean = restored ? restored.canPickup : true;

      let marker: leaflet.Marker | null = null;
      if (value > 0) {
        marker = leaflet.marker(cellBounds.getCenter(), {
          icon: leaflet.divIcon({
            className: "token-label",
            html: `${value}`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          }),
          interactive: false,
        }).addTo(map);
      }

      tokenMarkers.set(key, { rect, marker, value, canPickup });
    }
  }

  return visibleKeys;
}

/* -------------------------- Player Marker --------------------------*/
function updatePlayerMarker() {
  const center = cellToLatLng(playerI, playerJ).getCenter();
  if (_playerMarker) map.removeLayer(_playerMarker);
  _playerMarker = leaflet.marker(center, {
    icon: leaflet.divIcon({
      className: "player-label",
      html: `🧍`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    }),
    interactive: false,
  }).addTo(map);

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

  const visibleKeys = updateGrid();
  updatePlayerMarker();

  const key = `${playerI},${playerJ}`;
  if (!visibleKeys.has(key)) return; // restrict interaction to nearby cells

  const data = tokenMarkers.get(key);
  if (data && data.value > 0) {
    heldToken += data.value;
    data.value = 0;
    if (data.marker) map.removeLayer(data.marker);
    data.marker = null;
    updateUI();
    checkVictory();
  }
}

/* -------------------------- Place Token --------------------------*/
addEventListener("keydown", (e) => {
  if (e.code !== "Space" || heldToken === 0) return;

  const visibleKeys = updateGrid();
  const key = `${playerI},${playerJ}`;
  if (!visibleKeys.has(key)) return; // restrict to nearby cells

  const data = tokenMarkers.get(key);
  const center = cellToLatLng(playerI, playerJ).getCenter();

  if (!data || data.value === 0) {
    const newMarker = leaflet.marker(center, {
      icon: leaflet.divIcon({
        className: "token-label",
        html: `${heldToken}`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
      interactive: false,
    }).addTo(map);
    tokenMarkers.set(key, {
      marker: newMarker,
      value: heldToken,
      canPickup: false,
      rect: undefined,
    });
    heldToken = 0;
  } else if (data.value === heldToken) {
    data.value *= 2;
    data.canPickup = false;
    data.marker?.setIcon(
      leaflet.divIcon({
        className: "token-label",
        html: `${data.value}`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    );
    heldToken = 0;
  }

  updateUI();
  sessionStorage.setItem("heldToken", heldToken.toString());
});

/* -------------------------- Map Move --------------------------*/
map.on("moveend", updateGrid);

/* -------------------------- Initial Render --------------------------*/
updateGrid();
updatePlayerMarker();
updateUI();
