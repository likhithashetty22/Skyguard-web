// sender/js/stations-data.js
// Loads station metadata and 24-hour datasets from shared/

export const DEFAULT_STATIONS = [
  { id: "agumbe", name: "Agumbe", lat: 13.505, lon: 75.092 },
  { id: "kottigehara", name: "Kottigehara", lat: 13.35, lon: 75.53 },
  { id: "kammaradi", name: "Kammaradi", lat: 13.40, lon: 75.60 },
  { id: "kalasa", name: "Kalasa", lat: 13.23, lon: 75.35 },
  { id: "bhagamandala", name: "Bhagamandala", lat: 12.40, lon: 75.53 }
];

// Fallback seed data in case browser security restrictions (e.g. file:// in Chrome) block fetch()
const FALLBACK_DATASETS = {
  agumbe: [
    { timestamp: "2026-09-01T00:00:00", temp: 21.8, humidity: 94, pressure: 1011.2 },
    { timestamp: "2026-09-01T01:00:00", temp: 21.5, humidity: 95, pressure: 1011.0 },
    { timestamp: "2026-09-01T02:00:00", temp: 21.2, humidity: 96, pressure: 1010.8 },
    { timestamp: "2026-09-01T03:00:00", temp: 21.0, humidity: 96, pressure: 1010.5 },
    { timestamp: "2026-09-01T04:00:00", temp: 20.8, humidity: 97, pressure: 1010.4 },
    { timestamp: "2026-09-01T05:00:00", temp: 20.6, humidity: 98, pressure: 1010.7 },
    { timestamp: "2026-09-01T06:00:00", temp: 21.0, humidity: 96, pressure: 1011.3 },
    { timestamp: "2026-09-01T07:00:00", temp: 21.9, humidity: 93, pressure: 1011.9 },
    { timestamp: "2026-09-01T08:00:00", temp: 22.8, humidity: 90, pressure: 1012.4 },
    { timestamp: "2026-09-01T09:00:00", temp: 23.6, humidity: 87, pressure: 1012.8 },
    { timestamp: "2026-09-01T10:00:00", temp: 24.3, humidity: 84, pressure: 1012.6 },
    { timestamp: "2026-09-01T11:00:00", temp: 24.8, humidity: 82, pressure: 1012.1 },
    { timestamp: "2026-09-01T12:00:00", temp: 25.1, humidity: 80, pressure: 1011.5 },
    { timestamp: "2026-09-01T13:00:00", temp: 25.0, humidity: 81, pressure: 1010.9 },
    { timestamp: "2026-09-01T14:00:00", temp: 24.5, humidity: 83, pressure: 1010.3 },
    { timestamp: "2026-09-01T15:00:00", temp: 24.0, humidity: 85, pressure: 1010.2 },
    { timestamp: "2026-09-01T16:00:00", temp: 23.4, humidity: 88, pressure: 1010.5 },
    { timestamp: "2026-09-01T17:00:00", temp: 22.9, humidity: 90, pressure: 1010.9 },
    { timestamp: "2026-09-01T18:00:00", temp: 22.5, humidity: 92, pressure: 1011.4 },
    { timestamp: "2026-09-01T19:00:00", temp: 22.2, humidity: 93, pressure: 1011.8 },
    { timestamp: "2026-09-01T20:00:00", temp: 22.0, humidity: 94, pressure: 1012.0 },
    { timestamp: "2026-09-01T21:00:00", temp: 21.8, humidity: 95, pressure: 1012.1 },
    { timestamp: "2026-09-01T22:00:00", temp: 21.6, humidity: 95, pressure: 1011.9 },
    { timestamp: "2026-09-01T23:00:00", temp: 21.4, humidity: 96, pressure: 1011.6 }
  ],
  kottigehara: [
    { timestamp: "2026-09-01T00:00:00", temp: 20.2, humidity: 92, pressure: 1012.1 },
    { timestamp: "2026-09-01T01:00:00", temp: 19.9, humidity: 93, pressure: 1011.8 },
    { timestamp: "2026-09-01T02:00:00", temp: 19.6, humidity: 94, pressure: 1011.5 },
    { timestamp: "2026-09-01T03:00:00", temp: 19.3, humidity: 95, pressure: 1011.2 },
    { timestamp: "2026-09-01T04:00:00", temp: 19.1, humidity: 95, pressure: 1011.0 },
    { timestamp: "2026-09-01T05:00:00", temp: 19.0, humidity: 96, pressure: 1011.4 },
    { timestamp: "2026-09-01T06:00:00", temp: 19.5, humidity: 94, pressure: 1012.0 },
    { timestamp: "2026-09-01T07:00:00", temp: 20.4, humidity: 90, pressure: 1012.6 },
    { timestamp: "2026-09-01T08:00:00", temp: 21.6, humidity: 86, pressure: 1013.1 },
    { timestamp: "2026-09-01T09:00:00", temp: 22.8, humidity: 82, pressure: 1013.4 },
    { timestamp: "2026-09-01T10:00:00", temp: 23.9, humidity: 78, pressure: 1013.0 },
    { timestamp: "2026-09-01T11:00:00", temp: 24.7, humidity: 75, pressure: 1012.5 },
    { timestamp: "2026-09-01T12:00:00", temp: 25.2, humidity: 73, pressure: 1011.9 },
    { timestamp: "2026-09-01T13:00:00", temp: 25.4, humidity: 72, pressure: 1011.3 },
    { timestamp: "2026-09-01T14:00:00", temp: 24.9, humidity: 74, pressure: 1010.8 },
    { timestamp: "2026-09-01T15:00:00", temp: 24.2, humidity: 77, pressure: 1010.7 },
    { timestamp: "2026-09-01T16:00:00", temp: 23.5, humidity: 80, pressure: 1011.0 },
    { timestamp: "2026-09-01T17:00:00", temp: 22.7, humidity: 84, pressure: 1011.5 },
    { timestamp: "2026-09-01T18:00:00", temp: 22.0, humidity: 87, pressure: 1012.0 },
    { timestamp: "2026-09-01T19:00:00", temp: 21.4, humidity: 89, pressure: 1012.4 },
    { timestamp: "2026-09-01T20:00:00", temp: 21.0, humidity: 90, pressure: 1012.7 },
    { timestamp: "2026-09-01T21:00:00", temp: 20.7, humidity: 91, pressure: 1012.8 },
    { timestamp: "2026-09-01T22:00:00", temp: 20.5, humidity: 91, pressure: 1012.5 },
    { timestamp: "2026-09-01T23:00:00", temp: 20.3, humidity: 92, pressure: 1012.3 }
  ],
  kammaradi: [
    { timestamp: "2026-09-01T00:00:00", temp: 22.0, humidity: 88, pressure: 1010.5 },
    { timestamp: "2026-09-01T01:00:00", temp: 21.7, humidity: 89, pressure: 1010.3 },
    { timestamp: "2026-09-01T02:00:00", temp: 21.4, humidity: 91, pressure: 1010.0 },
    { timestamp: "2026-09-01T03:00:00", temp: 21.1, humidity: 92, pressure: 1009.8 },
    { timestamp: "2026-09-01T04:00:00", temp: 20.9, humidity: 93, pressure: 1009.7 },
    { timestamp: "2026-09-01T05:00:00", temp: 20.8, humidity: 93, pressure: 1010.1 },
    { timestamp: "2026-09-01T06:00:00", temp: 21.3, humidity: 91, pressure: 1010.6 },
    { timestamp: "2026-09-01T07:00:00", temp: 22.3, humidity: 87, pressure: 1011.2 },
    { timestamp: "2026-09-01T08:00:00", temp: 23.7, humidity: 81, pressure: 1011.7 },
    { timestamp: "2026-09-01T09:00:00", temp: 25.1, humidity: 76, pressure: 1012.0 },
    { timestamp: "2026-09-01T10:00:00", temp: 26.4, humidity: 71, pressure: 1011.7 },
    { timestamp: "2026-09-01T11:00:00", temp: 27.2, humidity: 68, pressure: 1011.1 },
    { timestamp: "2026-09-01T12:00:00", temp: 27.8, humidity: 65, pressure: 1010.5 },
    { timestamp: "2026-09-01T13:00:00", temp: 27.9, humidity: 66, pressure: 1009.9 },
    { timestamp: "2026-09-01T14:00:00", temp: 27.4, humidity: 69, pressure: 1009.4 },
    { timestamp: "2026-09-01T15:00:00", temp: 26.6, humidity: 72, pressure: 1009.3 },
    { timestamp: "2026-09-01T16:00:00", temp: 25.8, humidity: 76, pressure: 1009.7 },
    { timestamp: "2026-09-01T17:00:00", temp: 24.9, humidity: 80, pressure: 1010.2 },
    { timestamp: "2026-09-01T18:00:00", temp: 24.1, humidity: 83, pressure: 1010.7 },
    { timestamp: "2026-09-01T19:00:00", temp: 23.5, humidity: 85, pressure: 1011.1 },
    { timestamp: "2026-09-01T20:00:00", temp: 23.0, humidity: 86, pressure: 1011.3 },
    { timestamp: "2026-09-01T21:00:00", temp: 22.6, humidity: 87, pressure: 1011.2 },
    { timestamp: "2026-09-01T22:00:00", temp: 22.3, humidity: 88, pressure: 1010.9 },
    { timestamp: "2026-09-01T23:00:00", temp: 22.1, humidity: 88, pressure: 1010.7 }
  ],
  kalasa: [
    { timestamp: "2026-09-01T00:00:00", temp: 21.2, humidity: 90, pressure: 1011.6 },
    { timestamp: "2026-09-01T01:00:00", temp: 20.9, humidity: 91, pressure: 1011.4 },
    { timestamp: "2026-09-01T02:00:00", temp: 20.6, humidity: 92, pressure: 1011.1 },
    { timestamp: "2026-09-01T03:00:00", temp: 20.4, humidity: 93, pressure: 1010.9 },
    { timestamp: "2026-09-01T04:00:00", temp: 20.2, humidity: 94, pressure: 1010.8 },
    { timestamp: "2026-09-01T05:00:00", temp: 20.1, humidity: 94, pressure: 1011.2 },
    { timestamp: "2026-09-01T06:00:00", temp: 20.5, humidity: 92, pressure: 1011.8 },
    { timestamp: "2026-09-01T07:00:00", temp: 21.4, humidity: 88, pressure: 1012.3 },
    { timestamp: "2026-09-01T08:00:00", temp: 22.6, humidity: 83, pressure: 1012.7 },
    { timestamp: "2026-09-01T09:00:00", temp: 23.9, humidity: 78, pressure: 1012.9 },
    { timestamp: "2026-09-01T10:00:00", temp: 25.1, humidity: 73, pressure: 1012.6 },
    { timestamp: "2026-09-01T11:00:00", temp: 26.0, humidity: 69, pressure: 1012.0 },
    { timestamp: "2026-09-01T12:00:00", temp: 26.6, humidity: 67, pressure: 1011.4 },
    { timestamp: "2026-09-01T13:00:00", temp: 26.8, humidity: 68, pressure: 1010.8 },
    { timestamp: "2026-09-01T14:00:00", temp: 26.3, humidity: 71, pressure: 1010.3 },
    { timestamp: "2026-09-01T15:00:00", temp: 25.5, humidity: 75, pressure: 1010.2 },
    { timestamp: "2026-09-01T16:00:00", temp: 24.7, humidity: 79, pressure: 1010.6 },
    { timestamp: "2026-09-01T17:00:00", temp: 23.8, humidity: 83, pressure: 1011.1 },
    { timestamp: "2026-09-01T18:00:00", temp: 23.1, humidity: 86, pressure: 1011.6 },
    { timestamp: "2026-09-01T19:00:00", temp: 22.5, humidity: 87, pressure: 1011.9 },
    { timestamp: "2026-09-01T20:00:00", temp: 22.1, humidity: 88, pressure: 1012.1 },
    { timestamp: "2026-09-01T21:00:00", temp: 21.8, humidity: 89, pressure: 1012.1 },
    { timestamp: "2026-09-01T22:00:00", temp: 21.5, humidity: 90, pressure: 1011.9 },
    { timestamp: "2026-09-01T23:00:00", temp: 21.3, humidity: 90, pressure: 1011.7 }
  ],
  bhagamandala: [
    { timestamp: "2026-09-01T00:00:00", temp: 19.5, humidity: 94, pressure: 1013.0 },
    { timestamp: "2026-09-01T01:00:00", temp: 19.1, humidity: 95, pressure: 1012.7 },
    { timestamp: "2026-09-01T02:00:00", temp: 18.8, humidity: 96, pressure: 1012.4 },
    { timestamp: "2026-09-01T03:00:00", temp: 18.5, humidity: 97, pressure: 1012.1 },
    { timestamp: "2026-09-01T04:00:00", temp: 18.3, humidity: 97, pressure: 1011.9 },
    { timestamp: "2026-09-01T05:00:00", temp: 18.2, humidity: 98, pressure: 1012.3 },
    { timestamp: "2026-09-01T06:00:00", temp: 18.7, humidity: 96, pressure: 1012.9 },
    { timestamp: "2026-09-01T07:00:00", temp: 19.6, humidity: 92, pressure: 1013.5 },
    { timestamp: "2026-09-01T08:00:00", temp: 20.8, humidity: 87, pressure: 1014.0 },
    { timestamp: "2026-09-01T09:00:00", temp: 21.9, humidity: 82, pressure: 1014.3 },
    { timestamp: "2026-09-01T10:00:00", temp: 22.9, humidity: 78, pressure: 1014.0 },
    { timestamp: "2026-09-01T11:00:00", temp: 23.6, humidity: 74, pressure: 1013.4 },
    { timestamp: "2026-09-01T12:00:00", temp: 24.1, humidity: 72, pressure: 1012.8 },
    { timestamp: "2026-09-01T13:00:00", temp: 24.3, humidity: 71, pressure: 1012.2 },
    { timestamp: "2026-09-01T14:00:00", temp: 23.8, humidity: 73, pressure: 1011.7 },
    { timestamp: "2026-09-01T15:00:00", temp: 23.2, humidity: 76, pressure: 1011.6 },
    { timestamp: "2026-09-01T16:00:00", temp: 22.5, humidity: 80, pressure: 1012.0 },
    { timestamp: "2026-09-01T17:00:00", temp: 21.8, humidity: 84, pressure: 1012.5 },
    { timestamp: "2026-09-01T18:00:00", temp: 21.1, humidity: 88, pressure: 1013.0 },
    { timestamp: "2026-09-01T19:00:00", temp: 20.6, humidity: 90, pressure: 1013.4 },
    { timestamp: "2026-09-01T20:00:00", temp: 20.2, humidity: 91, pressure: 1013.6 },
    { timestamp: "2026-09-01T21:00:00", temp: 19.9, humidity: 92, pressure: 1013.7 },
    { timestamp: "2026-09-01T22:00:00", temp: 19.7, humidity: 93, pressure: 1013.4 },
    { timestamp: "2026-09-01T23:00:00", temp: 19.6, humidity: 93, pressure: 1013.2 }
  ]
};

export async function loadStationData(id) {
  try {
    const res = await fetch(`../shared/datasets/${id}.json`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn(`[SkyGuard] Fetch failed for ${id} (file:// protocol restriction). Using local fallback dataset.`, err);
  }

  if (FALLBACK_DATASETS[id]) {
    return FALLBACK_DATASETS[id];
  }
  return [];
}

export async function loadStations() {
  try {
    const res = await fetch('../shared/stations.json');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[SkyGuard] Fetch failed for stations.json (file:// protocol restriction). Using default stations metadata.', err);
  }

  return DEFAULT_STATIONS;
}
