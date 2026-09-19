// receiver/js/anomaly-rules.js
// Pure client-side rule logic for SkyGuard AI anomaly detection + Hybrid Rule/ML Verdict Merge

export const THRESHOLDS = {
  temp:     { min: 5,   max: 45,  maxDelta: 8 },
  humidity: { min: 5,   max: 100, maxDelta: 30 },
  pressure: { min: 950, max: 1050, maxDelta: 6 }
};

const lastReading = {};
const consecutiveIdenticalCount = {};

/**
 * Evaluates raw sensor readings against physical meteorological bounds and temporal spike thresholds.
 * Also monitors consecutive identical values to detect frozen sensor failure runs.
 */
export function checkAnomaly(reading) {
  const flags = [];
  const stationId = reading.station || 'DEFAULT';
  const prev = lastReading[stationId];

  // 1. Physical limits and temporal spike checks
  for (const key of ["temp", "humidity", "pressure"]) {
    const { min, max, maxDelta } = THRESHOLDS[key];
    const value = reading[key];

    if (value < min || value > max) {
      flags.push({ param: key, type: "out_of_range", value });
    }
    if (prev && Math.abs(value - prev[key]) > maxDelta) {
      flags.push({ param: key, type: "spike", value, delta: value - prev[key] });
    }
  }

  // 2. Frozen sensor detection (stuck instrument run)
  if (prev && 
      Math.abs(reading.temp - prev.temp) < 0.001 &&
      Math.abs(reading.humidity - prev.humidity) < 0.001 &&
      Math.abs(reading.pressure - prev.pressure) < 0.001) {
    consecutiveIdenticalCount[stationId] = (consecutiveIdenticalCount[stationId] || 1) + 1;
    if (consecutiveIdenticalCount[stationId] >= 3) {
      flags.push({ 
        param: "sensor", 
        type: "frozen_run", 
        value: reading.temp,
        count: consecutiveIdenticalCount[stationId]
      });
    }
  } else {
    consecutiveIdenticalCount[stationId] = 1;
  }

  const pressureOnlyDrift =
    flags.length === 1 && flags[0].param === "pressure" && flags[0].type === "spike";

  const hasFrozenRun = flags.some(f => f.type === "frozen_run");

  lastReading[stationId] = reading;

  if (flags.length === 0) return { status: "normal", confidence: 1, flags: [] };

  const severity = Math.min(100, flags.length * 30 + (pressureOnlyDrift ? 20 : 0) + (hasFrozenRun ? 35 : 0));
  const confidence = Math.min(0.95, 0.5 + flags.length * 0.15);

  return {
    status: severity > 60 ? "critical" : "warning",
    severity,
    confidence,
    rootCause: flags.map(f => `${f.param} ${f.type}`).join(", "),
    flags
  };
}

/**
 * Combines the Virtual ESP32 TinyML edge verdict with the deterministic rule-based verdict.
 * If the rule layer flags a hard override (e.g. frozen sensor run or severe out-of-range breach),
 * the rule verdict takes priority; otherwise the distilled ML verdict and its confidence are used.
 * Both the rule flags and the decision path are preserved for jury review and explainability.
 * 
 * @param {Object} mlResult - {status, confidence, decisionPath, rootCause}
 * @param {Object} ruleResult - {status, severity, confidence, rootCause, flags}
 * @returns {Object} Unified judgment object
 */
export function mergeVerdicts(mlResult, ruleResult) {
  if (!mlResult && !ruleResult) {
    return { status: "unknown", confidence: 0, rootCause: "No data", flags: [], decisionPath: [] };
  }
  if (!mlResult) return ruleResult;
  if (!ruleResult) return mlResult;

  // Hard override condition: frozen sensor run OR extreme out-of-range sensor breach
  const isFrozenRun = ruleResult.flags && ruleResult.flags.some(f => f.type === "frozen_run");
  const isExtremeRange = ruleResult.flags && ruleResult.flags.some(f => 
    f.type === "out_of_range" && (
      (f.param === "temp" && (f.value < 0 || f.value > 50)) ||
      (f.param === "humidity" && (f.value < 0 || f.value > 105)) ||
      (f.param === "pressure" && (f.value < 900 || f.value > 1065))
    )
  );

  const hardOverride = isFrozenRun || isExtremeRange;

  let finalStatus = mlResult.status;
  let finalConfidence = mlResult.confidence;
  let finalRootCause = mlResult.rootCause;

  if (hardOverride) {
    // Deterministic safety rules override ML verdict
    finalStatus = ruleResult.status || "critical";
    finalConfidence = Math.max(ruleResult.confidence || 0.95, mlResult.confidence || 0.85);
    finalRootCause = `[SAFETY RULE OVERRIDE] ${ruleResult.rootCause}`;
  }

  return {
    status: finalStatus,
    severity: ruleResult.severity != null ? ruleResult.severity : (finalStatus === "critical" ? 85 : (finalStatus === "warning" ? 50 : 0)),
    confidence: finalConfidence,
    rootCause: finalRootCause,
    decisionPath: mlResult.decisionPath || [],
    flags: ruleResult.flags || []
  };
}
