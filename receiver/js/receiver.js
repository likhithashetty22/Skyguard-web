// receiver/js/receiver.js
// Receiver Application Logic: Ingestion, Anomaly Rule Execution, Unified Rendering & Side Panel
// Features persistent localStorage state across tab navigations so pings and telemetry never vanish!

import { onReceive } from './transport.js';
import { checkAnomaly, mergeVerdicts } from './anomaly-rules.js';
import { updateStation } from './station-registry.js';

// LocalStorage persistence keys
const RESOLVED_STORAGE_KEY = 'skyguard_resolved_anomalies_v1';
const TELEMETRY_STORAGE_KEY = 'skyguard_telemetry_history_v1';
const PINGS_STORAGE_KEY = 'skyguard_pings_history_v1';

const MAX_STORED_ITEMS = 100;
const CLOUD_INGEST_URL = 'http://localhost:8000/cloud/ingest';

// Cloud Upstream Relay (Edge ESP32 / Receiver -> IMD Cloud Central)
export async function forwardToCloud(reading, evalResult) {
  if (!reading || !reading.station) return;
  try {
    const isAnomaly = evalResult ? (evalResult.status !== 'normal') : (reading.status && reading.status !== 'normal');
    const cloudPayload = {
      location: reading.station,
      timestamp: reading.timestamp || new Date().toISOString(),
      temperature: reading.temp != null ? Number(reading.temp) : (reading.temperature != null ? Number(reading.temperature) : 23.5),
      pressure: reading.pressure != null ? Number(reading.pressure) : 1012.0,
      humidity: reading.humidity != null ? Number(reading.humidity) : 80.0,
      is_anomaly: isAnomaly,
      reconstruction_error: reading.reconstruction_error != null
        ? Number(reading.reconstruction_error)
        : (isAnomaly ? 0.088 : 0.015),
      status: evalResult?.status || reading.status || 'normal',
      confidence: evalResult?.confidence ?? reading.confidence ?? 0.95,
      rootCause: evalResult?.rootCause || reading.rootCause || (isAnomaly ? 'Threshold exceeded' : 'Nominal'),
      decisionPath: evalResult?.decisionPath || reading.decisionPath || [],
      simulated: !!reading.simulated
    };

    const res = await fetch(CLOUD_INGEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cloudPayload)
    });

    updateCloudSyncBadge(res.ok);
  } catch (_) {
    updateCloudSyncBadge(false);
  }
}

function updateCloudSyncBadge(isOnline) {
  const badge = document.getElementById('cloud-sync-badge');
  if (!badge) return;
  if (isOnline) {
    badge.className = 'badge badge-cloud-online';
    badge.textContent = '☁️ Cloud Sync: Active (:8000)';
    badge.style.color = '#10b981';
    badge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    badge.style.background = 'rgba(16, 185, 129, 0.15)';
  } else {
    badge.className = 'badge badge-cloud-offline';
    badge.textContent = '☁️ Cloud: Standalone';
    badge.style.color = '#94a3b8';
    badge.style.borderColor = 'rgba(148, 163, 184, 0.3)';
    badge.style.background = 'rgba(148, 163, 184, 0.1)';
  }
}

// Storage helpers
export function getResolvedIds() {
  try {
    const raw = localStorage.getItem(RESOLVED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export function saveResolvedId(uniqueId) {
  try {
    const list = getResolvedIds();
    if (!list.includes(uniqueId)) {
      list.push(uniqueId);
      localStorage.setItem(RESOLVED_STORAGE_KEY, JSON.stringify(list));
    }
  } catch (_) {}
}

export function clearResolvedStorage() {
  localStorage.removeItem(RESOLVED_STORAGE_KEY);
}

export function getPingsHistory() {
  try {
    const raw = localStorage.getItem(PINGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export function savePing(entry) {
  try {
    const list = getPingsHistory();
    list.unshift(entry);
    if (list.length > 50) list.pop();
    localStorage.setItem(PINGS_STORAGE_KEY, JSON.stringify(list));
  } catch (_) {}
}

export function clearPingsStorage() {
  localStorage.removeItem(PINGS_STORAGE_KEY);
}

export function getTelemetryHistory() {
  try {
    const raw = localStorage.getItem(TELEMETRY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export function saveTelemetryHistory(readings) {
  try {
    const trimmed = readings.slice(0, MAX_STORED_ITEMS);
    localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (_) {}
}

export function clearTelemetryStorage() {
  localStorage.removeItem(TELEMETRY_STORAGE_KEY);
}

// -------------------------------------------------------------
// TAB 1: Connection & Ping Log (index.html)
// -------------------------------------------------------------
export function initReceiverConnectionView() {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const logTerminal = document.getElementById('receiver-log');
  const btnClearLog = document.getElementById('btn-clear-log');

  if (statusDot) {
    statusDot.classList.add('connected');
  }
  if (statusText) {
    statusText.textContent = 'Listening on BroadcastChannel (skyguard)';
  }

  function renderTerminalEntry(entryText, timeStr) {
    if (!logTerminal) return;
    const line = document.createElement('div');
    line.className = 'log-entry';
    line.innerHTML = `<span class="log-time">[${timeStr || new Date().toLocaleTimeString()}]</span> ${entryText}`;
    logTerminal.appendChild(line);
    logTerminal.scrollTop = logTerminal.scrollHeight;
  }

  // Load and render persistent past pings
  if (logTerminal) {
    logTerminal.innerHTML = '';
    const storedPings = getPingsHistory();
    if (storedPings.length > 0) {
      // Stored in reverse chrono, render chrono for display
      for (let i = storedPings.length - 1; i >= 0; i--) {
        const item = storedPings[i];
        renderTerminalEntry(item.text, item.time);
      }
    } else {
      renderTerminalEntry('SkyGuard Receiver initialized. Waiting for incoming telemetry...');
    }
  }

  if (btnClearLog) {
    btnClearLog.addEventListener('click', () => {
      clearPingsStorage();
      if (logTerminal) {
        logTerminal.innerHTML = '';
        renderTerminalEntry('Ping log cleared.');
      }
    });
  }

  // Real-time listener on Tab 1
  onReceive((payload) => {
    if (!payload) return;
    const now = new Date().toLocaleTimeString();

    if (payload.type === 'ping') {
      const msg = `Ping received from ${payload.station || 'Sender'} (${payload.message || 'Heartbeat OK'})`;
      renderTerminalEntry(msg, now);
      savePing({ text: msg, time: now });
    } else if (payload.type === 'file-batch') {
      const rowCount = Array.isArray(payload.rows) ? payload.rows.length : 0;
      const msg = `File batch received (${rowCount} rows from ${payload.filename || 'Excel upload'}). Dispatched to Dashboard.`;
      renderTerminalEntry(msg, now);
      savePing({ text: msg, time: now });

      // Persist batch into shared telemetry store
      if (Array.isArray(payload.rows)) {
        const history = getTelemetryHistory();
        for (const row of payload.rows) {
          history.unshift(row);
        }
        saveTelemetryHistory(history);
      }
    } else if (payload.station) {
      let evalResult;
      const isEdgeJudgment = !!(payload.status && payload.decisionPath);

      if (isEdgeJudgment) {
        evalResult = {
          status: payload.status,
          confidence: payload.confidence != null ? payload.confidence : 0.9,
          rootCause: payload.rootCause || "Virtual ESP32 Edge Judgment",
          decisionPath: payload.decisionPath || []
        };
      } else {
        evalResult = checkAnomaly(payload);
      }

      // Sync to station registry
      updateStation(payload.station, evalResult);

      // Forward telemetry & verdict upstream to Cloud Repository
      forwardToCloud(payload, evalResult);

      const isAnomaly = evalResult.status !== 'normal';
      const icon = isAnomaly ? '⚠️ [ANOMALY]' : '✅ [TELEMETRY]';
      const sourceTag = isEdgeJudgment ? '[Virtual ESP32 Edge]' : '[Rule Engine]';
      const detail = `${payload.station} | ${sourceTag} Status: ${evalResult.status.toUpperCase()} (${Math.round(evalResult.confidence * 100)}% Conf) • ${evalResult.rootCause}`;
      
      renderTerminalEntry(`${icon} ${detail}`, now);
      savePing({ text: `${icon} ${detail}`, time: now });

      // Persist reading to telemetry store so Dashboard has it when user navigates
      const history = getTelemetryHistory();
      history.unshift(payload);
      saveTelemetryHistory(history);
    }
  });
}

// -------------------------------------------------------------
// TAB 2: Anomaly Detection Dashboard (dashboard.html)
// -------------------------------------------------------------
export function initDashboardView() {
  const tableBody = document.getElementById('anomaly-table-body');
  const totalCountEl = document.getElementById('count-total');
  const normalCountEl = document.getElementById('count-normal');
  const warningCountEl = document.getElementById('count-warning');
  const criticalCountEl = document.getElementById('count-critical');

  // Side Panel Elements
  const sidePanel = document.getElementById('detail-side-panel');
  const panelBackdrop = document.getElementById('side-panel-backdrop');
  const btnClosePanel = document.getElementById('btn-close-panel');
  const panelStationName = document.getElementById('panel-station-name');
  const panelTimestamp = document.getElementById('panel-timestamp');
  const panelSeverityBadge = document.getElementById('panel-severity-badge');
  const panelConfidencePct = document.getElementById('panel-confidence-pct');
  const panelMeterFill = document.getElementById('panel-meter-fill');
  const panelRootCause = document.getElementById('panel-root-cause');
  const panelTemp = document.getElementById('panel-temp');
  const panelHumidity = document.getElementById('panel-humidity');
  const panelPressure = document.getElementById('panel-pressure');
  const panelDecisionList = document.getElementById('panel-decision-list');
  const panelFlagsList = document.getElementById('panel-flags-list');
  const btnNextStation = document.getElementById('btn-next-station');
  const btnResolveAnomaly = document.getElementById('btn-resolve-anomaly');
  const btnClearResolved = document.getElementById('btn-clear-resolved');
  const btnClearAllReadings = document.getElementById('btn-clear-readings');

  // In-memory state
  let readingsList = []; // Ingested items: { id, reading, result, resolved }
  let activeDetailItem = null;
  let activeFilter = 'all'; // 'all', 'flagged', 'critical'

  // Load resolved IDs from localStorage
  const resolvedIds = new Set(getResolvedIds());

  // Metrics update
  function updateMetrics() {
    const activeItems = readingsList.filter(item => !item.resolved);
    const total = activeItems.length;
    const normal = activeItems.filter(i => i.result.status === 'normal').length;
    const warning = activeItems.filter(i => i.result.status === 'warning').length;
    const critical = activeItems.filter(i => i.result.status === 'critical').length;

    if (totalCountEl) totalCountEl.textContent = total;
    if (normalCountEl) normalCountEl.textContent = normal;
    if (warningCountEl) warningCountEl.textContent = warning;
    if (criticalCountEl) criticalCountEl.textContent = critical;
  }

  // Unified reading processor: handles edge judgments or raw sensor readings
  function ingestReading(reading, shouldSaveToStorage = true) {
    if (!reading || !reading.station) return;

    let result;
    // 1. If payload carries edge judgment from Virtual ESP32
    if (reading.status && (reading.decisionPath || reading.rootCause)) {
      result = {
        status: reading.status,
        confidence: reading.confidence != null ? reading.confidence : 0.9,
        rootCause: reading.rootCause || "Edge model judgment",
        decisionPath: reading.decisionPath || [],
        severity: reading.severity != null ? reading.severity : (reading.status === 'critical' ? 85 : (reading.status === 'warning' ? 50 : 0)),
        flags: reading.flags || []
      };
    } else {
      // 2. Fallback for raw historical data (e.g. CSV/Excel file batches)
      result = checkAnomaly(reading);
    }

    // Always update station registry with latest known state
    updateStation(reading.station, result);
    
    // Relay upstream to IMD Cloud Central
    forwardToCloud(reading, result);
    
    // Unique fingerprint for this telemetry event
    const uniqueId = `${reading.station}_${reading.timestamp || ''}_${reading.status || reading.temp || ''}_${reading.confidence || reading.pressure || ''}`;
    const isResolved = resolvedIds.has(uniqueId);

    const item = {
      id: uniqueId,
      reading,
      result,
      resolved: isResolved
    };

    readingsList.unshift(item); // Prepend to show most recent first
    renderRow(item);
    updateMetrics();

    if (shouldSaveToStorage) {
      const stored = readingsList.map(i => i.reading);
      saveTelemetryHistory(stored);
    }
  }

  // Unified table row renderer
  function renderRow(item) {
    if (!tableBody) return;

    // Filter check
    if (item.resolved) return;
    if (activeFilter === 'flagged' && item.result.status === 'normal') return;
    if (activeFilter === 'critical' && item.result.status !== 'critical') return;

    // Remove empty placeholder if present
    const emptyRow = document.getElementById('empty-table-placeholder');
    if (emptyRow) emptyRow.remove();

    const tr = document.createElement('tr');
    tr.id = `row-${item.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    const isFlagged = item.result.status !== 'normal';
    tr.className = `anomaly-row row-${item.result.status} ${isFlagged ? 'row-flagged' : ''}`;

    const timeStr = item.reading.timestamp 
      ? new Date(item.reading.timestamp).toLocaleTimeString() 
      : 'N/A';

    let badgeClass = 'badge-normal';
    let statusLabel = 'Normal';
    if (item.result.status === 'critical') {
      badgeClass = 'badge-critical';
      statusLabel = 'Critical Anomaly';
    } else if (item.result.status === 'warning') {
      badgeClass = 'badge-warning';
      statusLabel = 'Warning';
    }

    const simBadge = item.reading.simulated ? `<span class="badge badge-simulated">Simulated</span>` : '';

    const tempDisplay = item.reading.temp != null 
      ? Number(item.reading.temp).toFixed(1) + ' °C' 
      : '<span style="color: var(--text-muted); font-size: 0.75rem;">Edge Inferred</span>';

    const humDisplay = item.reading.humidity != null 
      ? Number(item.reading.humidity) + ' %' 
      : '<span style="color: var(--text-muted); font-size: 0.75rem;">Edge Inferred</span>';

    const pressDisplay = item.reading.pressure != null 
      ? Number(item.reading.pressure).toFixed(1) + ' hPa' 
      : '<span style="color: var(--text-muted); font-size: 0.75rem;">Edge Inferred</span>';

    tr.innerHTML = `
      <td><strong>${item.reading.station}</strong> ${simBadge}</td>
      <td>${timeStr}</td>
      <td>${tempDisplay}</td>
      <td>${humDisplay}</td>
      <td>${pressDisplay}</td>
      <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
      <td>
        ${isFlagged 
          ? `<button class="btn btn-outline btn-sm btn-inspect">Inspect →</button>` 
          : `<span style="color: var(--text-subtle); font-size: 0.75rem;">Healthy</span>`}
      </td>
    `;

    // Clicking flagged row opens More Details panel
    if (isFlagged) {
      tr.addEventListener('click', () => {
        openDetailsPanel(item);
      });
    }

    // Insert at top of table
    if (tableBody.firstChild) {
      tableBody.insertBefore(tr, tableBody.firstChild);
    } else {
      tableBody.appendChild(tr);
    }
  }

  // Re-render entire table (after filter change or reset)
  function rerenderAllRows() {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const visibleItems = readingsList.filter(item => {
      if (item.resolved) return false;
      if (activeFilter === 'flagged' && item.result.status === 'normal') return false;
      if (activeFilter === 'critical' && item.result.status !== 'critical') return false;
      return true;
    });

    if (visibleItems.length === 0) {
      tableBody.innerHTML = `
        <tr id="empty-table-placeholder">
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            No active readings matching the current filter.
          </td>
        </tr>
      `;
      return;
    }

    // Render from oldest to newest so newest ends up at top
    for (let i = visibleItems.length - 1; i >= 0; i--) {
      renderRow(visibleItems[i]);
    }
  }

  // Open "More details" side panel
  function openDetailsPanel(item) {
    activeDetailItem = item;
    const { reading, result } = item;

    if (panelStationName) panelStationName.textContent = reading.station;
    if (panelTimestamp) {
      panelTimestamp.textContent = reading.timestamp 
        ? new Date(reading.timestamp).toLocaleString() 
        : 'N/A';
    }

    // Severity Badge
    if (panelSeverityBadge) {
      panelSeverityBadge.className = `badge badge-${result.status}`;
      panelSeverityBadge.textContent = `${result.status.toUpperCase()} (${result.severity || 85}/100)`;
    }

    // Confidence / Probability Meter
    const confidencePct = Math.round((result.confidence || 0) * 100);
    if (panelConfidencePct) panelConfidencePct.textContent = `${confidencePct}% Probability`;
    if (panelMeterFill) {
      panelMeterFill.style.width = `${confidencePct}%`;
      panelMeterFill.className = `meter-fill ${result.status}`;
    }

    // Root-cause text
    if (panelRootCause) {
      panelRootCause.textContent = result.rootCause || 'No specific violation detected.';
    }

    // Telemetry values snapshot
    if (panelTemp) {
      panelTemp.textContent = reading.temp != null ? `${reading.temp} °C` : 'Edge Inferred';
    }
    if (panelHumidity) {
      panelHumidity.textContent = reading.humidity != null ? `${reading.humidity} %` : 'Edge Inferred';
    }
    if (panelPressure) {
      panelPressure.textContent = reading.pressure != null ? `${reading.pressure} hPa` : 'Edge Inferred';
    }

    // Virtual ESP32 TinyML Decision Path (Explainability)
    if (panelDecisionList) {
      panelDecisionList.innerHTML = '';
      const decisionPath = result.decisionPath || reading.decisionPath;
      if (decisionPath && decisionPath.length > 0) {
        decisionPath.forEach((step, idx) => {
          const li = document.createElement('li');
          li.className = 'flag-item';
          li.innerHTML = `<strong>Step ${idx + 1}:</strong> ${step}`;
          panelDecisionList.appendChild(li);
        });
      } else {
        panelDecisionList.innerHTML = '<li style="color: var(--text-muted); font-size: 0.8rem;">No tree path recorded (evaluated via rule layer).</li>';
      }
    }

    // Flag details breakdown (Deterministic Rules)
    if (panelFlagsList) {
      panelFlagsList.innerHTML = '';
      if (result.flags && result.flags.length > 0) {
        result.flags.forEach(flag => {
          const li = document.createElement('li');
          li.className = 'flag-item';
          const deltaInfo = flag.delta != null ? ` (Delta: ${flag.delta > 0 ? '+' : ''}${Number(flag.delta).toFixed(1)})` : '';
          li.innerHTML = `<strong>${flag.param.toUpperCase()}</strong>: ${flag.type.replace('_', ' ')} — Value: <strong>${flag.value}</strong>${deltaInfo}`;
          panelFlagsList.appendChild(li);
        });
      } else {
        panelFlagsList.innerHTML = '<li style="color: var(--text-muted); font-size: 0.8rem;">No deterministic rule breaches (within safety boundaries).</li>';
      }
    }

    // Open side panel drawer
    if (sidePanel) sidePanel.classList.add('open');
    if (panelBackdrop) panelBackdrop.classList.add('open');
  }

  function closeDetailsPanel() {
    if (sidePanel) sidePanel.classList.remove('open');
    if (panelBackdrop) panelBackdrop.classList.remove('open');
    activeDetailItem = null;
  }

  // Next Station Button: cycles to the next flagged station
  function cycleNextFlagged() {
    const flaggedItems = readingsList.filter(i => !i.resolved && i.result.status !== 'normal');
    if (flaggedItems.length === 0) return;

    if (!activeDetailItem) {
      openDetailsPanel(flaggedItems[0]);
      return;
    }

    const currentIndex = flaggedItems.findIndex(i => i.id === activeDetailItem.id);
    const nextIndex = (currentIndex + 1) % flaggedItems.length;
    openDetailsPanel(flaggedItems[nextIndex]);
  }

  // Resolved Button: removes from active list & persists in localStorage
  function resolveActiveAnomaly() {
    if (!activeDetailItem) return;

    const id = activeDetailItem.id;
    activeDetailItem.resolved = true;
    resolvedIds.add(id);
    saveResolvedId(id);

    // Re-render to reflect resolved status
    rerenderAllRows();
    updateMetrics();

    // Check if there are other flagged items to show
    const remainingFlagged = readingsList.filter(i => !i.resolved && i.result.status !== 'normal');
    if (remainingFlagged.length > 0) {
      cycleNextFlagged();
    } else {
      closeDetailsPanel();
    }
  }

  // Attach Event Listeners
  if (btnClosePanel) btnClosePanel.addEventListener('click', closeDetailsPanel);
  if (panelBackdrop) panelBackdrop.addEventListener('click', closeDetailsPanel);
  if (btnNextStation) btnNextStation.addEventListener('click', cycleNextFlagged);
  if (btnResolveAnomaly) btnResolveAnomaly.addEventListener('click', resolveActiveAnomaly);

  if (btnClearResolved) {
    btnClearResolved.addEventListener('click', () => {
      clearResolvedStorage();
      resolvedIds.clear();
      readingsList.forEach(i => i.resolved = false);
      rerenderAllRows();
      updateMetrics();
      alert('Resolved history reset. Past anomalies restored to view.');
    });
  }

  if (btnClearAllReadings) {
    btnClearAllReadings.addEventListener('click', () => {
      clearTelemetryStorage();
      readingsList = [];
      rerenderAllRows();
      updateMetrics();
    });
  }

  // Filter Buttons
  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter') || 'all';
      rerenderAllRows();
    });
  });

  // 1. Initial hydration: Load stored telemetry from localStorage!
  const storedTelemetry = getTelemetryHistory();
  if (storedTelemetry.length > 0) {
    // Stored in reverse chrono (most recent first), ingest from oldest to newest
    for (let i = storedTelemetry.length - 1; i >= 0; i--) {
      ingestReading(storedTelemetry[i], false);
    }
  }

  // 2. Real-time transport listener for single telemetry, file batches, or pings
  onReceive((message) => {
    if (!message) return;

    // Ping received while on dashboard: persist to pings history for index.html
    if (message.type === 'ping') {
      const now = new Date().toLocaleTimeString();
      const msg = `Ping received from ${message.station || 'Sender'} (${message.message || 'Heartbeat OK'})`;
      savePing({ text: msg, time: now });
      return;
    }

    // Single reading / judgment: { station, timestamp, status, confidence, rootCause, decisionPath }
    if (message.station) {
      ingestReading(message, true);
    }
    // File batch schema: { type: "file-batch", rows: [ ... ] }
    else if (message.type === 'file-batch' && Array.isArray(message.rows)) {
      message.rows.forEach(row => ingestReading(row, false));
      // Save full batch once
      const stored = readingsList.map(i => i.reading);
      saveTelemetryHistory(stored);
    }
  });
}
