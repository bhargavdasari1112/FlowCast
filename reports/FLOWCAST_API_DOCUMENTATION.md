# FlowCast AI — REST API Documentation

**Service:** FlowCast AI Intelligent Traffic Analytics Engine  
**Version:** 3.0.0  
**Base URL:** `http://127.0.0.1:8000`  
**Network Monitored:** Delhi Northline Corridor (25 Monitored Road Segments, `NL-001` to `NL-025`)  
**Data Provenance:** Historical Northline Sensor Logs & Weather Data (January 1, 2025 to May 31, 2025)  

---

## 1. Global Conventions & Protocol Standards

- **Encoding & Media Type:** All requests and responses use UTF-8 encoded `application/json`.
- **Temporal Validity Window:** Temporal parameter queries must fall within the verified historical range: `2025-01-01` to `2025-05-31`. Requests outside this window return `HTTP 400 Bad Request`.
- **Road Identifiers:** Road segment filters strictly validate against valid corridor IDs: `NL-001` through `NL-025`. Unknown IDs return `HTTP 404 Not Found`.
- **Model Inference:** Prediction endpoints execute deterministic inference via trained artifacts in `models/` on CPU with sub-100ms response latencies.
- **Experimental Notice:** Accident risk probability outputs are explicitly labeled as experimental research prototypes and must not be used for operational safety dispatch.

---

## 2. API Endpoints Catalog

### Endpoint 1: Health & System Diagnostics (`GET /api/health`)
Returns operational service status, loaded model versions, dataset coverage, and legal/experimental disclaimers.

- **Query Parameters:** None
- **Latency:** ~4.9 ms
- **Response Code:** `200 OK`
- **Example Response:**
```json
{
  "status": "healthy",
  "service": "FlowCast AI - Northline Corridor Traffic Intelligence Engine",
  "version": "3.0.0",
  "environment": "Delhi Northline Corridor (25 Monitored Segments)",
  "dataset": {
    "name": "Northline Corridor Sensor & Weather Dataset",
    "coverage": "2025-01-01 to 2025-05-31",
    "total_segments": 25,
    "prediction_interval": "t+30 minutes"
  },
  "loaded_models": {
    "volume_primary": "HistGradientBoostingRegressor (models/vol_gradient_boosting.joblib)",
    "congestion_primary": "HistGradientBoostingClassifier (models/cong_gradient_boosting.joblib)",
    "travel_time_primary": "HistGradientBoostingRegressor (models/tt_gradient_boosting.joblib)",
    "accident_risk_primary": "LogisticRegression + Platt Calibrator (models/acc_logistic_platt_calibrated.joblib)"
  },
  "experimental_disclaimer": "STRICTLY EXPERIMENTAL RESEARCH PROTOTYPE: Severe class skew (106:1) limits precision to 1.82% at a 1.0% threshold..."
}
```

---

### Endpoint 2: Command Center Overview (`GET /api/overview`)
Aggregates network-wide KPIs, active bottlenecks, 3-hour volume trends, and weather observations for a target timestamp.

- **Query Parameters:**
  - `timestamp` (optional, string): ISO-8601 timestamp (e.g. `2025-05-20T08:30:00`)
  - `date` (optional, string): Target date `YYYY-MM-DD`
  - `time` (optional, string): Target time `HH:MM`
- **Latency:** ~98.2 ms
- **Response Code:** `200 OK`
- **Example Response:**
```json
{
  "status": "SUCCESS",
  "total_road_segments": 25,
  "selected_timestamp": "2025-05-20T08:30:00",
  "kpis": {
    "total_corridor_volume_veh_30m": 25162,
    "avg_traffic_volume_veh": 1006.5,
    "predicted_next_volume_veh": 990.2,
    "avg_speed_kmh": 15.7,
    "avg_travel_time_min": 9.66,
    "dominant_congestion_level": "Severe"
  },
  "top_bottlenecks": [
    { "road_id": "NL-014", "road_name": "Industrial Link B", "vc_ratio": 1.02, "current_volume": 1529, "avg_speed": 8.7 }
  ]
}
```

---

### Endpoint 3: Traffic Volume Forecast (`GET /api/traffic/forecast`)
Provides next-interval ($t+30$m) volume predictions, baseline capacities, expected percentage growth, and 95% confidence intervals for all 25 segments.

- **Query Parameters:**
  - `timestamp` (optional, string): Target timestamp
  - `road_id` (optional, string): Filter for a single segment (e.g. `NL-001`)
- **Latency:** ~83.3 ms
- **Response Code:** `200 OK`
- **Example Response:**
```json
{
  "status": "SUCCESS",
  "model_name": "Gradient Boosting Regressor (HistGB)",
  "forecast_horizon": "+30 Minutes",
  "corridor_avg_predicted_volume": 990.2,
  "road_forecasts": [
    {
      "road_id": "NL-001",
      "road_name": "Northline Ave @ 5th",
      "current_volume": 944,
      "predicted_volume": 1111,
      "capacity": 1800,
      "lower_ci_95": 995,
      "upper_ci_95": 1227
    }
  ]
}
```

---

### Endpoint 4: Congestion Distribution Analysis (`GET /api/congestion`)
Computes the 4-tier congestion mode distribution (`Free-flow`, `Moderate`, `Heavy`, `Severe`) and segment-level classifications.

- **Query Parameters:**
  - `timestamp` (optional, string): Target timestamp
  - `road_id` (optional, string): Specific segment filter
- **Latency:** ~81.9 ms
- **Response Code:** `200 OK`
- **Example Response:**
```json
{
  "status": "SUCCESS",
  "model_name": "Gradient Boosting Classifier (HistGB)",
  "dominant_congestion_tier": "Severe",
  "distribution_summary": {
    "predicted_distribution": { "Free-flow": 0, "Moderate": 0, "Heavy": 2, "Severe": 23 }
  },
  "road_congestion": [
    { "road_id": "NL-001", "predicted_congestion_level": "Severe", "confidence_score": 0.94 }
  ]
}
```

---

### Endpoint 5: Travel Time Intelligence (`GET /api/travel-time`)
Returns current vs. predicted traversal durations (in minutes), traversal velocity, and delay penalties for each segment.

- **Query Parameters:**
  - `timestamp` (optional, string): Target timestamp
  - `road_id` (optional, string): Specific segment filter
- **Latency:** ~80.5 ms
- **Response Code:** `200 OK`
- **Example Response:**
```json
{
  "status": "SUCCESS",
  "corridor_avg_current_travel_time": 9.66,
  "corridor_avg_predicted_travel_time": 8.8,
  "road_travel_times": [
    {
      "road_id": "NL-001",
      "current_travel_time_min": 6.32,
      "predicted_travel_time_min": 6.05,
      "delta_min": -0.27,
      "velocity_kmh": 18.9
    }
  ]
}
```

---

### Endpoint 6: Calibrated Accident Friction Risk (`GET /api/accident-risk`)
Calculates post-hoc Platt-calibrated collision risk probabilities, sensitivity levels, and friction factors.

- **Query Parameters:**
  - `timestamp` (optional, string): Target timestamp
  - `threshold` (optional, float): Operational threshold (`ge=0.001`, `le=0.100`, default `0.010`)
  - `road_id` (optional, string): Specific segment filter
- **Latency:** ~80.1 ms
- **Response Code:** `200 OK` (or `422 Unprocessable Entity` if threshold is out of range)
- **Example Response:**
```json
{
  "status": "SUCCESS",
  "model_name": "Logistic Regression with Validation Platt Scaling",
  "experimental_disclaimer": "STRICTLY EXPERIMENTAL RESEARCH PROTOTYPE...",
  "operational_threshold_active": 0.01,
  "corridor_mean_calibrated_probability_pct": 1.15,
  "roads_exceeding_threshold_count": 8,
  "road_risk_evaluations": [
    {
      "road_id": "NL-001",
      "calibrated_probability_pct": 1.42,
      "risk_classification": "Elevated",
      "exceeds_operational_threshold": true,
      "contributing_factors": { "occupancy_pct": 68.4, "speed_kmh": 18.9, "rainfall_mm": 0.0 }
    }
  ]
}
```

---

### Endpoint 7: Road Registry & GIS Network (`GET /api/roads`)
Returns the complete Delhi Northline road registry with GPS coordinates, capacities, signal timings, and live status.

- **Query Parameters:**
  - `timestamp` (optional, string): Target timestamp
- **Latency:** ~78.9 ms
- **Response Code:** `200 OK`
- **Example Response:**
```json
{
  "status": "SUCCESS",
  "total_roads": 25,
  "corridor": "Northline Corridor, Delhi",
  "roads": [
    {
      "road_id": "NL-001",
      "road_name": "Northline Ave @ 5th",
      "latitude": 28.643422,
      "longitude": 77.190412,
      "road_capacity": 1800,
      "current_volume": 944,
      "current_speed": 18.9,
      "congestion_level": "Severe"
    }
  ]
}
```

---

### Endpoint 8: Model Performance & Empirical Studio (`GET /api/model-performance`)
Delivers holdout test scorecard benchmarks, multi-class confusion matrices, and Random Forest Gini feature importances.

- **Query Parameters:** None
- **Latency:** ~2.75 ms
- **Response Code:** `200 OK`
- **Example Response:**
```json
{
  "status": "SUCCESS",
  "corridor": "Northline Corridor, Delhi",
  "evaluation_split": "70% Train, 15% Validation, 15% Test (Holdout Test Window: 9 May – 31 May 2025)",
  "metrics": {
    "traffic_volume": {
      "Gradient Boosting (HistGB)": { "mae": 40.291, "rmse": 58.799, "mape_pct": 9.68, "r2": 0.9584 },
      "Random Forest": { "mae": 42.385, "rmse": 62.31, "r2": 0.9533 }
    },
    "congestion": {
      "Gradient Boosting (HistGB)": { "accuracy": 0.8711, "f1_macro": 0.7574, "f1_weighted": 0.8717 }
    },
    "travel_time": {
      "Gradient Boosting (HistGB)": { "mae": 0.45, "rmse": 1.087, "r2": 0.8281 }
    },
    "accident_risk": {
      "Platt Calibrated Logistic (Val)": { "roc_auc": 0.6185, "pr_auc": 0.0199, "brier_score": 0.00952 }
    }
  }
}
```

---

### Endpoint 9: Historical Sensor Log Archive (`GET /api/historical`)
Allows temporal queries across the 176,701 historical feature store records with date, time, and road filters.

- **Query Parameters:**
  - `date` (optional, string): Date string `YYYY-MM-DD` between `2025-01-01` and `2025-05-31`
  - `time` (optional, string): Time string `HH:MM`
  - `road_id` (optional, string): Specific road ID (`NL-001` to `NL-025`)
  - `limit` (optional, integer): Maximum records to return (`ge=1`, `le=500`, default `50`)
- **Latency:** ~140.6 ms
- **Response Codes:**
  - `200 OK`: Successful query returning matching records.
  - `400 Bad Request`: Date outside bounds (`2025-01-01` to `2025-05-31`).
  - `404 Not Found`: Unknown road ID.
  - `422 Unprocessable Entity`: Limit out of bounds (<1 or >500).

---

## 3. Error Response Contract

All errors return structured JSON conforming to RFC 7807 problem details:

```json
{
  "status": "ERROR",
  "error_type": "BAD_REQUEST",
  "message": "Invalid date '2024-12-31'. The Northline Corridor dataset covers January 1, 2025 to May 31, 2025."
}
```
