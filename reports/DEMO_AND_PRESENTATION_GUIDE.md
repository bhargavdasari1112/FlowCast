# FLOWCAST AI — DEMONSTRATION & PRESENTATION GUIDE

**Platform:** FlowCast AI Intelligent Traffic Operations & Machine Learning Analytics  
**Corridor:** Northline Corridor, Delhi (25 Monitored Arterial Segments)  
**Dataset Provenance:** Original Northline Sensor Logs & Weather Data (January 1 – May 31, 2025)  
**System URL:** `http://127.0.0.1:8000`  
**API Documentation:** `http://127.0.0.1:8000/docs`  

---

## 1. PRESENTATION OVERVIEW & KEY THEMES

When presenting FlowCast AI to technical evaluators and smart-city stakeholders, emphasize these four foundational strengths:

1. **Rigorous Data & Engineering Integrity:**
   - Powered exclusively by the genuine Delhi Northline Corridor sensor dataset (178,468 observations across 25 arterial links).
   - Zero synthetic datasets were generated or substituted.
   - Strict chronological 70/15/15 temporal partitioning with **zero lookahead feature leakage** (all features use $\le t-1$ data).
2. **State-of-the-Art Predictive Accuracy:**
   - Gradient Boosting Regressor (HistGB) delivers $RMSE = 58.80$ veh/30m ($R^2 = 0.9584$) on untouched holdout test data, outperforming Random Forest, deep learning GRU, and persistence baselines.
   - Congestion classification achieves $87.11\%$ 4-class accuracy ($Macro-F_1 = 0.7574$).
3. **Statistically Calibrated Decision Support:**
   - Rather than relying on uncalibrated classifiers that trigger endless false alarms, the accident-risk engine uses validation **Platt scaling** ($Brier = 0.00952$) to output grounded, realistic event probabilities.
   - Prominently presented as an **experimental patrol pre-positioning tool**, not an autonomous collision warning system.
4. **Command-Center User Experience:**
   - Real-time responsive dashboard built with pure HTML5/CSS/JavaScript (dark navy `#070B13` command-center theme, glassmorphic cards, Outfit & Inter fonts, high-DPI Canvas charts, and vector SVG mapping).

---

## 2. STEP-BY-STEP LIVE DEMONSTRATION FLOW

### Step 1: Launch & System Overview
- **Action:** Open `http://127.0.0.1:8000` in the browser.
- **Talking Points:**
  - *"Welcome to FlowCast AI. This platform is configured for the 25 arterial segments of the Northline Corridor in Delhi."*
  - Point to the **Notice Banner**: *"Notice the explicit data provenance banner indicating that all telemetry represents verified historical replays from January 1 to May 31, 2025, paired with real-time machine learning inference for future $+30$-minute intervals. We never misrepresent historical data as live feeds."*
  - Review the **KPI Grid**: 25 road segments, corridor-wide vehicle volume, forecast $+30$-minute volume, mean speed ($15.7$ km/h), dominant congestion level, and predicted travel time.
  - Review the **Volume Trend Chart**: Canvas chart showing historical flow leading directly into the $+30$-minute forward projection.

---

### Step 2: Interactive Traffic Map
- **Action:** Click the **"🗺️ Corridor Map"** tab in the navigation bar.
- **Talking Points:**
  - *"Here we see all 25 Northline segments plotted using their actual geographical coordinates in Delhi (Latitude 28.56°N to 28.68°N, Longitude 77.10°E to 77.31°E)."*
  - *"Arterial links reflect physical connectivity between corridors such as Northline Ave, Harbour Rd, Central Flyover, Kingsway, Riverside Dr, and Grand Trunk."*
  - **Interaction 1 (Marker Click):** Click marker **`NL-005` (Central Flyover W)**.
    - Show the **Segment Inspector Panel** on the right updating instantly.
    - Highlight the exact GPS coordinates ($28.618487°N, 77.199852°E$), current volume vs forecast volume, mean speed, and Volume-to-Capacity saturation progress bar ($V/C = 0.90$).
  - **Interaction 2 (Filter & Search):**
    - Select `Severe` in the map congestion filter to isolate high-friction corridors.
    - Type `Airport` in the search box to highlight `NL-015` (Airport Feeder) and `NL-016` (Airport Underpass).

---

### Step 3: Traffic Volume Forecasting
- **Action:** Click the **"📈 Traffic Forecasting"** tab.
- **Talking Points:**
  - *"Our primary volume predictor is a Gradient Boosting Regressor (HistGB) trained over 150 boosting stages."*
  - Review the **Road Comparison Chart**: Side-by-side visualization of current vehicle throughput versus forecasted volume for the next 30-minute window across segments.
  - Review the **Forecast Telemetry Table**: Explains volume deltas and capacity saturation for traffic management operators.
  - Highlight the model alternatives card comparing HistGB ($RMSE = 58.80$ veh) against Random Forest ($62.31$), PyTorch GRU ($64.19$), and NumPy GD linear regression ($108.34$).

---

### Step 4: Congestion Analytics
- **Action:** Click the **"🚦 Congestion Analytics"** tab.
- **Talking Points:**
  - *"We classify traffic conditions into 4 distinct operational regimes: Free-flow, Moderate, Heavy, and Severe."*
  - Point to the **Operational Thresholds Reference**:
    - *Free-flow:* $V/C < 0.50$ (Design speed unimpeded).
    - *Moderate:* $0.50 \le V/C < 0.80$ (Stable flow, light friction).
    - *Heavy:* $0.80 \le V/C < 1.00$ (Queuing, unstable flow).
    - *Severe:* $V/C \ge 1.00$ (Gridlock breakdown).
  - Review the **Road Congestion Table**: Displays predicted next state, speed decay, and occupancy % per segment.

---

### Step 5: Travel-Time Prediction
- **Action:** Click the **"⏱️ Travel-Time"** tab.
- **Talking Points:**
  - *"Travel time estimation is critical for dynamic route guidance and signal optimization."*
  - Review the **Delay Comparison Chart**: Color-coded bars showing predicted travel times with delay deltas ($+$ or $-$ minutes) relative to free-flow conditions.
  - HistGB regressor achieves $RMSE = 1.087$ min ($R^2 = 0.8281$) across the 25 links.

---

### Step 6: Accident Risk Analytics & Safety Disclaimer
- **Action:** Click the **"⚠️ Accident Risk"** tab.
- **Talking Points:**
  - **Safety Disclaimer:** *"Notice the prominent yellow warning box. FlowCast AI treats safety modeling with extreme scientific honesty. This is an experimental statistical risk indicator for pre-positioning patrol units. It is NOT an autonomous collision warning or real-time accident detection system."*
  - **Class Imbalance & Platt Calibration:**
    - *"Accidents are rare events occurring in under 1% of time windows. Uncalibrated balanced logistic regression produces artificial probabilities up to 40%–60%, triggering chronic false alarms."*
    - *"We applied validation Platt scaling to ground probabilities to empirical event frequency, achieving a Brier score of 0.00952, beating the historical prevalence baseline."*
  - **Threshold Slider Interaction:**
    - Adjust the slider between $0.5\%$ and $2.0\%$.
    - Show how the recommended $1.0\%$ threshold flags the highest-friction segments with $46.18\%$ incident catch rate and $75.68\%$ operational specificity.

---

### Step 7: Model Performance Studio
- **Action:** Click the **"🔬 Model Studio"** tab.
- **Talking Points:**
  - *"All numbers shown in this studio originate directly from our holdout test evaluation (`evaluation_metrics.json`). No metrics are hardcoded."*
  - Review the Volume Forecasting Table ($R^2$, MAE, RMSE, MAPE).
  - Review the Congestion Classification Table (Accuracy $87.11\%$, Macro-$F_1 = 0.7574$).
  - Review the **Confusion Matrix**: 4x4 matrix visualizer confirming strong diagonal classification density.

---

### Step 8: Historical Data Explorer
- **Action:** Click the **"📜 Historical Explorer"** tab.
- **Talking Points:**
  - *"Operators can query verified sensor records across the 151-day dataset."*
  - **Interaction 1 (Successful Query):**
    - Date: `2025-05-20`, Time: `08:30`, Road: `All 25 Road Segments`.
    - Click **"🔍 Search Records"** to populate historical observations, targets, and weather.
  - **Interaction 2 (Date Bound Enforcement):**
    - Change date to `2024-11-20` (outside dataset bounds).
    - Click **"🔍 Search Records"** to demonstrate that the system returns a clear error alert enforcing the January 1 to May 31, 2025 boundary.

---

## 3. CHEAT SHEET FOR TECHNICAL Q&A

| Question | Recommended Answer |
| :--- | :--- |
| **"Where did the data come from?"** | *"The data is the original Northline Corridor dataset from Delhi covering January 1 to May 31, 2025. It consists of 178,468 sensor records, 10,872 weather observations, and 151 calendar events in `data/raw/`."* |
| **"Is live streaming traffic displayed?"** | *"No. The application is clearly labeled as an operational demonstration and forecasting engine using verified historical telemetry. Real-time inference models compute $+30$-minute forecasts based on the selected operational window."* |
| **"Why is the accident model's precision only 1.82%?"** | *"In severe class imbalance (~105:1), even a strong classifier operating at 75.7% specificity will yield low precision. In urban operations, this model is designed for patrol pre-positioning and variable message signage, catching nearly half of all incidents before they occur, rather than deterministic alarm triggers."* |
| **"How is data leakage prevented?"** | *"Through strict chronological splitting: 70% Train (Jan 1–Apr 16), 15% Validation (Apr 16–May 9), 15% Holdout Test (May 9–May 31). Lag features only use $t-1$ or older observations, rolling windows apply `.shift(1)` prior to rolling, and scalers fit strictly on training samples."* |
| **"What models are running in production?"** | *"Gradient Boosting Regressors for Volume and Travel Time, Gradient Boosting Classifier for Congestion Level, and Platt-calibrated Logistic Regression for Accident Risk. Deep learning GRU and Random Forest models are also available in the benchmark registry."* |

---

## 4. WINDOWS COMMAND TO RUN THE DEMONSTRATION

```powershell
cd D:\flowcast
python run_server.py
```
*Open http://127.0.0.1:8000 in your browser.*
