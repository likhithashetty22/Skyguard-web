// sender/js/sender.js
// Main logic for Sender Console across all three tabs

import { send } from './transport.js';
import { loadStations, loadStationData, DEFAULT_STATIONS } from './stations-data.js';
import { runEdgeInference } from '../../shared/edge-inference.js';

// Toast Notification Helper
export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// -------------------------------------------------------------
// TAB 1: Connection & Handshake (index.html)
// -------------------------------------------------------------
export function initConnectionView() {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const pingBtn = document.getElementById('btn-ping');
  const logTerminal = document.getElementById('sender-log');

  // Verify BroadcastChannel readiness
  if (statusDot) {
    statusDot.classList.add('connected');
  }
  if (statusText) {
    statusText.textContent = 'BroadcastChannel Ready (skyguard)';
  }

  function appendLog(text) {
    if (!logTerminal) return;
    const line = document.createElement('div');
    line.className = 'log-entry';
    const timeStr = new Date().toLocaleTimeString();
    line.innerHTML = `<span class="log-time">[${timeStr}]</span> ${text}`;
    logTerminal.appendChild(line);
    logTerminal.scrollTop = logTerminal.scrollHeight;
  }

  appendLog('SkyGuard AI Sender transport initialized.');

  if (pingBtn) {
    pingBtn.addEventListener('click', () => {
      const pingPayload = {
        type: 'ping',
        station: 'SENDER_NODE',
        timestamp: new Date().toISOString(),
        message: 'Ping from SkyGuard Sender'
      };
      send(pingPayload);
      appendLog(`Ping sent: ${JSON.stringify(pingPayload)}`);
      showToast('Test ping dispatched to receiver', 'success');
    });
  }
}

// -------------------------------------------------------------
// TAB 2: Karnataka Map & Controls (stations.html)
// -------------------------------------------------------------
// -------------------------------------------------------------
// TAB 2: Karnataka Map & Controls (stations.html)
// -------------------------------------------------------------
export async function initMapView() {
  const mapElement = document.getElementById('stations-map');
  const btnSendData = document.getElementById('btn-send-data');
  const btnSimulateAnomaly = document.getElementById('btn-simulate-anomaly');

  let stations = DEFAULT_STATIONS;
  try {
    const fetched = await loadStations();
    if (fetched && fetched.length > 0) stations = fetched;
  } catch (_) {
    stations = DEFAULT_STATIONS;
  }

  // 1. Attach Button Listeners IMMEDIATELY so buttons work even if Map CDN is delayed
  if (btnSendData) {
    btnSendData.addEventListener('click', async () => {
      btnSendData.disabled = true;
      let sentCount = 0;

      for (const s of stations) {
        let record = null;
        try {
          const dataset = await loadStationData(s.id);
          record = (dataset && dataset.length > 0) ? dataset[0] : null;
        } catch (_) {}

        const rawReading = {
          station: s.name,
          temp: record ? record.temp : 22.5,
          humidity: record ? record.humidity : 85,
          pressure: record ? record.pressure : 1012.0
        };

        // Simulated Virtual ESP32 TinyML edge inference
        const edgeJudgment = await runEdgeInference(rawReading);

        // Edge transmission schema: transmit edge judgment without raw sensor values
        const payload = {
          station: s.name,
          timestamp: new Date().toISOString(),
          status: edgeJudgment.status,
          confidence: edgeJudgment.confidence,
          rootCause: edgeJudgment.rootCause,
          decisionPath: edgeJudgment.decisionPath,
          simulated: false
        };

        send(payload);
        sentCount++;
      }

      showToast(`Transmitted edge judgments for all ${sentCount} stations.`, 'success');
      btnSendData.disabled = false;
    });
  }

  // Simulate Anomaly Button: picks 1 station, randomizes outside normal bounds, tags simulated: true
  if (btnSimulateAnomaly) {
    btnSimulateAnomaly.addEventListener('click', async () => {
      const s = stations[Math.floor(Math.random() * stations.length)];
      const anomalyTypes = ['high_temp', 'low_temp', 'humidity_spike', 'pressure_drift', 'compound'];
      const chosenType = anomalyTypes[Math.floor(Math.random() * anomalyTypes.length)];

      let temp = 22.0;
      let humidity = 85;
      let pressure = 1012.0;

      switch (chosenType) {
        case 'high_temp':
          temp = +(51 + Math.random() * 6).toFixed(1); // > 45 max limit
          break;
        case 'low_temp':
          temp = +(1 - Math.random() * 4).toFixed(1); // < 5 min limit
          break;
        case 'humidity_spike':
          humidity = +(108 + Math.random() * 8).toFixed(0); // > 100 max limit
          break;
        case 'pressure_drift':
          pressure = +(925 - Math.random() * 15).toFixed(1); // < 950 min limit
          break;
        case 'compound':
          temp = +(54.2).toFixed(1);
          humidity = +(112).toFixed(0);
          pressure = +(920.5).toFixed(1);
          break;
      }

      const rawReading = {
        station: s.name,
        temp,
        humidity,
        pressure
      };

      // Run on-device Virtual ESP32 TinyML edge inference
      const edgeJudgment = await runEdgeInference(rawReading);

      // Transmit judgment payload only (no raw sensor metrics)
      const payload = {
        station: s.name,
        timestamp: new Date().toISOString(),
        status: edgeJudgment.status,
        confidence: edgeJudgment.confidence,
        rootCause: edgeJudgment.rootCause,
        decisionPath: edgeJudgment.decisionPath,
        simulated: true
      };

      send(payload);
      showToast(`⚠️ Virtual ESP32 detected ${edgeJudgment.status.toUpperCase()} for ${s.name} (${chosenType})`, edgeJudgment.status === 'critical' ? 'danger' : 'warning');
    });
  }

  // 2. Initialize Leaflet Map safely in try/catch
  try {
    if (!mapElement || typeof L === 'undefined') {
      console.warn('Leaflet map container or L library not available yet.');
      return;
    }

    // Centered on Western Ghats / Karnataka Malnad region
    const map = L.map('stations-map').setView([13.1, 75.4], 8);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap contributors • SkyGuard AI'
    }).addTo(map);

    const stationDataCache = {};

    for (const s of stations) {
      try {
        const records = await loadStationData(s.id);
        stationDataCache[s.id] = records && records.length ? records[0] : null;
      } catch (_) {
        stationDataCache[s.id] = null;
      }

      const current = stationDataCache[s.id] || { temp: 22.0, humidity: 85, pressure: 1012.0 };

      const marker = L.circleMarker([s.lat, s.lon], {
        radius: 10,
        fillColor: '#0284c7',
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85
      }).addTo(map);

      const popupHtml = `
        <div style="font-family: sans-serif; min-width: 180px;">
          <h4 style="margin: 0 0 6px 0; color: #0284c7; font-size: 1rem;">${s.name}</h4>
          <p style="margin: 2px 0; font-size: 0.8rem; color: #475569;"><strong>Lat:</strong> ${s.lat}, <strong>Lon:</strong> ${s.lon}</p>
          <div style="margin: 8px 0; padding: 6px; background: #f1f5f9; border-radius: 4px; font-size: 0.8rem;">
            <div>Temp: <strong>${current.temp} °C</strong></div>
            <div>Humidity: <strong>${current.humidity} %</strong></div>
            <div>Pressure: <strong>${current.pressure} hPa</strong></div>
          </div>
          <a href="station-detail.html?station=${s.id}" style="display: inline-block; margin-top: 4px; color: #0284c7; text-decoration: none; font-weight: 600; font-size: 0.8rem;">
            View 24h Table & Upload →
          </a>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('click', () => {
        marker.openPopup();
      });
    }
  } catch (mapErr) {
    console.warn('Map display warning:', mapErr);
  }
}

// -------------------------------------------------------------
// TAB 3: Station Detail & Excel Dropzone (station-detail.html)
// -------------------------------------------------------------
export async function initStationDetailView() {
  const stationSelect = document.getElementById('station-select');
  const tableBody = document.getElementById('station-table-body');
  const dropzone = document.getElementById('excel-dropzone');
  const fileInput = document.getElementById('excel-file-input');
  const stationHeading = document.getElementById('current-station-heading');

  const stations = await loadStations();

  // Populate dropdown
  if (stationSelect) {
    stationSelect.innerHTML = '';
    stations.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.name} (${s.lat}, ${s.lon})`;
      stationSelect.appendChild(opt);
    });

    // Check URL param ?station=...
    const urlParams = new URLSearchParams(window.location.search);
    const selectedParam = urlParams.get('station');
    if (selectedParam && stations.some(s => s.id === selectedParam)) {
      stationSelect.value = selectedParam;
    }

    stationSelect.addEventListener('change', () => {
      renderTableForStation(stationSelect.value);
    });
  }

  async function renderTableForStation(stationId) {
    const stationObj = stations.find(s => s.id === stationId) || stations[0];
    if (stationHeading) {
      stationHeading.textContent = `${stationObj.name} — 24-Hour Telemetry Log`;
    }

    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem;">Loading telemetry dataset...</td></tr>';

    const records = await loadStationData(stationId);
    tableBody.innerHTML = '';

    if (!records || records.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem;">No telemetry records found.</td></tr>';
      return;
    }

    records.forEach(row => {
      const tr = document.createElement('tr');
      const timeFormatted = row.timestamp ? new Date(row.timestamp).toLocaleString() : 'N/A';
      tr.innerHTML = `
        <td><strong>${timeFormatted}</strong></td>
        <td>${row.temp != null ? row.temp.toFixed(1) + ' °C' : '—'}</td>
        <td>${row.humidity != null ? row.humidity + ' %' : '—'}</td>
        <td>${row.pressure != null ? row.pressure.toFixed(1) + ' hPa' : '—'}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  // Initial load
  const initialStation = stationSelect ? stationSelect.value : (stations[0] ? stations[0].id : 'agumbe');
  renderTableForStation(initialStation);

  // Setup SheetJS Excel Drop Zone
  if (dropzone && fileInput) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        handleExcelFile(files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (fileInput.files && fileInput.files.length > 0) {
        handleExcelFile(fileInput.files[0]);
      }
    });
  }

  function handleExcelFile(file) {
    if (typeof XLSX === 'undefined') {
      showToast('SheetJS (xlsx) library not loaded. Check CDN connection.', 'danger');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json(worksheet);

        if (!jsonRows || jsonRows.length === 0) {
          showToast('Uploaded spreadsheet is empty.', 'warning');
          return;
        }

        const selectedStationName = stationSelect 
          ? stationSelect.options[stationSelect.selectedIndex].text.split(' ')[0] 
          : 'Agumbe';

        // Parse rows into standardized SkyGuard schema:
        // { "station": "...", "timestamp": "...", "temp": ..., "humidity": ..., "pressure": ..., "simulated": false }
        const parsedRows = jsonRows.map((row, index) => {
          // Flexible key lookup for spreadsheet columns
          const tempVal = parseFloat(row.temp ?? row.Temp ?? row.Temperature ?? row['Temp (°C)'] ?? 22.0);
          const humVal = parseFloat(row.humidity ?? row.Humidity ?? row['Humidity (%)'] ?? 85.0);
          const pressVal = parseFloat(row.pressure ?? row.Pressure ?? row['Pressure (hPa)'] ?? 1012.0);
          const stationName = row.station ?? row.Station ?? selectedStationName;
          
          let timestamp = row.timestamp ?? row.Timestamp ?? row.Time ?? row.Date;
          if (!timestamp) {
            const dateObj = new Date();
            dateObj.setHours(dateObj.getHours() - (jsonRows.length - index));
            timestamp = dateObj.toISOString();
          } else if (typeof timestamp === 'number') {
            // Excel serial date format
            timestamp = new Date(Math.round((timestamp - 25569) * 86400 * 1000)).toISOString();
          } else {
            timestamp = new Date(timestamp).toISOString();
          }

          return {
            station: stationName,
            timestamp: timestamp,
            temp: isNaN(tempVal) ? 22.0 : tempVal,
            humidity: isNaN(humVal) ? 85.0 : humVal,
            pressure: isNaN(pressVal) ? 1012.0 : pressVal,
            simulated: false
          };
        });

        // Broadcast as file-batch
        const batchPayload = {
          type: 'file-batch',
          filename: file.name,
          rows: parsedRows
        };

        send(batchPayload);
        showToast(`Parsed and dispatched ${parsedRows.length} rows from ${file.name} to receiver!`, 'success');

      } catch (err) {
        console.error('Error parsing Excel spreadsheet:', err);
        showToast(`Failed to parse Excel file: ${err.message}`, 'danger');
      }
    };

    reader.readAsArrayBuffer(file);
  }
}
