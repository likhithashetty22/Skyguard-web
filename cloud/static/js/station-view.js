// cloud/static/js/station-view.js
// ==========================================================================
// SkyGuard AI — Right-Side Station Dashboard Component
// Manages Section 1 (Temporal Telemetry Table with Gradient Anomaly Shading)
// and Section 2 (Anomaly Diagnosis Table with Probable Causes).
// Matches 4.png and 5.png UI specifications.
// ==========================================================================

export class StationViewManager {
  constructor(elements) {
    this.emptyStateEl = elements.emptyStateEl;
    this.stationCardEl = elements.stationCardEl;
    this.diagnosisCardEl = elements.diagnosisCardEl;
    
    this.stationTitleEl = elements.stationTitleEl;
    this.stationCoordsEl = elements.stationCoordsEl;
    this.tableBodyEl = elements.tableBodyEl;
    
    this.diagnosisTableBodyEl = elements.diagnosisTableBodyEl;
    this.diagnosisTitleEl = elements.diagnosisTitleEl;
    this.btnCloseDiagnosis = elements.btnCloseDiagnosis;

    this.activeCellEl = null;

    if (this.btnCloseDiagnosis) {
      this.btnCloseDiagnosis.addEventListener('click', () => {
        this.hideDiagnosis();
      });
    }
  }

  /**
   * Renders the top station card and temporal data table (4.png).
   * @param {Object} station - Station metadata { id, name, lat, lon, code, district }
   * @param {Array} temporalRows - Array of enriched temporal telemetry rows
   */
  renderStationData(station, temporalRows) {
    if (!station || !temporalRows) return;

    // 1. Hide empty placeholder, show station data card
    if (this.emptyStateEl) this.emptyStateEl.style.display = 'none';
    if (this.stationCardEl) this.stationCardEl.style.display = 'flex';

    // 2. Hide previous diagnosis card until a specific anomaly is clicked
    this.hideDiagnosis();

    // 3. Update Header (e.g. Location name and XX.XX.XX from 4.png)
    if (this.stationTitleEl) {
      this.stationTitleEl.textContent = station.name;
    }
    if (this.stationCoordsEl) {
      const latStr = `${Number(station.lat).toFixed(3)}°N`;
      const lonStr = `${Number(station.lon).toFixed(3)}°E`;
      const codeStr = station.code || `AWS-KA-${station.id.substring(0, 3).toUpperCase()}`;
      this.stationCoordsEl.textContent = `${latStr}, ${lonStr} • ${codeStr}`;
    }

    // 4. Render Scrollable Temporal Telemetry Table (4.png)
    if (!this.tableBodyEl) return;
    this.tableBodyEl.innerHTML = '';

    temporalRows.forEach(row => {
      const tr = document.createElement('tr');

      // Col 1: Time
      const tdTime = document.createElement('td');
      tdTime.textContent = row.time;
      tdTime.className = 'cell-time';
      tr.appendChild(tdTime);

      // Col 2: Celcius (Temperature with gradient anomaly shading)
      const tdTemp = document.createElement('td');
      tdTemp.textContent = `${row.temp} °C`;
      this.applyGradientShading(tdTemp, row.tempStatus, row, 'Temperature');
      tr.appendChild(tdTemp);

      // Col 3: hPa (Pressure with gradient anomaly shading)
      const tdPress = document.createElement('td');
      tdPress.textContent = `${row.pressure}`;
      this.applyGradientShading(tdPress, row.pressStatus, row, 'Pressure');
      tr.appendChild(tdPress);

      // Col 4: % humidity (Humidity with gradient anomaly shading)
      const tdHum = document.createElement('td');
      tdHum.textContent = `${row.humidity} %`;
      this.applyGradientShading(tdHum, row.humStatus, row, 'Humidity');
      tr.appendChild(tdHum);

      this.tableBodyEl.appendChild(tr);
    });
  }

  /**
   * Applies gradient red shading according to anomaly severity.
   * Matches 4.png requirement:
   * "(Rather than just marking as red for anomalies, we want some of the values to have slight red color,
   * which are moving towards anomaly with different shades leading to red.)"
   */
  applyGradientShading(tdElement, statusObj, row, variableName) {
    if (!statusObj || statusObj.severity === 'none') {
      return;
    }

    tdElement.classList.add('cell-shaded');

    // Multi-level red gradient scale
    if (statusObj.severity === 'mild') {
      tdElement.classList.add('anomaly-mild');
      tdElement.title = `Mild Deviation: ${statusObj.label || 'Approaching threshold'}. Click to inspect.`;
    } else if (statusObj.severity === 'moderate') {
      tdElement.classList.add('anomaly-moderate');
      tdElement.title = `Moderate Anomaly Warning: ${statusObj.label || 'Elevated departure'}. Click to inspect.`;
    } else if (statusObj.severity === 'severe') {
      tdElement.classList.add('anomaly-severe');
      tdElement.title = `🚨 Critical Anomaly: ${statusObj.label || 'Threshold breach'}. Click to inspect.`;
    }

    // Clicking any colored/anomaly cell opens Section 2 below! (Matches 4.png & 5.png)
    tdElement.addEventListener('click', (e) => {
      e.stopPropagation();

      // Clear previous active cell outline
      if (this.activeCellEl) {
        this.activeCellEl.classList.remove('active-cell');
      }
      tdElement.classList.add('active-cell');
      this.activeCellEl = tdElement;

      // Open Diagnosis Table
      this.renderDiagnosis(row.time, variableName, tdElement.textContent, statusObj);
    });
  }

  /**
   * Renders the bottom Anomaly Diagnosis Table (5.png).
   * Displays: Time | Variable (Value) | Description of the anomaly, the probable causes.
   */
  renderDiagnosis(timeStr, varName, valueStr, statusObj) {
    if (!this.diagnosisCardEl || !this.diagnosisTableBodyEl) return;

    if (this.diagnosisTitleEl) {
      this.diagnosisTitleEl.innerHTML = `<span>⚠️</span> Anomaly Diagnostic Report • ${varName} at ${timeStr}`;
    }

    this.diagnosisTableBodyEl.innerHTML = `
      <tr>
        <td class="diagnosis-time-col">
          <strong>${timeStr}</strong>
        </td>
        <td class="diagnosis-variable-col">
          <div>${varName}</div>
          <div style="font-size: 1.1rem; color: #ef4444; margin-top: 2px;">${valueStr}</div>
          <div style="font-size: 0.72rem; color: #fca5a5; text-transform: uppercase;">${statusObj.label || statusObj.severity + ' anomaly'}</div>
        </td>
        <td class="diagnosis-desc-col">
          <p>${statusObj.cause || 'Anomalous deviation detected by telemetry rules. Probable sensor calibration drift or localized microclimate disruption.'}</p>
        </td>
      </tr>
    `;

    // Make diagnosis section visible with smooth entrance animation
    this.diagnosisCardEl.classList.add('visible');
    
    // Smoothly ensure it's in view
    this.diagnosisCardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * Hides the diagnosis card when dismissed or station changed.
   */
  hideDiagnosis() {
    if (this.diagnosisCardEl) {
      this.diagnosisCardEl.classList.remove('visible');
    }
    if (this.activeCellEl) {
      this.activeCellEl.classList.remove('active-cell');
      this.activeCellEl = null;
    }
  }
}
