// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import luck from "./_luck.ts";

import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import "./style.css";

/* -------------------------- Types --------------------------*/
// Define cell state type for modified cells
interface CellState {
  value: number;
  canPickup: boolean;
}

// Token data stored per cell
interface TokenData {
  marker: leaflet.Marker | null;
  value: number;
  canPickup: boolean;
  rect: leaflet.Rectangle | undefined;
}

/* -------------------------- Movement Facade --------------------------*/
export interface IMovementController {
  start(): void;
  stop(): void;
  onMove(callback: (direction: string, steps: number) => void): void;
}

// Button-based movement controller
class ButtonMovementController implements IMovementController {
  private moveCallback: ((direction: string, steps: number) => void) | null =
    null;
  private directionButtons: HTMLButtonElement[] = [];
  private stepButtons: HTMLButtonElement[] = [];
  private directionDiv: HTMLElement;
  private stepsDiv: HTMLElement;

  constructor(directionDiv: HTMLElement, stepsDiv: HTMLElement) {
    this.directionDiv = directionDiv;
    this.stepsDiv = stepsDiv;
    this.initUI();
  }

  private initUI() {
    // Clear existing contents
    this.directionDiv.innerHTML = "";
    this.stepsDiv.innerHTML = "";

    // Create direction buttons
    ["North", "South", "East", "West"].forEach((dir) => {
      const btn = document.createElement("button");
      btn.textContent = dir;
      btn.classList.add("movement-dir-btn");
      this.directionDiv.append(btn);
      this.directionButtons.push(btn);
    });

    // Create step buttons
    [1, 2, 3].forEach((step) => {
      const btn = document.createElement("button");
      btn.textContent = String(step);
      btn.classList.add("movement-step-btn");
      this.stepsDiv.append(btn);
      this.stepButtons.push(btn);
    });
  }

  start() {
    // Enable and wire buttons
    this.directionButtons.forEach((btn) => {
      btn.disabled = false;
      btn.onclick = () => {
        this.directionButtons.forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
      };
    });

    this.stepButtons.forEach((btn) => {
      btn.disabled = false;
      btn.onclick = () => {
        const steps = Number(btn.textContent);
        const sel = this.directionButtons.find((b) =>
          b.classList.contains("selected")
        );
        if (!sel) return;
        const direction = sel.textContent!;
        if (this.moveCallback) this.moveCallback(direction, steps);
        sel.classList.remove("selected");
      };
    });
  }

  stop() {
    // Disable all buttons
    this.directionButtons.forEach((btn) => {
      btn.disabled = true;
      btn.onclick = null;
    });
    this.stepButtons.forEach((btn) => {
      btn.disabled = true;
      btn.onclick = null;
    });
  }

  onMove(callback: (direction: string, steps: number) => void) {
    this.moveCallback = callback;
  }
}

// Real-world movement controller using Geolocation API
class GeoMovementController implements IMovementController {
  private moveCallback: ((direction: string, steps: number) => void) | null =
    null;
  private watchId: number | null = null;
  private lastPos: GeolocationPosition | null = null;

  start() {
    if (!navigator.geolocation) return;

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!this.lastPos) {
          this.lastPos = pos;
          // Initialize player position to real-world location
          const [i, j] = latLngToCell(
            pos.coords.latitude,
            pos.coords.longitude,
          );
          playerI = i;
          playerJ = j;
          updatePlayerMarker();
          updateGrid();
          return;
        }

        const dx = pos.coords.latitude - this.lastPos.coords.latitude;
        const dy = pos.coords.longitude - this.lastPos.coords.longitude;

        // Threshold to filter GPS jitter
        const threshold = 1e-5;
        if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;

        // Scale small GPS delta to game steps
        const LAT_TO_STEP = 100000; // adjust factor to map small lat/lng changes to steps
        const deltaI = Math.round(dx * LAT_TO_STEP);
        const deltaJ = Math.round(dy * LAT_TO_STEP);

        // Decide direction
        if (Math.abs(dx) > Math.abs(dy)) {
          if (deltaI !== 0 && this.moveCallback) {
            this.moveCallback(deltaI > 0 ? "South" : "North", Math.abs(deltaI));
          }
        } else {
          if (deltaJ !== 0 && this.moveCallback) {
            this.moveCallback(deltaJ > 0 ? "East" : "West", Math.abs(deltaJ));
          }
        }

        this.lastPos = pos;
      },
      (err) => console.warn("Geolocation error:", err),
      {
        enableHighAccuracy: false,
        maximumAge: 1000,
        timeout: 5000,
      },
    );
  }

  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.lastPos = null;
  }

  onMove(callback: (direction: string, steps: number) => void) {
    this.moveCallback = callback;
  }
}

// Facade for switching between movement controllers
class MovementFacade {
  private controller: IMovementController;
  private callbacks: ((direction: string, steps: number) => void)[] = [];

  constructor(controller: IMovementController) {
    this.controller = controller;
    this.controller.onMove((dir, steps) => {
      this.callbacks.forEach((cb) => cb(dir, steps));
    });
  }

  start() {
    this.controller.start();
  }

  stop() {
    this.controller.stop();
  }

  onMove(callback: (direction: string, steps: number) => void) {
    this.callbacks.push(callback);
  }

  replaceController(newController: IMovementController) {
    this.stop();
    this.controller = newController;
    this.controller.onMove((dir, steps) => {
      this.callbacks.forEach((cb) => cb(dir, steps));
    });
    this.start();
    movementMode = newController instanceof GeoMovementController
      ? "geo"
      : "button";
    saveState();
  }
}

/* -------------------------- DOM Elements --------------------------*/
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

/* -------------------------- Map Setup --------------------------*/
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

/* -------------------------- Game State --------------------------*/
let playerI = 0;
let playerJ = 0;
let heldToken = 0;
let modifiedCells: Map<string, CellState> = new Map();
let movementMode: "geo" | "button" = "geo"; // default mode
let _playerMarker: leaflet.Marker | null = null;

// Save current game state to localStorage
function saveState() {
  const cellsObj: Record<string, CellState> = {};
  modifiedCells.forEach((v, k) => (cellsObj[k] = v));
  const state = {
    playerI,
    playerJ,
    heldToken,
    modifiedCells: cellsObj,
    movementMode,
  };
  localStorage.setItem("gameState", JSON.stringify(state));
}

// Load state from localStorage
function loadState() {
  const stateStr = localStorage.getItem("gameState");
  if (!stateStr) return;
  try {
    const state = JSON.parse(stateStr);
    playerI = state.playerI;
    playerJ = state.playerJ;
    heldToken = state.heldToken;
    movementMode = state.movementMode || "geo";
    modifiedCells = new Map(Object.entries(state.modifiedCells));
  } catch {
    console.warn("Failed to parse saved state.");
  }
}

/* -------------------------- UI --------------------------*/
let lastDirectionShown: string | null = null;
let lastStepsShown: number | null = null;

function updateUI() {
  statusPanelDiv.innerHTML = `
    <span>${
    heldToken === 0
      ? "No Token"
      : `Token: ${heldToken} ($${heldToken * TOKEN_VALUE})`
  }</span>
    <span>Press SPACE to place token</span>
    <span>Direction: ${lastDirectionShown ?? "-"}</span>
    <span>Steps: ${lastStepsShown ?? "-"}</span>
  `;
}

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
const tokenMarkers: Map<string, TokenData> = new Map();

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

  // Remove out-of-view cells & save state
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
        : luck(`${i},${j},token`) < TOKEN_PROBABILITY
        ? 1
        : 0;
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

/* -------------------------- Movement integration --------------------------*/
function handleMove(direction: string, steps: number) {
  lastDirectionShown = direction;
  lastStepsShown = steps;
  updateUI();

  switch (direction) {
    case "North":
      playerI -= steps;
      break;
    case "South":
      playerI += steps;
      break;
    case "East":
      playerJ += steps;
      break;
    case "West":
      playerJ -= steps;
      break;
  }

  const visibleKeys = updateGrid();
  updatePlayerMarker();

  const key = `${playerI},${playerJ}`;
  if (!visibleKeys.has(key)) return;

  const data = tokenMarkers.get(key);
  if (data && data.value > 0 && data.canPickup) {
    heldToken += data.value;
    data.value = 0;
    if (data.marker) map.removeLayer(data.marker);
    data.marker = null;
    updateUI();
    checkVictory();
  }

  saveState();
}

/* -------------------------- Initialize Controllers & Facade --------------------------*/
const directionDiv = document.createElement("div");
const stepsDiv = document.createElement("div");
controlPanelDiv.append(directionDiv);
controlPanelDiv.append(stepsDiv);

const buttonController = new ButtonMovementController(directionDiv, stepsDiv);
const geoController = new GeoMovementController();

const facade = new MovementFacade(geoController);
facade.onMove((dir, steps) => handleMove(dir, steps));

loadState();

// Start correct controller
facade.replaceController(
  movementMode === "geo" ? geoController : buttonController,
);

/* -------------------------- Control Switch --------------------------*/
const switchBtn = document.createElement("button");
switchBtn.textContent = "Switch Control";
switchBtn.onclick = () => {
  if (facade["controller"] instanceof GeoMovementController) {
    facade.replaceController(buttonController);
  } else {
    facade.replaceController(geoController);
  }
};
controlPanelDiv.append(switchBtn);

/* -------------------------- New Game Button --------------------------*/
const newGameBtn = document.createElement("button");
newGameBtn.textContent = "New Game";
newGameBtn.onclick = () => {
  if (
    !confirm(
      "Are you sure you want to start a new game? This will erase your current progress.",
    )
  ) return;

  // Clear localStorage
  localStorage.removeItem("gameState");

  // Reset game state
  playerI = 0;
  playerJ = 0;
  heldToken = 0;
  modifiedCells.clear();
  tokenMarkers.forEach((data) => {
    if (data.marker) map.removeLayer(data.marker);
    if (data.rect) map.removeLayer(data.rect);
  });
  tokenMarkers.clear();

  // Reset movement mode to default
  movementMode = "geo";
  facade.replaceController(geoController);

  // Re-render grid and player
  updateGrid();
  updatePlayerMarker();
  updateUI();
};
controlPanelDiv.append(newGameBtn);

/* -------------------------- Place Token --------------------------*/
addEventListener("keydown", (e) => {
  if (e.code !== "Space" || heldToken === 0) return;

  const visibleKeys = updateGrid();
  const key = `${playerI},${playerJ}`;
  if (!visibleKeys.has(key)) return;

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
  saveState();
});

/* -------------------------- Map Move --------------------------*/
map.on("moveend", updateGrid);

/* -------------------------- Initial Render --------------------------*/
updateGrid();
updatePlayerMarker();
updateUI();
