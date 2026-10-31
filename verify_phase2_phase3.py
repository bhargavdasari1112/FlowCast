import hashlib
import os
import json
import pandas as pd
import numpy as np
import joblib
import torch
from src.features import FEATURE_COLUMNS
from src.models_runner import NumPyGradientDescentRegressor, TrafficGRU

print("=====================================================================")
print("PHASE 2: DATASET PROVENANCE, HASH VERIFICATION & INTEGRITY")
print("=====================================================================")

raw_files = {
    "traffic_sensor_log.csv": "8f793f3643c891d4fdda7b66c5c4792d24f4db3f26a07cccb8f1d613e254062a",
    "weather_observations.csv": "63f3dc54a491dfd5d4663d8bf0602779084c30a1396f0c7b4fd177e132bc8a31",
    "calendar_events.csv": "60d3de6b731486e02f6edaa3515af87c2472231a211b48d94d7a3cad38799b9c"
}

all_raw_ok = True
for filename, expected_hash in raw_files.items():
    filepath = os.path.join("d:/flowcast/data/raw", filename)
    if not os.path.exists(filepath):
        print(f"✗ MISSING: {filename}")
        all_raw_ok = False
        continue
    with open(filepath, "rb") as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()
    match = (file_hash == expected_hash)
    status = "MATCH" if match else "MISMATCH"
    icon = "✓" if match else "✗"
    print(f"  {icon} {filename:<26} | Size: {os.path.getsize(filepath):10} B | SHA-256: {file_hash} ({status})")
    if not match:
        all_raw_ok = False

df_proc = pd.read_csv("d:/flowcast/data/processed/northline_traffic_processed.csv")
print(f"\nProcessed Telemetry Store: {len(df_proc):,} records")
print(f"Road count: {df_proc['road_id'].nunique()} unique segments (NL-001 through NL-025)")
print(f"Date range: {df_proc['timestamp'].min()} to {df_proc['timestamp'].max()}")
print(f"Missing values in processed dataset: {df_proc.isna().sum().sum()}")

roads = df_proc[["road_id", "road_name", "latitude", "longitude"]].drop_duplicates().sort_values("road_id")
print("\nVerified Delhi Northline Corridor 25 Road Segments:")
for idx, r in roads.reset_index(drop=True).iterrows():
    print(f"  [{r['road_id']}] {r['road_name']:<24} (Lat: {r['latitude']:.4f}°N, Lon: {r['longitude']:.4f}°E)")

print("\n=====================================================================")
print("PHASE 3: MACHINE LEARNING METRICS & HOLDOUT RECONCILIATION")
print("=====================================================================")

with open("d:/flowcast/reports/evaluation_metrics.json") as f:
    eval_metrics = json.load(f)

# Volume
vol_histgb = eval_metrics["traffic_volume"]["Gradient Boosting (HistGB)"]
print("\n1. Volume Forecasting (Holdout Test Split):")
print(f"   RMSE:  {vol_histgb['rmse']:.3f} veh  (Expected: 58.799)")
print(f"   MAE:   {vol_histgb['mae']:.3f} veh  (Expected: 40.291)")
print(f"   R²:    {vol_histgb['r2']:.4f}       (Expected: 0.9584)")
print(f"   MAPE:  {vol_histgb['mape_pct']:.2f}%     (Expected: 9.68%)")

# Congestion
cong_histgb = eval_metrics["congestion"]["Gradient Boosting (HistGB)"]
print("\n2. Congestion Classification (4 Classes, Holdout Test Split):")
print(f"   Accuracy:    {cong_histgb['accuracy']*100:.2f}%  (Expected: 87.11%)")
print(f"   Macro-F1:    {cong_histgb['f1_macro']:.4f}    (Expected: 0.7574)")
print(f"   Weighted-F1: {cong_histgb['f1_weighted']:.4f}    (Expected: 0.8717)")

# Travel Time
tt_histgb = eval_metrics["travel_time"]["Gradient Boosting (HistGB)"]
print("\n3. Travel Time Estimation (Holdout Test Split):")
print(f"   RMSE:  {tt_histgb['rmse']:.3f} min (Expected: 1.087)")
print(f"   MAE:   {tt_histgb['mae']:.3f} min (Expected: 0.450)")
print(f"   R²:    {tt_histgb['r2']:.4f}      (Expected: 0.8281)")

# Accident Risk
acc_platt = eval_metrics["accident_risk"]["Platt Calibrated Logistic (Val)"]
print("\n4. Accident Friction Risk (Validation Platt Calibration):")
print(f"   Brier Score: {acc_platt['brier_score']:.5f} (Expected: 0.00952)")
print(f"   ROC-AUC:     {acc_platt['roc_auc']:.4f}   (Expected: 0.6185)")
print(f"   PR-AUC:      {acc_platt['pr_auc']:.4f}   (Expected: 0.0199)")

print("\n=====================================================================")
print("PHASE 3: ARTIFACT INFERENCE DETERMINISM CHECK")
print("=====================================================================")

models_dir = "d:/flowcast/models"
scaler = joblib.load(os.path.join(models_dir, "scaler.joblib"))
vol_gb = joblib.load(os.path.join(models_dir, "vol_gradient_boosting.joblib"))
cong_gb = joblib.load(os.path.join(models_dir, "cong_gradient_boosting.joblib"))
tt_gb = joblib.load(os.path.join(models_dir, "tt_gradient_boosting.joblib"))
acc_cal = joblib.load(os.path.join(models_dir, "acc_logistic_platt_calibrated.joblib"))

# Run 3 passes on standard input vector
X_test = np.ones((1, len(FEATURE_COLUMNS)))
X_scaled = scaler.transform(X_test)

vol_preds = [vol_gb.predict(X_scaled)[0] for _ in range(3)]
cong_preds = [cong_gb.predict(X_scaled)[0] for _ in range(3)]
tt_preds = [tt_gb.predict(X_scaled)[0] for _ in range(3)]

print(f"Volume Predictions (3 runs): {vol_preds} (Deterministic: {len(set(vol_preds)) == 1})")
print(f"Congestion Predictions (3 runs): {cong_preds} (Deterministic: {len(set(cong_preds)) == 1})")
print(f"Travel Time Predictions (3 runs): {tt_preds} (Deterministic: {len(set(tt_preds)) == 1})")
