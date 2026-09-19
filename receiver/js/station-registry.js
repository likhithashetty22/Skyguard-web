// receiver/js/station-registry.js
// =========================================================================================
// SkyGuard AI - Automatic Weather Station (AWS) Central Registry
// Manages real-time edge health judgments per weather station with localStorage persistence.
// =========================================================================================

const REGISTRY_STORAGE_KEY = 'skyguard_station_registry_v1';

const DEFAULT_STATION_METADATA = [
  { id: "agumbe", name: "Agumbe", lat: 13.505, lon: 75.092 },
  { id: "kottigehara", name: "Kottigehara", lat: 13.35, lon: 75.53 },
  { id: "kammaradi", name: "Kammaradi", lat: 13.40, lon: 75.60 },
  { id: "kalasa", name: "Kalasa", lat: 13.23, lon: 75.35 },
  { id: "bhagamandala", name: "Bhagamandala", lat: 12.40, lon: 75.53 }
];

// In-memory store of station judgments
let inMemoryRegistry = {};

// Hydrate from localStorage
function loadStoredRegistry() {
  try {
    const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
    if (raw) {
      inMemoryRegistry = JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[SkyGuard Registry] Failed to read from localStorage:', err);
  }
}
loadStoredRegistry();

function persistRegistry() {
  try {
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(inMemoryRegistry));
  } catch (err) {
    console.warn('[SkyGuard Registry] Failed to write to localStorage:', err);
  }
}

/**
 * Normalizes station identifier (e.g. "Agumbe" -> "agumbe")
 */
function normalizeStationId(station) {
  if (!station) return 'unknown';
  return String(station).trim().toLowerCase();
}

/**
 * Updates the health judgment for a station.
 * 
 * @param {string} stationIdOrName - Identifier or Name of the station
 * @param {Object} judgment - { status, confidence, rootCause, timestamp, decisionPath }
 */
export function updateStation(stationIdOrName, judgment) {
  if (!stationIdOrName || !judgment) return;

  const key = normalizeStationId(stationIdOrName);
  inMemoryRegistry[key] = {
    status: judgment.status || "unknown",
    confidence: judgment.confidence != null ? judgment.confidence : 0,
    rootCause: judgment.rootCause || "Nominal",
    timestamp: judgment.timestamp || new Date().toISOString(),
    decisionPath: judgment.decisionPath || []
  };

  persistRegistry();
}

/**
 * Loads stations metadata from shared/stations.json with resilient embedded fallback.
 */
async function loadBaseStations() {
  try {
    const res = await fetch('../shared/stations.json');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[SkyGuard Registry] fetch(stations.json) fallback:', err);
  }
  return DEFAULT_STATION_METADATA;
}

/**
 * Returns all stations merged with their latest known judgment.
 * 
 * @returns {Promise<Array<Object>>} Array of station objects with {id, name, lat, lon, status, confidence, rootCause, timestamp}
 */
export async function getAllStations() {
  loadStoredRegistry();
  const baseStations = await loadBaseStations();

  return baseStations.map(station => {
    const key = normalizeStationId(station.id);
    const altKey = normalizeStationId(station.name);
    const judgment = inMemoryRegistry[key] || inMemoryRegistry[altKey] || {
      status: "unknown",
      confidence: 0,
      rootCause: "Awaiting edge telemetry",
      timestamp: null,
      decisionPath: []
    };

    return {
      id: station.id,
      name: station.name,
      lat: station.lat,
      lon: station.lon,
      status: judgment.status,
      confidence: judgment.confidence,
      rootCause: judgment.rootCause,
      timestamp: judgment.timestamp,
      decisionPath: judgment.decisionPath
    };
  });
}

/**
 * Returns a single station merged with its latest judgment.
 * 
 * @param {string} stationId - Station ID or name
 * @returns {Promise<Object|null>}
 */
export async function getStation(stationId) {
  const all = await getAllStations();
  const targetKey = normalizeStationId(stationId);
  return all.find(s => normalizeStationId(s.id) === targetKey || normalizeStationId(s.name) === targetKey) || null;
}

/**
 * Clears stored registry judgments.
 */
export function clearStationRegistry() {
  inMemoryRegistry = {};
  try {
    localStorage.removeItem(REGISTRY_STORAGE_KEY);
  } catch (_) {}
}
