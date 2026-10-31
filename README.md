# FlowCast AI: Smart City Traffic Intelligence Platform
### Delhi Northline Corridor Traffic Intelligence & Multi-Target Predictive Analytics Engine

**FlowCast AI** is an intelligent transportation operations and traffic intelligence platform engineered for municipal traffic authorities, Traffic Operations Centers (TOC), and smart city command systems. The platform monitors the **Delhi Northline Corridor** across 25 arterial road segments and 28 interconnecting highway links, combining high-resolution detector telemetry, atmospheric weather data, and calendar dynamics to provide multi-target predictive forecasting, explainability (XAI), and exploratory risk analytics.

---

## 🌟 Key Highlights & Academic Rigor

1. **Northline Corridor Arterial Network (Delhi, GPS Mapped)**:
   - Accurately maps 25 arterial highway road segments (`NL-001` through `NL-025`) using actual geographic coordinates:
     - Latitude bounds: **28.560°N to 28.685°N**
     - Longitude bounds: **77.100°E to 77.315°E**
   - Renders 28 physical highway links connecting junctions across Northline Ave, Central Flyovers, Harbour Road, Market Street, Airport Feeders, Grand Trunk Road, and Ring Road.
   - Interactive GIS Cartography with high-contrast cartographic rendering, dynamic container mounting, layer toggling (Speed, Volume, Hazard, Congestion), and segment-level telemetry.

2. **Advanced Machine Learning & Rigorous Benchmarking**:
   - **Chronological Data Partitioning**: Strict temporal split (70% Train, 15% Validation, 15% Holdout Test: 9 May – 31 May 2025, 35,336 observations) ensuring **zero lookahead data leakage**.
   - **Candidate Architectures Benchmarked**:
     - Scikit-Learn `HistGradientBoostingRegressor` (Primary volume & travel time predictor)
     - Scikit-Learn `HistGradientBoostingClassifier` (Primary 4-class congestion classifier)
     - `RandomForestRegressor` and `RandomForestClassifier` (High non-linear benchmark & feature importance)
     - Deep Recurrent Sequence Model: `PyTorch TrafficGRU` (2-layer GRU sequence regressor)
     - Baseline Linear Model: NumPy Gradient Descent Regressor (with non-negativity constraints)
     - Naive Temporal Baselines: Persistence ($y_{t+1} = y_t$) and Majority Class
   - **Holdout Test Benchmarks (`reports/evaluation_metrics.json`)**:
     - **Volume Forecasting ($t+30$m)**: HistGB achieves RMSE **58.80 veh**, MAE **40.29 veh**, $R^2$ **0.9584**, MAPE **9.68%**.
     - **Congestion Classification (4 Classes)**: HistGB achieves **87.11% accuracy**, Macro-$F_1$ **0.7574**, Weighted-$F_1$ **0.8717**.
     - **Travel Time Estimation**: HistGB achieves RMSE **1.087 min**, MAE **0.450 min**, $R^2$ **0.8281**.

3. **Surrogate Safety Conflict Measure (Experimental Research Prototype)**:
   - Binary statistical friction probability indicator calibrated using Platt scaling on validation logits (Brier score: **0.00952**).
   - **Important Limitations**: Crash events exhibit extreme rarity (~0.96% base incident prevalence; 106:1 class imbalance). Consequently, Precision is **1.82%** at 1.0% threshold (meaning ~98.2% of flagged intervals are false alarms), Recall is **46.18%**, ROC-AUC is **0.6185**, and PR-AUC is **0.0199**.
   - **Operational Restriction**: Strictly labeled as an experimental research tool; prohibited from automated emergency dispatch or life-safety automation.

4. **Deterministic Inference & Data Provenance**:
   - Ingests verified historical sensor records from `data/processed/northline_traffic_processed.csv` (176,676 records covering 1 Jan – 31 May 2025).
   - Predictions are computed dynamically in real-time via pre-trained model artifacts in `models/`. Zero fabricated or hardcoded metrics.

---

## 🏛️ System Architecture

```
d:/flowcast/
├── data/
│   ├── raw/
│   │   ├── traffic_sensor_log.csv      # Original raw telemetry (178,468 rows, SHA-256 verified)
│   │   ├── weather_observations.csv    # Atmospheric weather observations (10,872 rows)
│   │   └── calendar_events.csv         # Regional holidays and major event schedules
│   ├── processed/
│   │   └── northline_traffic_processed.csv # Integrated feature store (176,676 clean records)
│   └── ingest_raw_data.py              # Ingestion and standardization pipeline
├── src/
│   ├── features.py                     # 33 verified feature definitions, lag calculation, temporal splits
│   ├── models_runner.py                # Model training, PyTorch GRU architecture, evaluation
│   └── inference_service.py            # Singleton inference engine serving all 25 corridor segments
├── models/                             # 16 serialized artifacts (scikit-learn, joblib, PyTorch .pt)
├── backend/
│   └── app.py                          # FastAPI REST server with strict input validation and anti-caching
├── frontend/
│   ├── index.html                      # Single-page TOC interface with 8 dedicated analytics views
│   ├── css/style.css                   # Enterprise design system (Swiss typography, GIS styling)
│   └── js/
│       ├── api.js                      # REST API client
│       ├── map.js                      # High-precision 2D Canvas cartographic engine
│       ├── charts.js                   # Canvas charting (Travel time deltas, confusion matrix, splines)
│       └── app.js                      # Orchestrator, simulation manager, export handler
├── reports/
│   ├── FLOWCAST_FINAL_ENGINEERING_AUDIT.md # Comprehensive engineering & readiness audit
│   ├── FLOWCAST_PRODUCTION_READINESS.md    # End-to-end browser verification report
│   ├── evaluation_metrics.json         # Ground truth evaluation metrics
│   ├── confusion_matrices.json         # Multi-class confusion matrices
│   ├── feature_importance.json         # Feature importance attribution scores
│   ├── screenshots/                    # Real Chrome CDP screenshots
│   └── downloads/                      # Downloaded CSV exports
├── run_server.py                       # High-performance Uvicorn server launcher
└── verify_production_readiness.js       # Automated Chrome DevTools Protocol verification test suite
```

---

## 📡 REST API Reference

All 9 endpoints return standard JSON responses and are tested for status codes, performance, and validation:

| Method | Endpoint | Description | Status Code |
|---|---|---|:---:|
| `GET` | `/api/health` | Service status, active models, dataset coverage, and safety disclaimer | `200 OK` |
| `GET` | `/api/overview` | Corridor volume, mean speed, 4-tier mode, top bottlenecks, past 3-hour spline | `200 OK` |
| `GET` | `/api/traffic/forecast` | Next-interval (+30m) volume predictions with 95% confidence intervals | `200 OK` |
| `GET` | `/api/congestion` | 4-class congestion level distribution and segment breakdown | `200 OK` |
| `GET` | `/api/travel-time` | Current traversal vs predicted duration for all 25 segments | `200 OK` |
| `GET` | `/api/accident-risk` | Calibrated surrogate friction probabilities and threshold tuning | `200 OK` |
| `GET` | `/api/roads` | Registry of all 25 road segments with coordinates, names, and capacity | `200 OK` |
| `GET` | `/api/model-performance` | Empirical benchmarks, confusion matrices, and feature importance rankings | `200 OK` |
| `GET` | `/api/historical` | Query historical sensor logs (supports date, time, and road filters) | `200 / 400` |

---

## 🚀 Installation & Operation

### 1. Prerequisites
- Python 3.10+ (Tested on Python 3.14/3.15)
- Node.js 18+ (For running browser CDP verification suites)

### 2. Install Python Dependencies
```powershell
pip install fastapi uvicorn scikit-learn pandas numpy torch joblib
```

### 3. Launch the Server
```powershell
python run_server.py
```
*The service will start on: **`http://127.0.0.1:8000`***

### 4. Run Automated End-to-End Verification
To execute the automated headless Chrome CDP test suite:
```powershell
node verify_production_readiness.js
```

---

## ⚖️ Technology Readiness Level (TRL) Assessment

FlowCast AI is currently assessed at **TRL-6 (Technology Demonstrated in Relevant Environment)**:
- **Demonstrated Strengths:** High-precision GIS cartography, sub-100ms real-time ML inference across 25 arterial highway corridors, validated 176,676-record feature store, reproducible scikit-learn and PyTorch model architectures, robust error handling, and browser-verified UI workflows.
- **Path to TRL-8 (System Complete and Qualified):** Requires physical municipal integration with real-time SCATS/SCOOT detector feeds, multi-agency field trials, formal transport safety certification, and deployment across distributed redundant server infrastructure behind hardened TLS reverse proxies.
