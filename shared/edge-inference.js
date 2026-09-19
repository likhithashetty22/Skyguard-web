// shared/edge-inference.js
// =========================================================================================
// SkyGuard AI - Virtual ESP32 TinyML Edge Inference Module
//
// FRAMING STATEMENT:
// This module simulates on-device TinyML inference in the browser, standing in for an ESP32
// microcontroller node. It executes a shallow decision tree distilled offline from a complex
// Isolation Forest "teacher" model.
// NOTE: This is a browser-based software simulation of edge inference for architecture validation
// and evaluation; it is not running on physical ESP32 hardware.
// =========================================================================================

// Embedded fallback model for environments where fetch() is restricted (e.g. file:// in Chrome)
const FALLBACK_TINYML_MODEL = {
  features: ["temp", "humidity", "pressure", "temp_delta", "humidity_delta", "pressure_delta", "dew_point_delta"],
  tree: {
    feature: "pressure_delta",
    threshold: 6.0,
    left: {
      feature: "temp_delta",
      threshold: 8.0,
      left: {
        feature: "humidity_delta",
        threshold: 30.0,
        left: {
          feature: "temp",
          threshold: 45.0,
          left: {
            feature: "temp",
            threshold: 5.0,
            left: { leaf: "warning", confidence: 0.78 },
            right: {
              feature: "dew_point_delta",
              threshold: 5.0,
              left: { leaf: "normal", confidence: 0.95 },
              right: { leaf: "warning", confidence: 0.72 }
            }
          },
          "right": { leaf: "critical", confidence: 0.91 }
        },
        "right": { leaf: "warning", confidence: 0.82 }
      },
      "right": { leaf: "critical", confidence: 0.89 }
    },
    "right": {
      feature: "pressure_delta",
      threshold: 12.0,
      left: { leaf: "warning", confidence: 0.75 },
      right: { leaf: "critical", confidence: 0.94 }
    }
  }
};

let cachedModel = null;
const lastReadingCache = {};

/**
 * Loads the distilled TinyML model once and caches it.
 */
export async function loadTinyMLModel() {
  if (cachedModel) return cachedModel;

  try {
    // Determine path relative to current location
    const modelPath = typeof window !== 'undefined' && window.location.pathname.includes('/sender/') || 
                      (typeof window !== 'undefined' && window.location.pathname.includes('/receiver/'))
      ? '../shared/tinyml-model.json'
      : './shared/tinyml-model.json';

    const res = await fetch(modelPath);
    if (res.ok) {
      cachedModel = await res.json();
      return cachedModel;
    }
  } catch (err) {
    console.warn('[SkyGuard Edge-Inference] fetch(tinyml-model.json) warning, using embedded model:', err);
  }

  cachedModel = FALLBACK_TINYML_MODEL;
  return cachedModel;
}

/**
 * Computes estimated dew point using standard linear approximation:
 * T_dp ≈ T - ((100 - RH) / 5)
 */
function approximateDewPoint(temp, humidity) {
  return temp - ((100 - humidity) / 5);
}

/**
 * Runs client-side TinyML edge inference simulating an on-device ESP32 node.
 * 
 * @param {Object} reading - Sensor reading containing {station, temp, humidity, pressure}
 * @returns {Promise<Object>} Judgment object {status, confidence, decisionPath, rootCause}
 */
export async function runEdgeInference(reading) {
  if (!reading) {
    return { status: "unknown", confidence: 0, decisionPath: [], rootCause: "Empty reading" };
  }

  const model = await loadTinyMLModel();
  const stationId = reading.station || 'DEFAULT_STATION';
  const prev = lastReadingCache[stationId];

  // 1. Compute delta features if not already precomputed
  const temp = Number(reading.temp ?? 22.0);
  const humidity = Number(reading.humidity ?? 80.0);
  const pressure = Number(reading.pressure ?? 1012.0);

  const temp_delta = reading.temp_delta != null 
    ? Number(reading.temp_delta) 
    : (prev ? Math.abs(temp - prev.temp) : 0);

  const humidity_delta = reading.humidity_delta != null 
    ? Number(reading.humidity_delta) 
    : (prev ? Math.abs(humidity - prev.humidity) : 0);

  const pressure_delta = reading.pressure_delta != null 
    ? Number(reading.pressure_delta) 
    : (prev ? Math.abs(pressure - prev.pressure) : 0);

  const curDewPoint = approximateDewPoint(temp, humidity);
  const prevDewPoint = prev ? approximateDewPoint(prev.temp, prev.humidity) : curDewPoint;
  const dew_point_delta = reading.dew_point_delta != null
    ? Number(reading.dew_point_delta)
    : Math.abs(curDewPoint - prevDewPoint);

  const featureValues = {
    temp,
    humidity,
    pressure,
    temp_delta,
    humidity_delta,
    pressure_delta,
    dew_point_delta
  };

  // 2. Walk the distilled decision tree
  const decisionPath = [];
  let currentNode = model.tree;
  let lastDecisiveComparison = null;

  while (currentNode && !currentNode.leaf) {
    const feat = currentNode.feature;
    const thresh = currentNode.threshold;
    const val = featureValues[feat] != null ? featureValues[feat] : 0;

    if (val <= thresh) {
      decisionPath.push(`${feat} (${val.toFixed(1)}) <= ${thresh} -> left`);
      currentNode = currentNode.left;
    } else {
      decisionPath.push(`${feat} (${val.toFixed(1)}) > ${thresh} -> right`);
      lastDecisiveComparison = `${feat} exceeded ${thresh} (measured: ${val.toFixed(1)})`;
      currentNode = currentNode.right;
    }
  }

  // 3. Update station's last reading cache
  lastReadingCache[stationId] = { temp, humidity, pressure, dewPoint: curDewPoint };

  const finalLeaf = currentNode ? currentNode.leaf : "normal";
  const confidence = currentNode && currentNode.confidence != null ? currentNode.confidence : 0.9;

  let rootCause = "All parameters within normal bounds";
  if (finalLeaf !== "normal") {
    rootCause = lastDecisiveComparison || `${finalLeaf.toUpperCase()} anomaly pattern detected by edge model`;
  }

  return {
    status: finalLeaf,
    confidence: Number(confidence.toFixed(2)),
    decisionPath,
    rootCause
  };
}
