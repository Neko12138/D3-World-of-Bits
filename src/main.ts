// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css"; // supporting style for Leaflet
import "./style.css"; // student-controlled page style

// Fix missing marker images (do not modify this file)
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
