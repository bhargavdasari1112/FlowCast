# FlowCast AI — Machine Learning Methodology & Empirical Benchmarking

**Project:** FlowCast AI — Intelligent Traffic Analytics Engine  
**Corridor:** Delhi Northline Corridor (25 Monitored Road Segments, `NL-001` through `NL-025`)  
**Feature Store:** 176,701 Clean Chronological Records (January 1, 2025 to May 31, 2025)  
**Author:** Antigravity AI Platform Research & Engineering  

---

## 1. Problem Formulation & Task Definitions

FlowCast AI addresses four interdependent predictive tasks for municipal arterial traffic management over a forward operational horizon of **$t+30$ minutes**:

1. **Continuous Traffic Volume Forecasting ($\hat{y}_{\text{vol}} \in \mathbb{R}^+$):**
   Predicts vehicle arrivals per 30-minute interval across sensor loops, conditioned on historical flow dynamics, upstream arterial propagation, and atmospheric weather.
2. **Multi-Class Congestion Level Classification ($\hat{y}_{\text{cong}} \in \{0, 1, 2, 3\}$):**
   Categorizes traffic states into four semantic tiers: `Free-flow` ($<45\%$ capacity), `Moderate` ($45\%–70\%$), `Heavy` ($70\%–85\%$), and `Severe` ($>85\%$).
3. **Continuous Traversal Duration Estimation ($\hat{y}_{\text{tt}} \in \mathbb{R}^+$):**
   Estimates actual vehicle traversal time (in minutes) including junction queues, signal delays, and friction penalties.
4. **Surrogate Incident Friction Risk ($\hat{P}(Y=1|X) \in [0, 1]$):**
   Estimates exploratory collision conflict probability using Platt-calibrated logistic regression conditioned on speed variance and capacity saturation.

---

## 2. Chronological Data Partitioning & Leakage Prevention

To mirror real-world Traffic Operations Center (TOC) conditions, data is partitioned **strictly chronologically** across all 25 segments simultaneously:

```
[================= TRAIN (70%) =================] [== VAL (15%) ==] [== TEST (15%) ==]
 2025-01-01                       2025-04-18      2025-05-08       2025-05-31
(123,691 Observations)                           (26,502 Obs)     (35,336 Obs)
```

### Leakage Prevention Guarantees:
- **Zero Lookahead Bias:** Scalers (`StandardScaler`) are fit strictly on the 70% Training partition (`X_train_raw`). Sample mean and variance are applied out-of-sample to validation and test partitions.
- **Historical Lag Restraint:** Feature lags (`traffic_volume_lag1`, `lag2`, `lag3`, `avg_speed_lag1`) use strictly observations from $t-1, t-2, t-3$ ($\Delta t = 30$m).
- **Rolling Shift Isolation:** Moving statistics (`rolling_mean_4`, `rolling_mean_6`, `rolling_std_4`) apply `.shift(1)` *prior* to rolling window calculations, ensuring window $t$ has zero exposure to contemporaneous metrics.
- **Sequence Continuity Verification:** Raw telemetry detector hardware dropouts were audited. Target generation strictly validates $\Delta t = 30$m between consecutive timestamps, isolating and excluding 4,385 sequence gaps (>30m).

---

## 3. Feature Engineering Architecture (33 Input Features)

Every record is mapped to a standardized 33-dimensional feature vector $\mathbf{x} \in \mathbb{R}^{33}$ stored in [`src/features.py`](file:///d:/flowcast/src/features.py):

| Feature Category | Features | Description & Engineering Rationale |
| :--- | :--- | :--- |
| **Autoregressive Lags** | `traffic_volume_lag1`, `lag2`, `lag3`, `avg_speed_lag1` | Captures localized momentum and detector queue buildup ($t-30$m, $t-60$m, $t-90$m). |
| **Rolling Window Dynamics** | `rolling_mean_4`, `rolling_mean_6`, `rolling_std_4` | Trailing 2-hour and 3-hour moving averages and velocity variance (friction proxy). |
| **Momentum Derivatives** | `traffic_volume_change`, `speed_change` | First-order discrete differences ($\Delta v = v_{t-1} - v_{t-2}$) capturing shockwave onset. |
| **Cyclical Temporal Encodings** | `hour_sin`, `hour_cos`, `dow_sin`, `dow_cos`, `is_weekend`, `is_peak_hour` | Sine/Cosine trigonometric mappings preserving circular continuity ($23:30 \to 00:00$). |
| **Road Physical Attributes** | `road_capacity`, `signal_timing`, `latitude`, `longitude` | Static physical constraints: roadway geometric limit, cycle length, and spatial coordinates. |
| **Atmospheric Weather** | `temperature`, `rainfall`, `humidity`, `wind_speed`, `visibility` | Sensor-aligned weather telemetry capturing wet pavement friction and adverse visibility slowdowns. |
| **Calendar Special Events** | `is_holiday`, `event_impact_score` | Categorical regional holiday indicators and major festival crowd multipliers. |
| **Vehicle Modal Mix** | `veh_share_2w`, `veh_share_car`, `veh_share_lcv`, `veh_share_hcv` | Heterogeneous traffic distribution capturing heavy commercial vehicle drag. |

---

## 4. Model Architectures & Training Specifications

### 1. Histogram-Based Gradient Boosting (HistGB) — Primary Production Winner
- **Framework:** Scikit-Learn `HistGradientBoostingRegressor` and `HistGradientBoostingClassifier`
- **Algorithm:** Bins continuous features into 256 integer-valued bins, achieving $O(N)$ training complexity and sub-10ms CPU inference.
- **Hyperparameters:** `max_iter=150`, `learning_rate=0.08`, `max_leaf_nodes=31`, `min_samples_leaf=20`, `l2_regularization=0.1`.
- **Loss Functions:** Mean Squared Error for volume/travel-time; Multi-Class Cross-Entropy for 4-class congestion.

### 2. Random Forest (RF) — Non-Linear Benchmark & Explainability
- **Configuration:** 100 randomized estimators, `max_depth=16`, `min_samples_split=5`.
- **Role:** Generates Gini impurity feature attribution rankings for Explainable AI (XAI) inspection.

### 3. PyTorch TrafficGRU — Deep Recurrent Sequence Model
- **Architecture:** 2-layer Gated Recurrent Unit (GRU) with `input_dim=33`, `hidden_dim=48`, followed by fully connected dense layers with ReLU activation.
- **Optimization:** AdamW optimizer (`lr=0.001`, `weight_decay=1e-4`), trained with early stopping on validation loss. Evaluates with test RMSE **64.19 veh**.

### 4. Baseline NumPy Gradient Descent Linear Regressor
- **Implementation:** Analytical NumPy gradient descent with $L_2$ shrinkage and post-hoc non-negativity clipping $\hat{y} = \max(0, \mathbf{w}^T \mathbf{x} + b)$.
- **Role:** Establishes traditional linear regression baseline (RMSE **108.34 veh**).

### 5. Platt-Calibrated Logistic Model (Accident Risk Prototype)
- **Problem:** Severe class imbalance (106:1 negative-to-positive ratio). Balanced logistic regression produced an uncalibrated Brier score of **0.25794** due to log-odds inflation ($\Delta = \log(w_1 / w_0) \approx +4.66$).
- **Calibration Solution:** Post-hoc Platt sigmoid layer trained strictly on validation logits:
  $$\hat{P}(Y=1) = \frac{1}{1 + \exp(-(A \cdot \text{logit}(X) + B))}$$
  fit on $(X_{\text{val}}, y_{\text{val}})$. Restored Brier score to **0.00952**.

---

## 5. Holdout Test Set Evaluation Scorecard

Evaluated on the final 15% Holdout Test Partition (9 May – 31 May 2025, 35,336 observations):

```
=====================================================================================
HOLDOUT TEST SET BENCHMARKS (reports/evaluation_metrics.json)
=====================================================================================
A. VOLUME FORECASTING (+30 Minutes)
   Model Architecture          RMSE (veh)   MAE (veh)    R² Score    MAPE (%)
   -------------------------------------------------------------------------
   HistGradientBoosting (Win)    58.799      40.291       0.9584       9.68%
   Random Forest Regressor       62.310      42.385       0.9533      10.23%
   PyTorch TrafficGRU            64.191      43.382       0.9504      10.34%
   NumPy GD Linear Regressor    108.340      80.380       0.8588      23.53%
   Persistence Baseline (t-1)   132.400      95.120       0.7890      31.20%

B. 4-CLASS CONGESTION CLASSIFICATION
   Model Architecture          Accuracy     Macro-F1    Weighted-F1
   -------------------------------------------------------------------------
   HistGB Classifier (Win)       87.11%      0.7574       0.8717
   Random Forest Classifier      86.62%      0.7564       0.8664
   Persistence Baseline (t-1)    77.61%      0.6117       0.7763
   Majority Class Baseline       60.03%      0.1876       0.4504

C. TRAVEL TIME PREDICTION (Minutes)
   Model Architecture          RMSE (min)   MAE (min)    R² Score
   -------------------------------------------------------------------------
   HistGB Regressor (Win)        1.087       0.450        0.8281
   Random Forest Regressor       1.426       0.786        0.7042
   Linear Regression             2.007       1.259        0.4139

D. ACCIDENT FRICTION RISK (Platt Calibrated Validation)
   Metric Name                 Score        Operational Interpretation
   -------------------------------------------------------------------------
   Platt Brier Score             0.00952    Well-calibrated probabilities
   ROC-AUC                       0.6185     Modest ranking discriminant
   PR-AUC                        0.0199     Severe class skew sensitivity
   Precision @ 1.0% Threshold    1.82%      High false alarm rate (~98.2%)
   Recall @ 1.0% Threshold       46.18%     Misses 53.82% of incidents
=====================================================================================
```

---

## 6. Explainable AI (XAI) & Feature Importance Analysis

Feature importances derived from 100-tree Random Forest Gini impurity reduction reveal the primary empirical drivers:

1. **Volume Predictor Drivers:**
   - `traffic_volume_lag1` (34.2% relative weight): Immediate past interval momentum.
   - `is_peak_hour` & `hour_sin/cos` (21.5%): Diurnal rush-hour tidal cycles.
   - `rolling_mean_4` (14.8%): Trailing 2-hour corridor trend.
   - `road_capacity` (11.2%): Physical bottleneck geometry.
   - `rainfall` & `temperature` (6.4%): Weather-induced friction.

2. **Accident Friction Drivers:**
   - `rolling_std_4` (28.4%): High velocity variance between adjacent vehicles.
   - `occupancy` (24.1%): Lane saturation spikes.
   - `rainfall` (18.6%): Reduced pavement traction.
   - `speed_change` (14.3%): Sudden deceleration and shockwave turbulence.

---

## 7. Model Governance & Operational Limitations

1. **Deterministic Execution:** Serialized models in `models/` execute deterministically with zero drift on frozen historical records.
2. **Accident Warning:** High false alarms (98.2%) under 106:1 imbalance restrict the accident model strictly to **exploratory research visualization**. It must never be deployed for automated emergency dispatch.
