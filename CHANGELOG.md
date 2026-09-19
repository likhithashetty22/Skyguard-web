# SkyGuard AI — Changelog & Architecture Narrative

## [2.1.0] - 2026-09-07

### 🌟 Distilled TinyML Model + Virtual ESP32 + India Map View

This release implements an on-device Edge AI simulation for Automatic Weather Stations (AWS), addressing Smart India Hackathon 2026 problem statement SIH26073 (India Meteorological Department).

#### 1. Distilled TinyML Model Export (`shared/tinyml-model.json`)
- **Offline Teacher Model**: An Isolation Forest algorithm trained offline in Python with $contamination=0.05$ and $n\_estimators=100$.
- **Distilled Edge Tree**: A shallow decision tree was distilled from the Isolation Forest to mimic its anomaly decision boundaries within resource constraints compatible with microcontroller firmware.
- **Node Contract**: Exported to pure JSON with internal nodes (`feature`, `threshold`, `left`, `right`) and leaf nodes (`leaf`, `confidence`).
- Evaluates temporal deltas (`temp_delta`, `humidity_delta`, `pressure_delta`) and psychrometric consistency (`dew_point_delta`).

#### 2. Virtual ESP32 Edge Inference (`shared/edge-inference.js`)
- **Framing & Ethics**: Software simulation running in the browser standing in for edge IoT hardware (e.g., Espressif ESP32-WROOM-32).
- **Edge Feature Engineering**: Maintains on-device memory to compute rate-of-change deltas and linear dew-point approximation:
  $$T_{dp} \approx T - \frac{100 - RH}{5}$$
- **Tree Walking**: Traverses the distilled model client-side and outputs `{status, confidence, decisionPath, rootCause}`.

#### 3. Bandwidth-Optimized Edge Transmission (`sender/js/sender.js`)
- **Simulated Edge Shift**: Before transmission via `transport.send()`, readings are inferred locally on the simulated edge device.
- **Telemetry Payload**: The sender now transmits only the edge judgment `{station, timestamp, status, confidence, rootCause, decisionPath, simulated}` without raw temperature, humidity, or pressure, mirroring real-world low-bandwidth satellite/GPRS AWS edge deployments.
- **Backward Compatibility**: Preserved support for historical CSV and SheetJS Excel batch uploads (`file-batch`).

#### 4. Hybrid Decision Layer (`receiver/js/anomaly-rules.js`)
- **Safety Override Engine**: Added `mergeVerdicts(mlResult, ruleResult)` and frozen sensor failure run detection (`frozen_run`).
- If deterministic safety bounds or frozen instrument runs trigger, deterministic rules override the model; otherwise the distilled TinyML model's judgment and confidence prevail.

#### 5. Station Registry (`receiver/js/station-registry.js`)
- In-memory registry mirrored to `localStorage` (`skyguard_station_registry_v1`) tracking the latest operational health of all weather stations.
- Exports `updateStation(id, judgment)`, `getAllStations()`, and `getStation(id)`.

#### 6. Interactive India Map View (`receiver/map.html`, `receiver/js/map.js`)
- Leaflet.js dashboard plotting registered AWS nodes across geographical coordinates.
- Dynamic color-coded markers based on live edge health:
  - 🟢 **Normal**: Healthy station nominal state
  - 🟡 **Warning**: Parameter divergence or rate-of-change spike
  - 🔴 **Critical**: Severe anomaly confirmed by edge tree
  - ⚪ **Unknown**: Awaiting edge sync
- Interactive tooltips showing station coordinates, edge confidence %, diagnosis, and last update timestamp.
- Real-time marker updating without requiring page reloads.

#### 7. Side Panel Explainability (`receiver/dashboard.html`)
- Added a dedicated **Virtual ESP32 TinyML Decision Path** drawer section rendering step-by-step tree comparisons so reviewers can inspect the exact conditions that triggered each verdict.
