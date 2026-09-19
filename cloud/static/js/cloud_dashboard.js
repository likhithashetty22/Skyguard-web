// cloud/static/js/cloud_dashboard.js
// SkyGuard AI — IMD Simulation Cloud Command Center Logic
// Handles live analytics polling, Karnataka Leaflet visualization, stream table rendering, and continuous retraining execution.

const API_BASE = window.location.origin;

// Karnataka AWS Stations Metadata
const STATIONS_META = {
  "Agumbe": { name: "Agumbe", district: "Shimoga", lat: 13.506, lon: 75.093 },
  "Kottigehara": { name: "Kottigehara", district: "Chikkamagaluru", lat: 13.125, lon: 75.521 },
  "Kammaradi": { name: "Kammaradi", district: "Shimoga", lat: 13.483, lon: 75.250 },
  "Kalasa": { name: "Kalasa", district: "Chikkamagaluru", lat: 13.238, lon: 75.367 },
  "Bhagamandala": { name: "Bhagamandala", district: "Kodagu", lat: 12.390, lon: 75.528 }
};

// Global State
let map = null;
let stationMarkers = {};
let lossChart = null;
let rawRecentLogs = [];
let isRetraining = false;
let selectedStationFilter = 'ALL';
let selectedStatusFilter = 'ALL';

// -------------------------------------------------------------
// 1. Initialize Application on DOMContentLoaded
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initSystemClock();
  initKarnatakaMap();
  initLossChart();
  bindUIEvents();

  // Initial fetch and start polling
  fetchAnalytics();
  setInterval(fetchAnalytics, 2500);
});

// -------------------------------------------------------------
// 2. System Clock (IST)
// -------------------------------------------------------------
function initSystemClock() {
  const clockEl = document.getElementById('system-clock');
  function updateClock() {
    if (!clockEl) return;
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }) + ' IST';
  }
  updateClock();
  setInterval(updateClock, 1000);
}

// -------------------------------------------------------------
// 3. Karnataka Regional Map (Leaflet)
// -------------------------------------------------------------
function initKarnatakaMap() {
  const mapContainer = document.getElementById('karnataka-map');
  if (!mapContainer) return;

  // Center on Karnataka Western Ghats
  map = L.map('karnataka-map', {
    center: [13.15, 75.35],
    zoom: 8,
    zoomControl: true,
    attributionControl: false
  });

  // Dark Map Tiles (CartoDB Dark Matter)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 18,
    subdomains: 'abcd',
  }).addTo(map);

  // Initialize Markers for 5 Stations
  Object.entries(STATIONS_META).forEach(([id, meta]) => {
    const icon = createMarkerIcon('nominal');
    const marker = L.marker([meta.lat, meta.lon], { icon }).addTo(map);

    marker.bindTooltip(`<strong>${meta.name}</strong> (${meta.district})`, {
      permanent: false,
      direction: 'top',
      className: 'custom-map-tooltip'
    });

    marker.on('click', () => {
      selectStationOnMap(id);
    });

    stationMarkers[id] = marker;
  });
}

function createMarkerIcon(status) {
  let innerHtml = '';
  if (status === 'anomaly') {
    innerHtml = `<div class="leaflet-radar-marker"><div class="radar-ring"></div><div class="radar-dot"></div></div>`;
  } else if (status === 'warning') {
    innerHtml = `<div class="leaflet-radar-marker"><div class="radar-dot warning"></div></div>`;
  } else {
    innerHtml = `<div class="leaflet-radar-marker"><div class="radar-dot nominal"></div></div>`;
  }

  return L.divIcon({
    html: innerHtml,
    className: 'custom-station-icon',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
}

function selectStationOnMap(stationId) {
  const meta = STATIONS_META[stationId];
  if (!meta) return;

  // Find latest data from rawRecentLogs
  const latest = rawRecentLogs.find(r => r.location === stationId || r.station === stationId);
  const previewName = document.getElementById('preview-station-name');
  const previewStatus = document.getElementById('preview-station-status');
  const previewTemp = document.getElementById('preview-temp');
  const previewPress = document.getElementById('preview-press');
  const previewHum = document.getElementById('preview-hum');
  const previewMse = document.getElementById('preview-mse');

  if (previewName) previewName.textContent = `${meta.name} (${meta.district})`;
  
  if (latest) {
    if (previewTemp) previewTemp.textContent = `${Number(latest.temperature || latest.temp || 0).toFixed(1)} °C`;
    if (previewPress) previewPress.textContent = `${Number(latest.pressure || 0).toFixed(1)} hPa`;
    if (previewHum) previewHum.textContent = `${Number(latest.humidity || 0).toFixed(0)} %`;
    if (previewMse) previewMse.textContent = Number(latest.reconstruction_error || 0).toFixed(4);

    if (previewStatus) {
      if (latest.is_anomaly) {
        previewStatus.className = 'badge badge-critical';
        previewStatus.textContent = 'Anomaly Alert';
      } else {
        previewStatus.className = 'badge badge-normal';
        previewStatus.textContent = 'Nominal Telemetry';
      }
    }
  }

  // Highlight card
  document.querySelectorAll('.station-card').forEach(c => {
    c.classList.remove('active');
    if (c.dataset.station === stationId) c.classList.add('active');
  });
}

// -------------------------------------------------------------
// 4. Chart.js Autoencoder Loss Visualization
// -------------------------------------------------------------
function initLossChart() {
  const ctx = document.getElementById('lossChart');
  if (!ctx) return;

  const baselineLabels = Array.from({ length: 25 }, (_, i) => `E${i + 1}`);
  // Synthetic baseline curve decaying towards threshold
  const baselineLoss = baselineLabels.map((_, i) => 
    +(0.065 * Math.exp(-i / 6) + 0.015 + (Math.random() * 0.003)).toFixed(4)
  );

  lossChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: baselineLabels,
      datasets: [
        {
          label: 'Reconstruction Loss (MSE)',
          data: baselineLoss,
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 5
        },
        {
          label: 'Dynamic Threshold (95th %ile)',
          data: baselineLabels.map(() => 0.0250),
          borderColor: '#ef4444',
          borderDash: [5, 5],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 11 }
          }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#f8fafc',
          bodyColor: '#38bdf8',
          borderColor: '#334155',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(51, 65, 85, 0.3)' },
          ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
        },
        y: {
          grid: { color: 'rgba(51, 65, 85, 0.3)' },
          ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } },
          min: 0
        }
      }
    }
  });
}

function updateLossChart(epochs, lossHistory, newThreshold) {
  if (!lossChart) return;

  const labels = Array.from({ length: epochs }, (_, i) => `E${i + 1}`);
  lossChart.data.labels = labels;
  lossChart.data.datasets[0].data = lossHistory;
  lossChart.data.datasets[1].data = labels.map(() => newThreshold);
  lossChart.update();
}

// -------------------------------------------------------------
// 5. Analytics Polling & Rendering (GET /cloud/analytics)
// -------------------------------------------------------------
async function fetchAnalytics() {
  if (isRetraining) return; // don't interrupt active training animations

  try {
    const res = await fetch(`${API_BASE}/cloud/analytics`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const stationList = Array.isArray(data.stations)
      ? data.stations
      : (data.stations ? Object.values(data.stations) : (data.station_analytics || []));
    const logsList = data.recent_transmissions || data.recent_logs || [];

    updateKPIs(data);
    updateStationCardsAndMap(stationList);
    updateStreamTable(logsList);
    updateRetrainPoolStats(data.summary, data.system_status);

    // Update connection indicator
    const gatewayDot = document.getElementById('edge-gateway-dot');
    const gatewayStatus = document.getElementById('edge-gateway-status');
    if (gatewayDot) gatewayDot.className = 'pulse-dot green';
    if (gatewayStatus) gatewayStatus.textContent = 'Active (Port 8000)';

  } catch (err) {
    console.warn('Analytics poll error:', err.message);
    const gatewayDot = document.getElementById('edge-gateway-dot');
    const gatewayStatus = document.getElementById('edge-gateway-status');
    if (gatewayDot) gatewayDot.className = 'pulse-dot red';
    if (gatewayStatus) gatewayStatus.textContent = 'Backend Reconnecting...';
  }
}

function updateKPIs(data) {
  const summary = data.summary || {};
  const sysStatus = data.system_status || {};

  const total = summary.total_transmissions ?? summary.total_ingested ?? 0;
  const anomalies = summary.anomaly_count ?? summary.total_anomalies ?? 0;
  const meanMse = sysStatus.current_loss ?? summary.mean_reconstruction_error ?? 0.0185;
  const thresh = sysStatus.reconstruction_threshold ?? summary.rejection_threshold ?? 0.0380;
  const modelVer = sysStatus.model_version ?? summary.active_model_version ?? 'v2.0-EdgeDistilled';

  const totalEl = document.getElementById('kpi-total-ingested');
  const headerTotalEl = document.getElementById('header-total-records');
  const anomaliesEl = document.getElementById('kpi-total-anomalies');
  const anomalyRateEl = document.getElementById('kpi-anomaly-rate');
  const meanMseEl = document.getElementById('kpi-mean-error');
  const threshEl = document.getElementById('kpi-current-thresh');
  const modelVerEl = document.getElementById('kpi-model-version');

  if (totalEl) totalEl.textContent = total.toLocaleString();
  if (headerTotalEl) headerTotalEl.textContent = `${total.toLocaleString()} Records`;
  if (anomaliesEl) anomaliesEl.textContent = anomalies.toLocaleString();

  if (anomalyRateEl) {
    const pct = total > 0 ? ((anomalies / total) * 100).toFixed(1) : '0.0';
    anomalyRateEl.textContent = `${pct}% Anomaly Frequency`;
  }

  if (meanMseEl) meanMseEl.textContent = Number(meanMse).toFixed(4);
  if (threshEl) threshEl.textContent = Number(thresh).toFixed(4);
  if (modelVerEl) modelVerEl.textContent = modelVer;
}

function updateStationCardsAndMap(stationList) {
  const container = document.getElementById('station-cards-container');
  if (!container) return;

  container.innerHTML = '';

  stationList.forEach(st => {
    const stationId = st.name || st.station || 'Unknown';
    const meta = STATIONS_META[stationId] || { name: stationId, district: 'Karnataka' };
    const anomCount = st.anomaly_count ?? st.anomalies ?? 0;
    const totalTx = st.total_transmissions ?? st.total ?? 1;
    const hasAnomaly = anomCount > 0;
    const errorRate = totalTx > 0 ? ((anomCount / totalTx) * 100).toFixed(0) : 0;
    const temp = st.latest_temp ?? st.avg_temp ?? 22.0;
    const press = st.latest_pressure ?? st.avg_pressure ?? 1012.0;
    const hum = st.latest_humidity ?? st.avg_humidity ?? 80.0;
    const mse = st.reconstruction_error ?? st.avg_reconstruction_error ?? 0.015;

    // Card element
    const card = document.createElement('div');
    card.className = `station-card ${hasAnomaly ? 'has-anomaly' : ''}`;
    card.dataset.station = stationId;
    card.innerHTML = `
      <div class="card-top">
        <span class="station-name">${meta.name}</span>
        <span class="badge ${hasAnomaly ? 'badge-critical' : 'badge-normal'}">
          ${hasAnomaly ? `${anomCount} Anomaly Alert${anomCount > 1 ? 's' : ''}` : 'Nominal'}
        </span>
      </div>
      <div class="station-metrics-row">
        <span>Temp: <strong>${Number(temp).toFixed(1)} °C</strong></span>
        <span>Press: <strong>${Number(press).toFixed(1)} hPa</strong></span>
        <span>Hum: <strong>${Number(hum).toFixed(0)} %</strong></span>
      </div>
      <div class="station-metrics-row font-mono" style="font-size: 0.7rem; margin-top: 0.4rem; color: #64748b;">
        <span>Recon MSE: ${Number(mse).toFixed(4)}</span>
        <span>Alert Rate: ${errorRate}%</span>
      </div>
    `;

    card.addEventListener('click', () => {
      selectStationOnMap(stationId);
      // Also filter table
      const filterStation = document.getElementById('filter-station');
      if (filterStation) {
        filterStation.value = stationId;
        selectedStationFilter = stationId;
        renderFilteredTable();
      }
    });

    container.appendChild(card);

    // Update map marker pulse status
    const marker = stationMarkers[stationId];
    if (marker) {
      const status = hasAnomaly ? 'anomaly' : (mse > 0.025 ? 'warning' : 'nominal');
      marker.setIcon(createMarkerIcon(status));
    }
  });
}

function updateStreamTable(logs) {
  rawRecentLogs = logs;
  renderFilteredTable();
}

function renderFilteredTable() {
  const tbody = document.getElementById('telemetry-table-body');
  const countEl = document.getElementById('table-record-count');
  if (!tbody) return;

  let filtered = rawRecentLogs;

  if (selectedStationFilter !== 'ALL') {
    filtered = filtered.filter(r => (r.location || r.station) === selectedStationFilter);
  }

  if (selectedStatusFilter === 'ANOMALY') {
    filtered = filtered.filter(r => r.is_anomaly);
  } else if (selectedStatusFilter === 'NORMAL') {
    filtered = filtered.filter(r => !r.is_anomaly);
  }

  if (countEl) {
    countEl.textContent = `Displaying ${filtered.length} matching telemetry records`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">No telemetry records match the current filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  filtered.forEach(r => {
    const tr = document.createElement('tr');
    if (r.is_anomaly) tr.className = 'row-anomaly';

    const timeStr = r.timestamp ? formatTimestamp(r.timestamp) : '--:--:--';
    const loc = r.location || r.station || 'Unknown';
    const temp = Number(r.temperature || r.temp || 0).toFixed(1);
    const press = Number(r.pressure || 0).toFixed(1);
    const hum = Number(r.humidity || 0).toFixed(0);
    const isAnomaly = !!r.is_anomaly;
    const mse = Number(r.reconstruction_error || 0).toFixed(4);
    const modelTag = r.model_version || 'Edge Autoencoder';

    tr.innerHTML = `
      <td class="font-mono text-muted">${timeStr}</td>
      <td><strong>${loc}</strong></td>
      <td>${temp} °C</td>
      <td>${press} hPa</td>
      <td>${hum} %</td>
      <td>
        <span class="badge ${isAnomaly ? 'badge-critical' : 'badge-normal'}">
          ${isAnomaly ? '⚠️ Anomaly' : '✅ Nominal'}
        </span>
      </td>
      <td class="font-mono text-cyan">${mse}</td>
      <td class="font-mono text-muted">0.0250</td>
      <td><span class="code-inline">${modelTag}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function updateRetrainPoolStats(summary, sysStatus) {
  const sampleEl = document.getElementById('retrain-sample-count');
  const threshEl = document.getElementById('retrain-current-thresh');
  if (sampleEl && summary) {
    const tot = summary.total_transmissions ?? summary.total_ingested ?? 0;
    sampleEl.textContent = `${tot.toLocaleString()} Weather Payloads`;
  }
  if (threshEl) {
    const thresh = sysStatus?.reconstruction_threshold ?? summary?.rejection_threshold ?? 0.0380;
    threshEl.textContent = Number(thresh).toFixed(4);
  }
}

function formatTimestamp(isoStr) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-IN', { hour12: false }) + ' ' + d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  } catch (_) {
    return isoStr;
  }
}

// -------------------------------------------------------------
// 6. Retraining Pipeline Execution (POST /cloud/retrain)
// -------------------------------------------------------------
async function executeRetrainingPipeline(e) {
  e.preventDefault();
  if (isRetraining) return;

  const epochsInput = document.getElementById('retrain-epochs');
  const lrInput = document.getElementById('retrain-lr');
  const contamInput = document.getElementById('retrain-contamination');
  const btnTrigger = document.getElementById('btn-trigger-retrain');
  const terminal = document.getElementById('retrain-terminal');
  const terminalStatus = document.getElementById('terminal-job-status');

  const epochs = parseInt(epochsInput.value, 10) || 25;
  const lr = parseFloat(lrInput.value) || 0.01;
  const contamination = parseFloat(contamInput.value) || 0.95;

  isRetraining = true;
  btnTrigger.disabled = true;
  btnTrigger.innerHTML = `<span class="pulse-dot green small"></span> Retraining Pipeline Active...`;
  if (terminalStatus) terminalStatus.textContent = 'Executing';

  // Clear terminal and print start
  terminal.innerHTML = '';
  appendTerminalLine(`[TRIGGER] Dispatched retrain request: epochs=${epochs}, lr=${lr}, contamination=${contamination}`, 'info');
  appendTerminalLine(`[INGEST] Extracting clean historical records from SQLite repository (cloud_data.sqlite)...`, 'info');

  try {
    const res = await fetch(`${API_BASE}/cloud/retrain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ epochs, learning_rate: lr, contamination })
    });

    if (!res.ok) throw new Error(`Retrain error: HTTP ${res.status}`);
    const result = await res.json();

    // Animate epoch logs for smooth visual feedback
    const history = result.loss_history || [];
    for (let i = 0; i < history.length; i++) {
      await sleep(40);
      appendTerminalLine(`[EPOCH ${i + 1}/${epochs}] MSE Loss: ${history[i].toFixed(5)}`, 'epoch');
      terminal.scrollTop = terminal.scrollHeight;
    }

    appendTerminalLine(`[CONVERGED] Autoencoder retraining completed successfully!`, 'success');
    appendTerminalLine(`[RECALIBRATION] Initial Loss: ${result.initial_loss.toFixed(4)} ➔ Final Loss: ${result.final_loss.toFixed(4)}`, 'success');
    appendTerminalLine(`[THRESHOLD] Updated 95th-percentile rejection threshold: ${result.new_threshold.toFixed(4)}`, 'info');
    appendTerminalLine(`[CHECKPOINT] Model artifact saved to: ${result.model_artifact}`, 'info');

    // Update UI Elements
    const preLossEl = document.getElementById('pre-loss');
    const postLossEl = document.getElementById('post-loss');
    const preThreshEl = document.getElementById('pre-thresh');
    const postThreshEl = document.getElementById('post-thresh');
    const lastRetrainedBadge = document.getElementById('badge-last-retrained');

    if (preLossEl) preLossEl.textContent = result.initial_loss.toFixed(4);
    if (postLossEl) postLossEl.textContent = result.final_loss.toFixed(4);
    if (preThreshEl) preThreshEl.textContent = (result.new_threshold * 1.25).toFixed(4);
    if (postThreshEl) postThreshEl.textContent = result.new_threshold.toFixed(4);
    if (lastRetrainedBadge) lastRetrainedBadge.textContent = `Last Retrained: Just Now (${result.model_version})`;

    // Update Chart with newly calculated loss history
    updateLossChart(epochs, history, result.new_threshold);

    // Refresh analytics immediately
    fetchAnalytics();

  } catch (err) {
    appendTerminalLine(`[ERROR] Retraining failed: ${err.message}`, 'err');
  } finally {
    isRetraining = false;
    btnTrigger.disabled = false;
    btnTrigger.innerHTML = `<span class="btn-icon">⚡</span> Run Continuous Retraining Pipeline`;
    if (terminalStatus) terminalStatus.textContent = 'Completed';
  }
}

function appendTerminalLine(text, type = 'info') {
  const terminal = document.getElementById('retrain-terminal');
  if (!terminal) return;
  const line = document.createElement('div');
  line.className = `term-line ${type}`;
  line.textContent = text;
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// -------------------------------------------------------------
// 7. UI Bindings & Export CSV
// -------------------------------------------------------------
function bindUIEvents() {
  const retrainForm = document.getElementById('retrain-form');
  if (retrainForm) {
    retrainForm.addEventListener('submit', executeRetrainingPipeline);
  }

  const btnPoll = document.getElementById('btn-manual-poll');
  if (btnPoll) {
    btnPoll.addEventListener('click', () => {
      fetchAnalytics();
    });
  }

  const filterStation = document.getElementById('filter-station');
  if (filterStation) {
    filterStation.addEventListener('change', (e) => {
      selectedStationFilter = e.target.value;
      renderFilteredTable();
    });
  }

  const filterAnomaly = document.getElementById('filter-anomaly');
  if (filterAnomaly) {
    filterAnomaly.addEventListener('change', (e) => {
      selectedStatusFilter = e.target.value;
      renderFilteredTable();
    });
  }

  const btnExport = document.getElementById('btn-export-csv');
  if (btnExport) {
    btnExport.addEventListener('click', exportCSV);
  }

  const btnOta = document.getElementById('btn-mock-ota');
  if (btnOta) {
    btnOta.addEventListener('click', () => {
      btnOta.textContent = '✅ Deployed to Edge Nodes';
      btnOta.style.borderColor = '#10b981';
      btnOta.style.color = '#10b981';
      setTimeout(() => {
        btnOta.textContent = 'Broadcast OTA Update';
        btnOta.style.borderColor = '';
        btnOta.style.color = '';
      }, 3000);
    });
  }
}

function exportCSV() {
  if (!rawRecentLogs || rawRecentLogs.length === 0) {
    alert('No telemetry records available to export.');
    return;
  }

  const headers = ['id', 'timestamp', 'station', 'temperature', 'pressure', 'humidity', 'is_anomaly', 'reconstruction_error', 'model_version'];
  const csvRows = [headers.join(',')];

  rawRecentLogs.forEach(r => {
    const row = [
      r.id || '',
      `"${r.timestamp || ''}"`,
      `"${r.location || r.station || ''}"`,
      r.temperature || r.temp || 0,
      r.pressure || 0,
      r.humidity || 0,
      r.is_anomaly ? 1 : 0,
      r.reconstruction_error || 0,
      `"${r.model_version || ''}"`
    ];
    csvRows.push(row.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `skyguard_telemetry_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
