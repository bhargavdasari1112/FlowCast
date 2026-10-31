# FLOWCAST AI — REST API SPECIFICATION & DOCUMENTATION

**Service:** FlowCast AI Intelligent Traffic Analytics Engine  
**Version:** 3.0.0  
**Base URL:** `http://127.0.0.1:8000`  
**Network Monitored:** Delhi Northline Corridor (25 Monitored Road Segments, `NL-001` to `NL-025`)  
**Data Provenance:** Original Northline Sensor Logs & Weather Data (January 1, 2025 to May 31, 2025)  

---

## 1. GLOBAL CONVENTIONS & INTEGRITY RULES

- **Format:** All endpoints accept and return UTF-8 encoded `application/json`.
- **Temporal Bounds:** Real-world dataset records cover `2025-01-01` to `2025-05-31`. Any date query outside this range will return a structured `400` or `ERROR` payload.
- **Model Inference:** Prediction endpoints execute real-time model inference using trained pipeline artifacts in `models/`.
- **Accident Risk Disclaimer:** Accident probabilities are calibrated statistical indicators for patrol pre-positioning and carry an explicit advisory disclaimer.

---

## 2. API ENDPOINTS

### 1. Overview (`GET /api/overview`)
Retrieves corridor-wide aggregated telemetry and high-level KPIs for a specified timestamp.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
| :--- | :---: | :---: | :---: | :--- |
| `timestamp` | `string` | No | `2025-05-20T08:30:00` | ISO-8601 formatted timestamp string. |
| `date` | `string` | No | `null` | Filter by date (`YYYY-MM-DD`). |
| `time` | `string` | No | `null` | Filter by time (`HH:MM`). |

**Example Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "data_provenance": "HISTORICAL_NORTHLINE_TELEMETRY (Actual) + REALTIME_MODEL_INFERENCE (Predicted)",
  "corridor_name": "Northline Corridor, Delhi",
  "total_road_segments": 25,
  "selected_timestamp": "2025-05-20T08:30:00",
  "selected_date": "2025-05-20",
  "selected_time": "08:30",
  "weather": {
    "condition": "Clear",
    "temperature_c": 28.5,
    "rainfall_mm": 0.0,
    "visibility_m": 5000.0
  },
  "kpis": {
    "total_corridor_volume_veh_30m": 25162,
    "avg_traffic_volume_veh": 1006.5,
    "predicted_next_volume_veh": 990.2,
    "volume_change_pct": -1.62,
    "avg_speed_kmh": 15.7,
    "avg_travel_time_min": 9.66,
    "predicted_next_travel_time_min": 8.8,
    "dominant_congestion_level": "Severe"
  },
  "congestion_distribution": {
    "actual": { "Severe": 25, "Free-flow": 0, "Moderate": 0, "Heavy": 0 },
    "predicted": { "Severe": 25, "Free-flow": 0, "Moderate": 0, "Heavy": 0 }
  },
  "volume_trend_past_3h": {
    "05:30": 342.0,
    "06:00": 485.0,
    "06:30": 680.0,
    "07:00": 850.0,
    "07:30": 980.0,
    "08:00": 1040.0,
    "08:30": 1006.5
  },
  "condition_summary": "Network operating under Severe status. Corridor vehicle flow is 25,162 veh/30m with mean speed 15.7 km/h."
}
```

---

### 2. Traffic Forecasting (`GET /api/traffic/forecast`)
Returns the next 30-minute volume prediction for each monitored corridor segment alongside actual current flow and capacity saturation.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
| :--- | :---: | :---: | :---: | :--- |
| `timestamp` | `string` | No | `2025-05-20T08:30:00` | Target time horizon. |
| `road_id` | `string` | No | `null` | Optional segment filter (e.g. `NL-001`). |

**Example Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "model_name": "Gradient Boosting Regressor (HistGB - 150 Iterations)",
  "selected_timestamp": "2025-05-20T08:30:00",
  "forecast_horizon": "+30 Minutes",
  "corridor_avg_current_volume": 1006.5,
  "corridor_avg_predicted_volume": 990.2,
  "expected_growth_pct": -1.62,
  "road_forecasts": [
    {
      "road_id": "NL-001",
      "road_name": "Northline Ave @ 5th",
      "latitude": 28.643422,
      "longitude": 77.190411,
      "current_volume": 1085,
      "predicted_next_30m_volume": 1052,
      "actual_next_30m_volume": 1040,
      "forecast_delta_veh": -33,
      "forecast_growth_pct": -3.04,
      "road_capacity": 2400,
      "volume_to_capacity_ratio": 0.877
    }
  ],
  "model_alternatives": {
    "HistGB (Primary)": { "rmse": 58.80, "r2": 0.9584 },
    "Random Forest": { "rmse": 62.31, "r2": 0.9533 },
    "PyTorch GRU": { "rmse": 64.19, "r2": 0.9504 },
    "Linear Regression (NumPy GD)": { "rmse": 108.34, "r2": 0.8588 }
  }
}
```

---

### 3. Congestion Analytics (`GET /api/congestion`)
Computes 4-class congestion classification (`Free-flow`, `Moderate`, `Heavy`, `Severe`) using the Gradient Boosting classifier.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
| :--- | :---: | :---: | :---: | :--- |
| `timestamp` | `string` | No | `2025-05-20T08:30:00` | Target time horizon. |
| `road_id` | `string` | No | `null` | Optional segment filter. |

**Example Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "model_name": "Gradient Boosting Classifier (HistGB - 4 Classes)",
  "selected_timestamp": "2025-05-20T08:30:00",
  "forecast_horizon": "+30 Minutes",
  "distribution_summary": {
    "predicted_distribution": { "Free-flow": 0, "Moderate": 0, "Heavy": 0, "Severe": 25 },
    "current_distribution": { "Free-flow": 0, "Moderate": 0, "Heavy": 0, "Severe": 25 }
  },
  "road_congestion_status": [
    {
      "road_id": "NL-001",
      "road_name": "Northline Ave @ 5th",
      "current_congestion": "Severe",
      "predicted_next_congestion": "Severe",
      "actual_next_congestion": "Severe",
      "vc_ratio": 0.904,
      "avg_speed_kmh": 14.2,
      "occupancy_pct": 74.5
    }
  ],
  "congestion_thresholds": {
    "Free-flow": "V/C < 0.50 (Unimpeded traffic speed)",
    "Moderate": "0.50 <= V/C < 0.80 (Stable flow, light friction)",
    "Heavy": "0.80 <= V/C < 1.00 (Unstable flow, significant queuing)",
    "Severe": "V/C >= 1.00 (Breakdown, gridlock conditions)"
  }
}
```

---

### 4. Travel-Time Prediction (`GET /api/travel-time`)
Forecasts traversal duration in minutes across road segments using HistGB regressor.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
| :--- | :---: | :---: | :---: | :--- |
| `timestamp` | `string` | No | `2025-05-20T08:30:00` | Target time horizon. |
| `road_id` | `string` | No | `null` | Optional segment filter. |

**Example Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "model_name": "Gradient Boosting Regressor (HistGB - Travel Time)",
  "selected_timestamp": "2025-05-20T08:30:00",
  "forecast_horizon": "+30 Minutes",
  "corridor_avg_current_travel_time": 9.66,
  "corridor_avg_predicted_travel_time": 8.8,
  "road_travel_times": [
    {
      "road_id": "NL-001",
      "road_name": "Northline Ave @ 5th",
      "current_travel_time_min": 10.2,
      "predicted_next_travel_time_min": 9.5,
      "actual_next_travel_time_min": 9.4,
      "travel_time_delay_min": -0.7,
      "avg_speed_kmh": 14.2
    }
  ]
}
```

---

### 5. Accident Risk Analytics (`GET /api/accident-risk`)
Computes calibrated incident probabilities using Platt-calibrated logistic regression for patrol pre-positioning.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
| :--- | :---: | :---: | :---: | :--- |
| `timestamp` | `string` | No | `2025-05-20T08:30:00` | Target time horizon. |
| `threshold` | `float` | No | `0.010` | Decision threshold ($0.001 \le threshold \le 0.100$). Default $1.0\%$. |
| `road_id` | `string` | No | `null` | Optional segment filter. |

**Example Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "model_name": "Logistic Regression with Validation Platt Scaling",
  "selected_timestamp": "2025-05-20T08:30:00",
  "forecast_horizon": "+30 Minutes",
  "experimental_disclaimer": "EXPERIMENTAL STATISTICAL RISK INDICATOR: Pre-positioning decision support only. Not a deterministic collision warning system or real-time accident detection mechanism. Probability values are statistically calibrated via validation Platt scaling.",
  "operational_threshold_active": 0.01,
  "corridor_mean_calibrated_probability_pct": 1.62,
  "roads_exceeding_threshold_count": 21,
  "threshold_performance_guide": {
    "0.005 (0.5%)": { "catch_rate_recall": "100.0%", "specificity": "0.13%", "precision": "0.97%" },
    "0.010 (1.0% RECOMMENDED)": { "catch_rate_recall": "46.18%", "specificity": "75.68%", "precision": "1.82%" },
    "0.015 (1.5%)": { "catch_rate_recall": "24.10%", "specificity": "90.75%", "precision": "2.47%" },
    "0.020 (2.0%)": { "catch_rate_recall": "11.24%", "specificity": "96.55%", "precision": "3.08%" }
  },
  "road_risk_evaluations": [
    {
      "road_id": "NL-001",
      "road_name": "Northline Ave @ 5th",
      "calibrated_accident_probability": 0.0165,
      "calibrated_probability_pct": 1.65,
      "risk_classification": "Elevated",
      "exceeds_operational_threshold": true,
      "actual_next_incident_count": 0,
      "contributing_factors": {
        "occupancy_pct": 74.5,
        "speed_kmh": 14.2,
        "speed_change": -3.8,
        "rainfall_mm": 0.0
      }
    }
  ]
}
```

---

### 6. Roads Registry (`GET /api/roads`)
Returns all 25 Northline Corridor road segments with their exact GPS coordinates, capacity, and current conditions.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
| :--- | :---: | :---: | :---: | :--- |
| `timestamp` | `string` | No | `2025-05-20T08:30:00` | Target time horizon. |

**Example Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "corridor": "Northline Corridor, Delhi",
  "total_roads": 25,
  "timestamp": "2025-05-20T08:30:00",
  "center_coords": [28.635, 77.205],
  "roads": [
    {
      "road_id": "NL-001",
      "road_name": "Northline Ave @ 5th",
      "latitude": 28.643422,
      "longitude": 77.190411,
      "weather_station_id": "WS-01",
      "road_capacity": 2400,
      "signal_timing": 90,
      "current_volume": 1085,
      "current_speed": 14.2,
      "current_occupancy": 74.5,
      "current_congestion": "Severe",
      "predicted_next_volume": 1052,
      "predicted_next_congestion": "Severe",
      "predicted_next_travel_time": 9.5,
      "calibrated_accident_probability": 0.0165
    }
  ]
}
```

---

### 7. Model Performance Studio (`GET /api/model-performance`)
Returns verified model evaluation reports on holdout test set data.

**Example Response (200 OK):**
```json
{
  "status": "SUCCESS",
  "corridor": "Northline Corridor, Delhi",
  "evaluation_split": "70% Train, 15% Validation, 15% Test (Holdout Test Window: 9 May – 31 May 2025)",
  "metrics": {
    "traffic_volume": {
      "Gradient Boosting (HistGB)": { "mae": 40.291, "rmse": 58.799, "mape_pct": 9.68, "r2": 0.9584 },
      "Random Forest": { "mae": 42.385, "rmse": 62.310, "mape_pct": 10.23, "r2": 0.9533 },
      "PyTorch GRU Sequence Model": { "mae": 43.382, "rmse": 64.191, "mape_pct": 10.34, "r2": 0.9504 },
      "Linear Regression (NumPy GD)": { "mae": 80.380, "rmse": 108.340, "mape_pct": 23.53, "r2": 0.8588 }
    },
    "congestion": {
      "Gradient Boosting (HistGB)": { "accuracy": 0.8711, "f1_macro": 0.7574, "f1_weighted": 0.8717 },
      "Random Forest": { "accuracy": 0.8504, "f1_macro": 0.7229, "f1_weighted": 0.8510 },
      "Persistence Baseline": { "accuracy": 0.7761, "f1_macro": 0.6117, "f1_weighted": 0.7763 }
    },
    "accident_risk": {
      "calibrated_logistic_platt": { "brier_score": 0.00952, "roc_auc": 0.6185, "pr_auc": 0.0199 }
    }
  }
}
```

---

### 8. Historical Data Explorer (`GET /api/historical`)
Queries historical sensor readings and verifies against forward $+30$-minute targets.

**Query Parameters:**
| Parameter | Type | Required | Default | Bounds |
| :--- | :---: | :---: | :---: | :--- |
| `date` | `string` | No | `null` | Strictly enforced: `2025-01-01` to `2025-05-31` |
| `time` | `string` | No | `null` | `HH:MM` |
| `road_id` | `string` | No | `null` | Segment filter (e.g. `NL-005`) |
| `limit` | `int` | No | `50` | $1 \le limit \le 500$ |

**Error Response for Out-of-Range Date (Status 200 or 400):**
```json
{
  "status": "ERROR",
  "message": "Invalid date. The Northline Corridor dataset covers January 1, 2025 to May 31, 2025."
}
```

---

### 9. System Health (`GET /api/health`)
Provides infrastructure liveness, loaded model registry, and dataset provenance.
