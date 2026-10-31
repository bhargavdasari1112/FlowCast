# FLOWCAST AI — STAGE 3: PROFESSIONAL DASHBOARD INTEGRATION REPORT

**Project Location:** `D:\flowcast`  
**Dataset Provenance:** Original Northline Corridor, Delhi Sensor & Weather Datasets (`data/raw/`)  
**Temporal Coverage:** January 1, 2025 to May 31, 2025 (151 Days • 7,248 Timestamps • 25 Road Segments)  
**System Version:** FlowCast AI 3.0.0 (Smart City Production Grade)  
**Verification Date:** October 31, 2026  

---

## 1. EXECUTIVE SUMMARY

The Stage 3 integration for **FlowCast AI** successfully connects the validated machine learning pipeline and pre-trained models from Stage 2 into a professional, real-time traffic intelligence and analytics dashboard.

All requirements have been met without compromise:
1. **Strict Data Integrity:** The original Northline Corridor (Delhi) raw sensor logs (`traffic_sensor_log.csv`), weather observations (`weather_observations.csv`), and calendar events (`calendar_events.csv`) remain completely untouched in `data/raw/`. No synthetic datasets were generated.
2. **Real-Time Model Inference:** Predictions are computed directly on demand using the trained models stored in `models/` (HistGradientBoosting, Random Forest, PyTorch GRU, and Platt-calibrated Logistic Regression). No model predictions or evaluation metrics are hardcoded.
3. **No False Real-Time Traffic:** Telemetry is accurately labeled as historical operational replays paired with forward-looking $+30$-minute model forecasts, respecting the genuine dataset boundaries (January 1 to May 31, 2025).
4. **Calibrated Accident Indicator:** The accident risk analytics view uses the Platt-calibrated logistic regression model with an interactive operational threshold slider (0.5% – 3.0%), prominently displaying the required experimental disclaimer.

---

## 2. BACKEND ARCHITECTURE & ENDPOINTS

The FastAPI backend (`backend/app.py`) interfaces with `src/inference_service.py` to provide 8 robust, JSON-compliant REST endpoints:

| Endpoint | Method | Parameters | Key Responsibilities |
| :--- | :---: | :--- | :--- |
| `/api/overview` | `GET` | `timestamp`, `date`, `time` | Total segments (25), current timestamp, mean volume, speed, dominant congestion, recent 3h volume trend. |
| `/api/traffic/forecast` | `GET` | `timestamp`, `road_id` | Next 30m volume prediction via HistGB, actual current volume, expected delta, V/C capacity saturation. |
| `/api/congestion` | `GET` | `timestamp`, `road_id` | 4-class congestion classification (`Free-flow`, `Moderate`, `Heavy`, `Severe`), distribution breakdown, road status. |
| `/api/travel-time` | `GET` | `timestamp`, `road_id` | Current vs predicted next 30m travel time, delay delta, corridor average speed. |
| `/api/accident-risk` | `GET` | `timestamp`, `threshold`, `road_id` | Platt-calibrated statistical accident probability, patrol pre-positioning alerts, experimental safety disclaimer. |
| `/api/roads` | `GET` | `timestamp` | All 25 Northline segments with genuine GPS coordinates (Lat 28.56–28.69, Lon 77.10–77.31), capacity, and telemetry. |
| `/api/model-performance` | `GET` | *None* | Test set evaluation metrics ($R^2$, MAE, RMSE, MAPE, Accuracy, Macro-$F_1$, ROC-AUC, Brier score, confusion matrix). |
| `/api/historical` | `GET` | `date`, `time`, `road_id`, `limit` | Historical traffic records query with strict date bounds enforcement (`2025-01-01` to `2025-05-31`). |
| `/api/health` | `GET` | *None* | System health, model registry, dataset provenance, and operational status. |

---

## 3. DASHBOARD DESIGN & IMPLEMENTATION

The frontend is constructed using pure vanilla HTML5, CSS3, and JavaScript (ES6+), adopting a dark navy command center theme (`#070B13` background, `#0F172A` glassmorphic cards, `#06B6D4` cyan and `#6366F1` indigo accents, with Outfit and Inter typography).

### View A: Overview
- **Header & Timeline Controls:** Live date picker (`2025-01-01` to `2025-05-31`), time dropdown, peak presets (`Morning Peak 08:30`, `Evening Rush 18:30`, `Weekend Flow 14:00`), refresh trigger.
- **KPI Grid:** 6 high-contrast telemetry cards displaying Total Segments (25), Actual Mean Volume, Forecast Next Volume, Mean Speed, Dominant Congestion Class, and Mean Predicted Travel Time.
- **Volume Trend Curve:** High-DPI Canvas chart plotting historical corridor flow over past 3 hours transitioning into the model's forward $+30$-minute prediction.
- **Congestion Donut:** Segment proportion across Free-flow, Moderate, Heavy, and Severe conditions.

### View B: Interactive Traffic Map
- **Delhi Geographical Projection:** Projects all 25 Northline road segments using real latitude and longitude coordinates onto an SVG vector radar canvas.
- **Arterial Topology:** Visualizes arterial connections between key corridors (e.g. Northline Ave, Harbour Rd, Central Flyover, Kingsway, Riverside Dr, Grand Trunk, Lakeview, Ring Road Terminus).
- **Segment Inspector Panel:** Clicking any road marker (or selecting segment from dropdown) displays a real-time inspector card containing GPS coordinates, actual volume, $+30$m forecast volume, speed, travel time, V/C saturation progress bar, and calibrated accident probability.
- **Filters & Zoom:** Filter markers by congestion class (`Free-flow`, `Moderate`, `Heavy`, `Severe`), search by road name/ID, and dynamic zoom controls ($0.75\times$ to $2.5\times$).

### View C: Traffic Forecasting
- **Primary Engine:** Gradient Boosting Regressor (`models/vol_gradient_boosting.joblib`) with 150 boosting stages.
- **Road Comparison Bar Chart:** Canvas bar chart rendering side-by-side actual current volume vs predicted $+30$-minute volume.
- **Forecast Telemetry Table:** Complete listing of all 25 segments showing current volume, forecast volume, ground truth target (where available), volume delta, and volume-to-capacity saturation ratio.

### View D: Congestion Analytics
- **Primary Engine:** Gradient Boosting Classifier (`models/cong_gradient_boosting.joblib`) predicting 4 distinct operational states.
- **Operational Threshold Reference:** Card detailing standard V/C ratio definitions:
  - *Free-flow (Level 0):* $V/C < 0.50$
  - *Moderate (Level 1):* $0.50 \le V/C < 0.80$
  - *Heavy (Level 2):* $0.80 \le V/C < 1.00$
  - *Severe (Level 3):* $V/C \ge 1.00$
- **Road Congestion Status Table:** Displays current level, model predicted next level, occupancy %, and speed.

### View E: Travel-Time Prediction
- **Primary Engine:** Gradient Boosting Regressor (`models/tt_gradient_boosting.joblib`).
- **Delay Analysis:** Visualizes predicted trip durations and expected delay deltas ($+$ or $-$ minutes) across segments compared against free-flow baselines.

### View F: Accident-Risk Analytics
- **Primary Engine:** Logistic Regression with Validation Platt Scaling (`models/acc_logistic_platt_calibrated.joblib`).
- **Prominent Safety Disclaimer:**
  > *EXPERIMENTAL STATISTICAL RISK INDICATOR: Pre-positioning decision support only. Not an autonomous collision warning system or real-time accident detection mechanism. Probability values are statistically calibrated via validation Platt scaling.*
- **Interactive Threshold Slider:** Operational decision slider ranging from $0.5\%$ to $3.0\%$ (default $1.0\%$ recommended) dynamically recalculating flagged segments for traffic patrol pre-positioning.
- **False-Positive Mitigation:** Clearly displays Platt calibration metrics explaining why uncalibrated balanced models yield excessive false alarms and how Platt scaling grounds probabilities to true empirical event frequency ($\sim 1\%$).

### View G: Model Performance Studio
- **Verified Metrics Tables:** Pulls directly from `reports/evaluation_metrics.json` to present holdout test set performance (9 May – 31 May 2025):
  - *Volume Forecasting:* HistGB ($RMSE = 58.80$ veh, $R^2 = 0.9584$) vs Random Forest ($RMSE = 62.31$, $R^2 = 0.9533$) vs PyTorch GRU ($RMSE = 64.19$, $R^2 = 0.9504$) vs NumPy GD Linear ($RMSE = 108.34$, $R^2 = 0.8588$).
  - *Congestion Classification:* HistGB ($Accuracy = 87.11\%$, Macro-$F_1 = 0.7574$) vs Random Forest ($Accuracy = 85.04\%$, Macro-$F_1 = 0.7229$) vs Persistence Baseline ($Accuracy = 77.61\%$).
  - *Accident Calibration:* Brier score of $0.00952$ (beating prevalence baseline $0.00971$).
- **Confusion Matrix:** 4x4 matrix visualizer color-coded by prediction density.

### View H: Historical Data Explorer
- **Date Range Enforcer:** Validates user queries strictly between `2025-01-01` and `2025-05-31`. Any out-of-range selection triggers a clear error alert.
- **Interactive Filter Bar:** Allows filtering by specific Date, Time (HH:MM), Road ID, and Record Limit (25, 50, 100).
- **Comparison Table:** Shows historical observations side-by-side with $+30$-minute forward ground truth values and recorded weather conditions.

---

## 4. VERIFICATION & TEST RESULTS

Automated end-to-end integration tests were executed via `test_stage3_integration.py`. All 11 tests passed with zero failures:

```
======================================================================
  FLOWCAST AI: STAGE 3 INTEGRATION TEST SUITE
  Corridor: Delhi Northline Arterials (25 Monitored Segments)
======================================================================
  [PASS] Static Frontend Dashboard (HTML, 8 standard views)
  [PASS] /api/health (25 segments, HistGB model, experimental disclaimer)
  [PASS] /api/overview (Mean volume, speed, congestion distribution)
  [PASS] /api/traffic/forecast (HistGB 150 iterations, 25 road forecasts)
  [PASS] /api/congestion (4-class predicted distribution)
  [PASS] /api/travel-time (Current vs predicted travel times, non-negativity)
  [PASS] /api/accident-risk (Platt-calibrated probability, safety disclaimer)
  [PASS] /api/roads (All 25 segments mapped to Lat 28.56-28.69, Lon 77.10-77.31)
  [PASS] /api/model-performance (Verified holdout metrics, confusion matrix)
  [PASS] /api/historical (Date range enforcement: Jan 1 - May 31 2025)
  [PASS] Raw Data Integrity Audit (data/raw/ files untouched and intact)
======================================================================
  TEST SUMMARY: ALL TESTS PASSED SUCCESSFULLY (11/11)
======================================================================
```

---

## 5. WINDOWS EXECUTION INSTRUCTIONS

To launch the complete FlowCast AI platform on Windows:

```powershell
# Step 1: Navigate to project root
cd D:\flowcast

# Step 2: Start the FastAPI Server & Frontend Dashboard
python run_server.py
```

The application will be accessible at:
- **Web Dashboard:** `http://127.0.0.1:8000`
- **Interactive API Documentation:** `http://127.0.0.1:8000/docs`
- **Alternative Redoc:** `http://127.0.0.1:8000/redoc`
