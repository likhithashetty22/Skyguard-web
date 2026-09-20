// receiver/js/map.js
// =========================================================================================
// SkyGuard AI - Interactive India Weather Station Network Map
// Displays geographical station health using Virtual ESP32 TinyML edge verdicts.
// =========================================================================================

import { getAllStations, updateStation } from './station-registry.js';
import { onReceive } from './transport.js';

const STATUS_COLORS = {
  normal: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
  unknown: '#6b7280'
};

export async function initIndiaMapView() {
  const mapContainer = document.getElementById('india-map');
  const countTotalEl = document.getElementById('map-count-total');
  const countNormalEl = document.getElementById('map-count-normal');
  const countWarningEl = document.getElementById('map-count-warning');
  const countCriticalEl = document.getElementById('map-count-critical');
  const countUnknownEl = document.getElementById('map-count-unknown');

  if (!mapContainer || typeof L === 'undefined') {
    console.warn('[SkyGuard Map] Leaflet library or container not ready.');
    return;
  }

  // Centered on South-Central India / Western Ghats with clear view of Karnataka stations
  const map = L.map('india-map').setView([13.4, 75.4], 7);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap contributors • SkyGuard AI'
  }).addTo(map);

  const stations = await getAllStations();
  const stationMarkers = {};

  function updateMetrics(stationList) {
    const total = stationList.length;
    const normal = stationList.filter(s => s.status === 'normal').length;
    const warning = stationList.filter(s => s.status === 'warning').length;
    const critical = stationList.filter(s => s.status === 'critical').length;
    const unknown = stationList.filter(s => !s.status || s.status === 'unknown').length;

    if (countTotalEl) countTotalEl.textContent = total;
    if (countNormalEl) countNormalEl.textContent = normal;
    if (countWarningEl) countWarningEl.textContent = warning;
    if (countCriticalEl) countCriticalEl.textContent = critical;
    if (countUnknownEl) countUnknownEl.textContent = unknown;
  }

  function createPopupHtml(station) {
    const status = station.status || 'unknown';
    const color = STATUS_COLORS[status] || STATUS_COLORS.unknown;
    const confPct = Math.round((station.confidence || 0) * 100);
    const timeStr = station.timestamp ? new Date(station.timestamp).toLocaleTimeString() : 'Awaiting sync';

    return `
      <div style="font-family: system-ui, sans-serif; min-width: 200px; color: #0f172a;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <h4 style="margin: 0; font-size: 1rem; color: #1e293b;">${station.name}</h4>
          <span style="background: ${color}; color: #ffffff; padding: 2px 8px; border-radius: 9999px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase;">
            ${status}
          </span>
        </div>
        <p style="margin: 2px 0; font-size: 0.75rem; color: #64748b;">
          <strong>Coordinates:</strong> ${station.lat.toFixed(3)}, ${station.lon.toFixed(3)}
        </p>
        <div style="margin: 8px 0; padding: 8px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 0.8rem;">
          <div style="margin-bottom: 4px;">
            <strong>Edge Confidence:</strong> ${confPct}% (Virtual ESP32)
          </div>
          <div style="color: #334155; font-size: 0.75rem;">
            <strong>Diagnosis:</strong> ${station.rootCause || 'Nominal'}
          </div>
        </div>
        <div style="font-size: 0.7rem; color: #94a3b8; text-align: right;">
          Updated: ${timeStr}
        </div>
      </div>
    `;
  }

  // Plot stations
  const bounds = [];
  stations.forEach(s => {
    const status = s.status || 'unknown';
    const color = STATUS_COLORS[status] || STATUS_COLORS.unknown;

    const marker = L.circleMarker([s.lat, s.lon], {
      radius: status === 'critical' ? 14 : 10,
      fillColor: color,
      color: '#ffffff',
      weight: 2.5,
      opacity: 1,
      fillOpacity: 0.88
    }).addTo(map);

    marker.bindPopup(createPopupHtml(s));
    stationMarkers[s.id.toLowerCase()] = { marker, data: s };
    stationMarkers[s.name.toLowerCase()] = { marker, data: s };

    bounds.push([s.lat, s.lon]);
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 9 });
  }

  updateMetrics(stations);

  // Live real-time listener for incoming edge judgments
  onReceive((message) => {
    if (!message || !message.station) return;

    const key = String(message.station).trim().toLowerCase();
    const target = stationMarkers[key];

    // Update station registry
    updateStation(message.station, message);

    if (target) {
      target.data.status = message.status || 'normal';
      target.data.confidence = message.confidence != null ? message.confidence : 0.9;
      target.data.rootCause = message.rootCause || 'Nominal';
      target.data.timestamp = message.timestamp || new Date().toISOString();

      const color = STATUS_COLORS[target.data.status] || STATUS_COLORS.unknown;
      target.marker.setStyle({
        fillColor: color,
        radius: target.data.status === 'critical' ? 14 : 10
      });

      target.marker.setPopupContent(createPopupHtml(target.data));

      // Recompute metrics
      const currentStations = Object.values(stationMarkers).map(item => item.data);
      // Deduplicate unique stations by id
      const uniqueList = Array.from(new Map(currentStations.map(s => [s.id, s])).values());
      updateMetrics(uniqueList);
    }
  });
}
