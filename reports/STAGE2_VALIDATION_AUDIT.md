# FlowCast AI — Stage 2 Validation & Pipeline Audit Report
**Corridor:** Northline Corridor, Delhi (25 Arterial Segments)  
**Dataset:** Processed Telemetry (1 Jan – 31 May 2025)  
**Audit Date:** 31 October 2026  
**Auditor:** Antigravity AI Engineering Validation Suite  

---

## Executive Summary: Overall Pipeline Readiness

| Audit Check | Status | Key Finding / Action Taken |
| :--- | :--- | :--- |
| **1. Timestamp Sequence & Continuity** | **CORRECTED & PASSED** | Detected 4,385 sequence gaps (>30m) in raw telemetry; target generator updated to validate $\Delta t = 30$m strictly, preventing irregular leaps. |
| **2. Feature Leakage Verification** | **PASSED (100% CLEAN)** | All lags $\le t-1$; rolling windows shifted prior to rolling; temporal splits strictly disjoint; scalers fit only on train. |
| **3. Accident-Risk Evaluation** | **CORRECTED & PASSED** | Identified why balanced LR produced Brier score 0.2579 (log-odds inflation); implemented Platt calibration on validation to restore Brier score to 0.0096. |
| **4. Non-Accident Model Benchmarks** | **PASSED** | Volume HistGB (RMSE: 58.8 veh, $R^2$: 0.9584) beats baselines; Congestion HistGB achieves 87.11% accuracy; clipped negative linear volume predictions. |
| **5. Deep Learning Sequence Model** | **PASSED** | PyTorch GRU trained and validated with test RMSE 64.19 veh ($R^2$: 0.9504). |
| **6. Reproducibility & Artifacts** | **PASSED** | All 12 saved models and preprocessors loaded and executed inference with deterministic reproducibility. |

**Readiness for Dashboard Integration:** **APPROVED WITH OPERATIONAL GUARDS**. The data and ML pipelines are certified analysis-ready.

---

## 1. Timestamp Sequence & Target Validation Audit

In the original raw telemetry, detector hardware dropouts created occasional missing observation windows.
- **Total Historical Sequence Gaps (>30 min):** 4,385
- **Gap Breakdown:** 4,272 gaps of 60 minutes, 113 gaps of 90 minutes.
- **Identified Defect:** A naive `shift(-1)` operation paired observations across gaps, incorrectly treating 60-minute or 90-minute gaps as next 30-minute targets.
- **Correction Implemented in `src/features.py`:**
  ```python
  df["next_dt"] = grouped["dt"].shift(-1)
  is_valid_30m = (df["next_dt"] == (df["dt"] + pd.Timedelta(minutes=30)))
  df["target_traffic_volume"] = np.where(is_valid_30m, grouped["traffic_volume"].shift(-1), np.nan)
  ```
- **Result:** Exactly 172,291 verified consecutive 30-minute pairs are utilized for modeling; all 4,385 irregular leaps are isolated and excluded.

---

## 2. Feature Leakage Audit

| Leakage Dimension | Audit Result | Evidence / Implementation Details |
| :--- | :--- | :--- |
| **Historical Lag Restraint** | **PASS** | Lags `traffic_volume_lag1`, `lag2`, `lag3` and `avg_speed_lag1` use strictly $t-1$, $t-2$, $t-3$. |
| **Rolling Window Shift** | **PASS** | `rolling_mean_4`, `rolling_mean_6`, `rolling_std_4` apply `.shift(1)` *before* rolling calculation. Window $t$ has zero exposure to contemporaneous metrics. |
| **Target Exclusion** | **PASS** | Zero target attributes exist in `FEATURE_COLUMNS`. |
| **Temporal Split Integrity** | **PASS** | Train, Validation, and Test timestamp sets are strictly disjoint: Overlap count = 0. |
| **Scaler Isolation** | **PASS** | `StandardScaler.fit()` is called strictly on `X_train_raw`. Max difference between scaler mean and train sample mean is 0.00e+00. |
| **Spatial Alignment** | **PASS** | All 25 road segments are synchronized to the exact same temporal split boundaries. |

---

## 3. Model Benchmark Summary (Validated Holdout Split)

### A. Traffic Volume Forecasting
- **Gradient Boosting (HistGB):** RMSE: **57.681 veh**, MAE: **39.646 veh**, $R^2$: **0.9599**
- **Random Forest:** RMSE: 61.137 veh, $R^2$: 0.955
- **PyTorch GRU:** RMSE: 63.484 veh, $R^2$: 0.9514
- **NumPy Gradient Descent Linear:** RMSE: 106.778 veh, $R^2$: 0.8626 (Non-negativity clipping enforced).

### B. Congestion Classification (4 Classes)
- **Gradient Boosting Classifier:** Accuracy: **87.29%**, Macro-$F_1$: **0.7597**
- **Random Forest Classifier:** Accuracy: 86.81%, Macro-$F_1$: 0.759
- **Persistence Baseline ($y_{t+1} = y_t$):** Accuracy: 77.90%, Macro-$F_1$: 0.6162
- **Majority Class Baseline:** Accuracy: 60.03%, Macro-$F_1$: 0.1876

### C. Travel Time Prediction
- **Gradient Boosting Regressor:** RMSE: **1.072 min**, MAE: **0.445 min**, $R^2$: **0.832**
- **Random Forest Regressor:** RMSE: 1.415 min, $R^2$: 0.7074
- **Linear Regression:** RMSE: 1.997 min, $R^2$: 0.4171
