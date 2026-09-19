// cloud/static/js/data-loader.js
// ==========================================================================
// SkyGuard AI — Modular Data Loader
// Loads synthetic Karnataka AWS locations from JSON and enriches telemetry
// with multi-level gradient anomaly severity and probable diagnostic causes.
// ==========================================================================

export class AWSDataLoader {
  constructor() {
    this.stations = [];
    this.stationDatasets = new Map();
  }

  /**
   * Fetches the 5 synthetic Karnataka AWS stations from JSON.
   * Tries relative path /shared/stations.json, falling back to /api/stations.
   */
  async loadStations() {
    if (this.stations.length > 0) return this.stations;

    const urlsToTry = [
      '/shared/stations.json',
      '../shared/stations.json',
      '/api/stations',
      'shared/stations.json'
    ];

    for (const url of urlsToTry) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          this.stations = await res.json();
          return this.stations;
        }
      } catch (_) {
        // Try next fallback
      }
    }

    // Hard fallback if network/file restrictions apply
    this.stations = [
      { id: "agumbe", name: "Agumbe", lat: 13.505, lon: 75.092, district: "Shimoga", code: "KA-AGU-01" },
      { id: "kottigehara", name: "Kottigehara", lat: 13.350, lon: 75.530, district: "Chikkamagaluru", code: "KA-KOT-02" },
      { id: "kammaradi", name: "Kammaradi", lat: 13.400, lon: 75.600, district: "Shimoga", code: "KA-KAM-03" },
      { id: "kalasa", name: "Kalasa", lat: 13.230, lon: 75.350, district: "Chikkamagaluru", code: "KA-KAL-04" },
      { id: "bhagamandala", name: "Bhagamandala", lat: 12.400, lon: 75.530, district: "Kodagu", code: "KA-BHA-05" }
    ];
    return this.stations;
  }

  /**
   * Loads temporal hourly data for a given station ID,
   * evaluating and classifying values with multi-stage gradient severity.
   */
  async loadStationTemporalData(stationId) {
    const key = stationId.toLowerCase();
    if (this.stationDatasets.has(key)) {
      return this.stationDatasets.get(key);
    }

    let rawData = null;
    const urlsToTry = [
      `/shared/datasets/${key}.json`,
      `../shared/datasets/${key}.json`,
      `/api/stations/${key}/temporal`,
      `shared/datasets/${key}.json`
    ];

    for (const url of urlsToTry) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          rawData = await res.json();
          break;
        }
      } catch (_) {}
    }

    // If file could not be read, generate clean 24-hour synthetic data
    if (!rawData || !Array.isArray(rawData)) {
      rawData = this.generateFallbackHourlyData(stationId);
    }

    // Process and enrich each row with gradient anomaly scores and probable causes (4.png & 5.png)
    const enriched = this.enrichTemporalData(rawData, stationId);
    this.stationDatasets.set(key, enriched);
    return enriched;
  }

  /**
   * Enriches rows with:
   * - formatted time (HH:mm)
   * - parameter anomaly levels (none, mild, moderate, severe) matching 4.png
   * - diagnostic descriptions and probable causes matching 5.png
   */
  enrichTemporalData(rows, stationId) {
    return rows.map((row, idx) => {
      const timeStr = row.timestamp ? this.formatTime(row.timestamp) : `${String(idx).padStart(2, '0')}:00`;
      const temp = Number(row.temp ?? 24.0);
      const press = Number(row.pressure ?? 1012.0);
      const hum = Number(row.humidity ?? 80.0);

      // Temperature anomaly grading
      const tempStatus = this.evaluateTemperature(temp, idx, stationId);
      // Pressure anomaly grading
      const pressStatus = this.evaluatePressure(press, idx, stationId);
      // Humidity anomaly grading
      const humStatus = this.evaluateHumidity(hum, idx, stationId);

      return {
        id: `${stationId}_${idx}`,
        time: timeStr,
        temp: temp.toFixed(1),
        pressure: press.toFixed(1),
        humidity: Math.round(hum),
        tempStatus,
        pressStatus,
        humStatus
      };
    });
  }

  formatTime(isoStr) {
    try {
      const d = new Date(isoStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
      }
      return isoStr.substring(11, 16) || isoStr;
    } catch (_) {
      return isoStr;
    }
  }

  evaluateTemperature(temp, idx, stationId) {
    // Normal Agumbe/Western Ghats baseline: 18C - 30C
    // Specific injected demo points to ensure realistic gradient shading from 4.png
    if (idx === 14) {
      // Injected severe thermal spike
      return {
        severity: 'severe',
        label: 'Critical Thermal Spike',
        valueDisplay: `${temp + 12.5}°C`,
        numericVal: temp + 12.5,
        cause: "Abnormal temperature surge (+8.4°C/hr). Exceeds localized climatological maximum. Probable causes: Direct solar radiation shield degradation, RTD sensor bridge short, or localized dry foehn microburst."
      };
    }
    if (idx === 13) {
      // Injected moderate elevation moving toward anomaly
      return {
        severity: 'moderate',
        label: 'Elevated Temperature Warning',
        valueDisplay: `${temp + 6.2}°C`,
        numericVal: temp + 6.2,
        cause: "Elevated temperature gradient detected (+4.5°C over prior cycle). Probable causes: Solar radiation heating stagnation or aspirated fan ventilation slowdown."
      };
    }
    if (idx === 12) {
      // Injected mild deviation
      return {
        severity: 'mild',
        label: 'Mild Temperature Deviation',
        valueDisplay: `${temp + 2.8}°C`,
        numericVal: temp + 2.8,
        cause: "Slight departure from historical diurnal baseline (+2.8°C). Monitored for potential instrument drift."
      };
    }

    // Default threshold check
    if (temp > 38.0) {
      return {
        severity: 'severe',
        label: 'High Temperature Threshold Exceeded',
        valueDisplay: `${temp}°C`,
        numericVal: temp,
        cause: "Ambient temperature above 38.0°C. Probable causes: Extreme heat wave or ambient sensor shield failure."
      };
    }
    if (temp > 32.0) {
      return {
        severity: 'moderate',
        label: 'Moderate Temperature Deviation',
        valueDisplay: `${temp}°C`,
        numericVal: temp,
        cause: "Temperature elevated above diurnal median. Monitored for potential sensor heating."
      };
    }
    return { severity: 'none', valueDisplay: `${temp}°C`, numericVal: temp, cause: null };
  }

  evaluatePressure(press, idx, stationId) {
    // Standard barometric pressure: 1005 - 1016 hPa
    if (idx === 18) {
      // Injected barometric plunge
      return {
        severity: 'severe',
        label: 'Severe Barometric Drop',
        valueDisplay: `${(press - 14.8).toFixed(1)} hPa`,
        numericVal: press - 14.8,
        cause: "Rapid barometric pressure plunge (-9.2 hPa within 2 hours). Probable causes: Severe convective storm vortex, squall-line passage, or barometric sensor vent port condensation leak."
      };
    }
    if (idx === 17) {
      // Injected moderate pressure decline
      return {
        severity: 'moderate',
        label: 'Pressure Drop Warning',
        valueDisplay: `${(press - 7.5).toFixed(1)} hPa`,
        numericVal: press - 7.5,
        cause: "Steep pressure gradient drop (-4.8 hPa/hr). Probable causes: Mesoscale low-pressure trough development."
      };
    }
    if (idx === 16) {
      // Mild pressure variation
      return {
        severity: 'mild',
        label: 'Mild Pressure Drift',
        valueDisplay: `${(press - 3.2).toFixed(1)} hPa`,
        numericVal: press - 3.2,
        cause: "Minor barometric perturbation (-2.5 hPa). Approaching warning bounds."
      };
    }

    if (press < 985.0) {
      return {
        severity: 'severe',
        label: 'Depression Level Pressure',
        valueDisplay: `${press.toFixed(1)} hPa`,
        numericVal: press,
        cause: "Deep barometric depression detected. Probable causes: Severe cyclonic depression or pressure transducer failure."
      };
    }
    return { severity: 'none', valueDisplay: `${press.toFixed(1)} hPa`, numericVal: press, cause: null };
  }

  evaluateHumidity(hum, idx, stationId) {
    if (idx === 4) {
      // Injected humidity saturation / frozen run
      return {
        severity: 'severe',
        label: 'Critical Humidity Saturation',
        valueDisplay: `99.8%`,
        numericVal: 99.8,
        cause: "Continuous 99.8% saturation reading with zero dew-point depression. Probable causes: Capacitive hygrometer element water-logging, condensation film bridging, or sensor housing seal breach."
      };
    }
    if (idx === 5) {
      return {
        severity: 'moderate',
        label: 'High Humidity Saturation Warning',
        valueDisplay: `98.4%`,
        numericVal: 98.4,
        cause: "High saturation persistence in valley microclimate. Approaching capacitive sensor saturation limit."
      };
    }
    if (idx === 6) {
      return {
        severity: 'mild',
        label: 'Mild Humidity Elevation',
        valueDisplay: `95.0%`,
        numericVal: 95.0,
        cause: "Elevated moisture readings typical of early morning condensation."
      };
    }

    return { severity: 'none', valueDisplay: `${Math.round(hum)}%`, numericVal: hum, cause: null };
  }

  generateFallbackHourlyData(stationId) {
    const data = [];
    for (let h = 0; h < 24; h++) {
      const temp = +(20.0 + 5.0 * Math.sin((h - 6) * Math.PI / 12)).toFixed(1);
      const press = +(1012.0 - 2.0 * Math.sin((h - 4) * Math.PI / 12)).toFixed(1);
      const hum = Math.round(85.0 - 15.0 * Math.sin((h - 6) * Math.PI / 12));
      data.push({
        timestamp: `2026-09-01T${String(h).padStart(2, '0')}:00:00`,
        temp,
        pressure: press,
        humidity: hum
      });
    }
    return data;
  }
}
