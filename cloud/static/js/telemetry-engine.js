/**
 * SkyGuard AI — Cloud Telemetry Engine & Hardware Analytics Visualizer
 * Client-Side SheetJS Exporter, Hardware Health Gauges, Chart.js Analytics & Event Log Stream
 */

(function () {
  'use strict';

  // State Management
  const state = {
    sessionLogs: [],
    hardwareHealth: {
      rssi: -68,
      latency: 42,
      packetLoss: 0.1,
      snr: 28.5,
      senderStatus: 'NOMINAL',
      receiverStatus: 'NOMINAL'
    },
    analyticsChart: null,
    cookieConsent: localStorage.getItem('skyguard_cookie_consent') === 'true'
  };

  // DOM Elements
  document.addEventListener('DOMContentLoaded', () => {
    initTelemetrySimulation();
    initAnalyticsChart();
    initCookieBanner();
    initModals();
    bindExportEvents();
    bindHardwareControls();
  });

  // -----------------------------------------------------------------------------------------
  // 1. Hardware Telemetry & Health Gauges Simulation
  // -----------------------------------------------------------------------------------------
  function initTelemetrySimulation() {
    setInterval(() => {
      // Fluctuating hardware telemetry metrics
      const rssiDelta = (Math.random() - 0.48) * 4;
      const latencyDelta = (Math.random() - 0.48) * 8;
      const lossDelta = (Math.random() - 0.49) * 0.2;
      const snrDelta = (Math.random() - 0.48) * 1.5;

      state.hardwareHealth.rssi = Math.min(-40, Math.max(-110, Math.round(state.hardwareHealth.rssi + rssiDelta)));
      state.hardwareHealth.latency = Math.min(350, Math.max(15, Math.round(state.hardwareHealth.latency + latencyDelta)));
      state.hardwareHealth.packetLoss = Math.min(15, Math.max(0, parseFloat((state.hardwareHealth.packetLoss + lossDelta).toFixed(1))));
      state.hardwareHealth.snr = Math.min(45, Math.max(5, parseFloat((state.hardwareHealth.snr + snrDelta).toFixed(1))));

      // Update UI Gauges
      updateGaugeUI();

      // Ingest log sample
      const logEntry = {
        timestamp: new Date().toISOString(),
        session_id: 'SESS-' + Math.floor(100000 + Math.random() * 900000),
        node_type: Math.random() > 0.5 ? 'Sender Node (AWS)' : 'Receiver Node (Gateway)',
        signal_strength_rssi: state.hardwareHealth.rssi,
        latency_ms: state.hardwareHealth.latency,
        packet_loss_pct: state.hardwareHealth.packetLoss,
        snr_db: state.hardwareHealth.snr,
        system_status: (state.hardwareHealth.rssi < -85 || state.hardwareHealth.latency > 150) ? 'WARNING' : 'NOMINAL'
      };

      state.sessionLogs.unshift(logEntry);
      if (state.sessionLogs.length > 500) state.sessionLogs.pop();

      // Terminal Audit Log Stream Entry
      if (Math.random() > 0.6) {
        const severity = logEntry.system_status === 'WARNING' ? 'WARN' : 'INFO';
        appendTerminalAuditLog(severity, `${logEntry.node_type} - RSSI: ${logEntry.signal_strength_rssi} dBm, Latency: ${logEntry.latency_ms} ms, SNR: ${logEntry.snr_db} dB`);
      }

      // Threshold-Triggered Emergency Export Check
      if (state.hardwareHealth.rssi < -85 || state.hardwareHealth.latency > 150) {
        triggerThresholdAlert(state.hardwareHealth.rssi, state.hardwareHealth.latency);
      }

      // Update Chart.js if initialized
      if (state.analyticsChart) {
        const timeLabel = new Date().toLocaleTimeString();
        state.analyticsChart.data.labels.push(timeLabel);
        if (state.analyticsChart.data.labels.length > 15) {
          state.analyticsChart.data.labels.shift();
          state.analyticsChart.data.datasets.forEach(ds => ds.data.shift());
        }
        state.analyticsChart.data.datasets[0].data.push(state.hardwareHealth.rssi);
        state.analyticsChart.data.datasets[1].data.push(state.hardwareHealth.latency);
        state.analyticsChart.update();
      }
    }, 2500);
  }

  function updateGaugeUI() {
    const rssiVal = document.getElementById('gauge-rssi-val');
    const rssiBar = document.getElementById('gauge-rssi-bar');
    const latencyVal = document.getElementById('gauge-latency-val');
    const latencyBar = document.getElementById('gauge-latency-bar');
    const lossVal = document.getElementById('gauge-loss-val');
    const lossBar = document.getElementById('gauge-loss-bar');
    const snrVal = document.getElementById('gauge-snr-val');
    const snrBar = document.getElementById('gauge-snr-bar');

    if (rssiVal) rssiVal.textContent = `${state.hardwareHealth.rssi} dBm`;
    if (rssiBar) {
      const pct = Math.max(0, Math.min(100, ((state.hardwareHealth.rssi + 110) / 70) * 100));
      rssiBar.style.width = `${pct}%`;
      rssiBar.style.backgroundColor = state.hardwareHealth.rssi < -85 ? '#ef4444' : '#10b981';
    }

    if (latencyVal) latencyVal.textContent = `${state.hardwareHealth.latency} ms`;
    if (latencyBar) {
      const pct = Math.max(0, Math.min(100, (state.hardwareHealth.latency / 200) * 100));
      latencyBar.style.width = `${pct}%`;
      latencyBar.style.backgroundColor = state.hardwareHealth.latency > 150 ? '#f59e0b' : '#38bdf8';
    }

    if (lossVal) lossVal.textContent = `${state.hardwareHealth.packetLoss}%`;
    if (lossBar) lossBar.style.width = `${Math.min(100, state.hardwareHealth.packetLoss * 10)}%`;

    if (snrVal) snrVal.textContent = `${state.hardwareHealth.snr} dB`;
    if (snrBar) snrBar.style.width = `${Math.min(100, (state.hardwareHealth.snr / 40) * 100)}%`;
  }

  // -----------------------------------------------------------------------------------------
  // 2. SheetJS Dynamic Spreadsheet Engine (.xlsx & .csv)
  // -----------------------------------------------------------------------------------------
  function bindExportEvents() {
    const btnExcelHeader = document.getElementById('btn-export-excel-header');
    const btnExcelSection = document.getElementById('btn-export-excel');
    const btnCsvSection = document.getElementById('btn-export-csv');
    const btnAutoArchive = document.getElementById('btn-trigger-auto-archive');

    if (btnExcelHeader) btnExcelHeader.addEventListener('click', () => exportSessionData('xlsx'));
    if (btnExcelSection) btnExcelSection.addEventListener('click', () => exportSessionData('xlsx'));
    if (btnCsvSection) btnCsvSection.addEventListener('click', () => exportSessionData('csv'));
    if (btnAutoArchive) btnAutoArchive.addEventListener('click', generate24HourAutoArchive);
  }

  function exportSessionData(format = 'xlsx') {
    if (state.sessionLogs.length === 0) {
      showToast('No active telemetry logs to export', 'warning');
      return;
    }

    // Format fields according to enterprise specification
    const exportData = state.sessionLogs.map(log => ({
      timestamp: log.timestamp,
      session_id: log.session_id,
      node_type: log.node_type,
      signal_strength_rssi: log.signal_strength_rssi,
      latency_ms: log.latency_ms,
      packet_loss_pct: log.packet_loss_pct,
      snr_db: log.snr_db,
      system_status: log.system_status
    }));

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `SkyGuard_Telemetry_Log_${dateStr}.${format}`;

    if (format === 'xlsx' && typeof XLSX !== 'undefined') {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Telemetry Audit');
      XLSX.writeFile(wb, filename);
      showToast(`Exported ${exportData.length} records to ${filename}`, 'success');
      appendTerminalAuditLog('INFO', `Dataset exported as binary Excel (.xlsx): ${filename}`);
    } else {
      // Fallback CSV export
      const headers = Object.keys(exportData[0]).join(',');
      const rows = exportData.map(row => Object.values(row).map(v => `"${v}"`).join(','));
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Exported ${exportData.length} records to ${filename}`, 'success');
      appendTerminalAuditLog('INFO', `Dataset exported as CSV: ${filename}`);
    }
  }

  let emergencyTriggered = false;
  function triggerThresholdAlert(rssi, latency) {
    if (emergencyTriggered) return;
    emergencyTriggered = true;

    showToast(`CRITICAL TELEMETRY BREACH - RSSI: ${rssi} dBm | Latency: ${latency} ms`, 'error');
    appendTerminalAuditLog('WARN', `Threshold breach detected (RSSI < -85 dBm or Latency > 150 ms). Triggering Emergency Data Dump.`);

    setTimeout(() => {
      exportSessionData('xlsx');
      setTimeout(() => { emergencyTriggered = false; }, 30000);
    }, 1000);
  }

  function generate24HourAutoArchive() {
    showToast('Generating 24-Hour Automated Archive Log...', 'info');
    appendTerminalAuditLog('INFO', 'Daily 24-Hour Log Generation Daemon started.');
    setTimeout(() => {
      exportSessionData('xlsx');
    }, 1500);
  }

  // -----------------------------------------------------------------------------------------
  // 3. Interactive Analytics & Pre-Export Data Filtering (Chart.js)
  // -----------------------------------------------------------------------------------------
  function initAnalyticsChart() {
    const canvas = document.getElementById('telemetryAnalyticsChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const ctx = canvas.getContext('2d');
    state.analyticsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Signal Strength (RSSI dBm)',
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            data: [],
            yAxisID: 'yRSSI',
            tension: 0.3,
            fill: true
          },
          {
            label: 'Latency (Ping ms)',
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            data: [],
            yAxisID: 'yLatency',
            tension: 0.3,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8' } }
        },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } },
          yRSSI: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'RSSI (dBm)', color: '#38bdf8' },
            ticks: { color: '#38bdf8' },
            grid: { color: '#1e293b' }
          },
          yLatency: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: 'Latency (ms)', color: '#f59e0b' },
            ticks: { color: '#f59e0b' },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }

  // -----------------------------------------------------------------------------------------
  // 4. Command & Control Hardware Panel (Receiver / Cloud Bridge)
  // -----------------------------------------------------------------------------------------
  function bindHardwareControls() {
    const btn1Hz = document.getElementById('btn-sample-1hz');
    const btn10Hz = document.getElementById('btn-sample-10hz');
    const btnToggleLogging = document.getElementById('btn-toggle-logging');
    const btnManualDump = document.getElementById('btn-manual-dump');

    if (btn1Hz && btn10Hz) {
      btn1Hz.addEventListener('click', () => {
        btn1Hz.classList.add('active');
        btn10Hz.classList.remove('active');
        showToast('Sampling frequency set to 1 Hz', 'info');
        appendTerminalAuditLog('INFO', 'Command sent to Receiver Node: Set sampling rate to 1 Hz.');
      });

      btn10Hz.addEventListener('click', () => {
        btn10Hz.classList.add('active');
        btn1Hz.classList.remove('active');
        showToast('Sampling frequency set to 10 Hz', 'info');
        appendTerminalAuditLog('INFO', 'Command sent to Receiver Node: Set sampling rate to 10 Hz.');
      });
    }

    if (btnToggleLogging) {
      let enabled = true;
      btnToggleLogging.addEventListener('click', () => {
        enabled = !enabled;
        btnToggleLogging.textContent = enabled ? 'Enabled' : 'Disabled';
        btnToggleLogging.classList.toggle('active', enabled);
        showToast(`Remote logging ${enabled ? 'enabled' : 'disabled'}`, 'info');
        appendTerminalAuditLog('WARN', `Remote telemetry logging relay state changed to: ${enabled ? 'ENABLED' : 'DISABLED'}`);
      });
    }

    if (btnManualDump) {
      btnManualDump.addEventListener('click', () => {
        showToast('Triggering force manual hardware dump...', 'info');
        appendTerminalAuditLog('INFO', 'Manual hardware dump requested by operator.');
        exportSessionData('xlsx');
      });
    }
  }

  // -----------------------------------------------------------------------------------------
  // 5. Terminal Audit Log Stream & Floating Toast System
  // -----------------------------------------------------------------------------------------
  function appendTerminalAuditLog(level, message) {
    const terminal = document.getElementById('terminal-audit-stream');
    if (!terminal) return;

    const timeStr = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = `term-line term-${level.toLowerCase()}`;
    line.innerHTML = `<span class="term-time">[${timeStr}]</span> <span class="term-badge term-badge-${level.toLowerCase()}">[${level}]</span> ${message}`;

    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;

    // Maintain max 100 entries
    while (terminal.children.length > 100) {
      terminal.removeChild(terminal.firstChild);
    }
  }

  function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.cssText = `
      padding: 12px 18px;
      border-radius: 8px;
      color: #fff;
      font-size: 0.875rem;
      font-weight: 500;
      box-shadow: 0 4px 14px rgba(0,0,0,0.4);
      transition: all 0.3s ease;
      background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : type === 'success' ? '#10b981' : '#0284c7'};
      border-left: 4px solid ${type === 'error' ? '#991b1b' : type === 'warning' ? '#b45309' : type === 'success' ? '#047857' : '#0369a1'};
    `;
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // -----------------------------------------------------------------------------------------
  // 6. Cookie Consent & Legal Documentation Modals
  // -----------------------------------------------------------------------------------------
  function initCookieBanner() {
    const banner = document.getElementById('cookie-consent-banner');
    const btnAccept = document.getElementById('btn-accept-cookies');

    if (!banner || !btnAccept) return;

    if (!state.cookieConsent) {
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }

    btnAccept.addEventListener('click', () => {
      localStorage.setItem('skyguard_cookie_consent', 'true');
      state.cookieConsent = true;
      banner.style.display = 'none';
      showToast('Cookie & Privacy preferences saved.', 'success');
    });
  }

  function initModals() {
    const bindModal = (triggerId, modalId, closeId) => {
      const trigger = document.getElementById(triggerId);
      const modal = document.getElementById(modalId);
      const close = document.getElementById(closeId);

      if (trigger && modal) {
        trigger.addEventListener('click', (e) => {
          e.preventDefault();
          modal.style.display = 'flex';
        });
      }

      if (close && modal) {
        close.addEventListener('click', () => {
          modal.style.display = 'none';
        });
      }

      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) modal.style.display = 'none';
        });
      }
    };

    bindModal('btn-open-arch-modal', 'modal-architecture', 'btn-close-arch-modal');
    bindModal('btn-open-privacy-modal', 'modal-privacy', 'btn-close-privacy-modal');
    bindModal('btn-open-terms-modal', 'modal-terms', 'btn-close-terms-modal');
  }

})();
