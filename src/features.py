"""
FlowCast AI - Northline Corridor Feature Engineering & Chronological Split
Module M3: Constructs historical lags, rolling statistics, calendar/weather encodings,
and strictly non-leaking forward targets.
"""

import os
import sys

# Ensure project root is in sys.path
sys.path.insert(0, "d:/flowcast")
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import json
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple, List
from sklearn.preprocessing import StandardScaler, LabelEncoder

PROCESSED_DATA_PATH = "d:/flowcast/data/processed/northline_traffic_processed.csv"

def parse_vehicle_distribution(v_series: pd.Series) -> pd.DataFrame:
    """Parses nested JSON vehicle_type_dist into individual numerical share columns."""
    records = []
    for s in v_series:
        if isinstance(s, str):
            try:
                d = json.loads(s.replace("'", '"'))
            except Exception:
                d = {}
        elif isinstance(d, dict):
            d = s
        else:
            d = {}
        records.append({
            "veh_share_2w": float(d.get("2W", 0.0)),
            "veh_share_car": float(d.get("Car", 0.0)),
            "veh_share_lcv": float(d.get("LCV", 0.0)),
            "veh_share_hcv": float(d.get("HCV", 0.0))
        })
    return pd.DataFrame(records)

def build_features_and_targets(df_raw: pd.DataFrame) -> pd.DataFrame:
    """
    Constructs historical features and next 30-min targets (t+1) separately per road_id.
    Zero future information is used for features.
    """
    df = df_raw.copy()
    
    # Ensure datetime sort per road_id
    if "dt" not in df.columns:
        df["dt"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values(["road_id", "dt"]).reset_index(drop=True)
    
    # 1. Parse Vehicle Type Distribution
    v_df = parse_vehicle_distribution(df["vehicle_type_dist"])
    for col in v_df.columns:
        df[col] = v_df[col]
        
    # 2. Temporal & Calendar Encodings
    dt_series = pd.to_datetime(df["timestamp"])
    df["hour"] = dt_series.dt.hour
    df["minute"] = dt_series.dt.minute
    df["time_fraction"] = df["hour"] + df["minute"] / 60.0
    df["sin_hour"] = np.sin(2 * np.pi * df["time_fraction"] / 24.0)
    df["cos_hour"] = np.cos(2 * np.pi * df["time_fraction"] / 24.0)
    
    df["day_of_week_num"] = dt_series.dt.day_of_week
    df["sin_dow"] = np.sin(2 * np.pi * df["day_of_week_num"] / 7.0)
    df["cos_dow"] = np.cos(2 * np.pi * df["day_of_week_num"] / 7.0)
    
    df["is_weekend"] = (df["day_of_week_num"] >= 5).astype(int)
    df["public_holiday"] = df["public_holiday"].fillna(0).astype(int)
    df["event_flag"] = df["event_flag"].fillna(0).astype(int)
    df["roadwork_flag"] = df["roadwork_flag"].fillna(0).astype(int)
    
    # 3. Weather Condition One-Hot Encodings
    weather_conds = ["Clear", "Cloudy", "Rain", "Fog"]
    for wc in weather_conds:
        df[f"weather_{wc}"] = (df["weather_condition"] == wc).astype(int)
        
    # Numerical weather
    df["rainfall"] = df["rainfall"].fillna(0.0).astype(float)
    df["temperature"] = df["temperature"].fillna(df["temperature"].median()).astype(float)
    df["visibility"] = df["visibility"].fillna(df["visibility"].median()).astype(float)
    df["road_capacity"] = df["road_capacity"].astype(float)
    
    # 4. Lag and Rolling Historical Features (computed per road_id in strict chronological order)
    grouped = df.groupby("road_id")
    
    # Lags (t-1, t-2, t-3)
    df["traffic_volume_lag1"] = grouped["traffic_volume"].shift(1)
    df["traffic_volume_lag2"] = grouped["traffic_volume"].shift(2)
    df["traffic_volume_lag3"] = grouped["traffic_volume"].shift(3)
    
    # Rolling 2-hour average traffic volume (4 windows: t-1 to t-4)
    df["traffic_volume_roll_mean_4"] = grouped["traffic_volume"].transform(
        lambda s: s.shift(1).rolling(4, min_periods=1).mean()
    )
    
    # Rolling 3-hour average speed (6 windows: t-1 to t-6)
    df["avg_speed_roll_mean_6"] = grouped["avg_speed"].transform(
        lambda s: s.shift(1).rolling(6, min_periods=1).mean()
    )
    
    # Occupancy lag
    df["occupancy_lag1"] = grouped["occupancy"].shift(1)
    
    # Speed lag 1 & 2 for speed change
    df["avg_speed_lag1"] = grouped["avg_speed"].shift(1)
    df["avg_speed_lag2"] = grouped["avg_speed"].shift(2)
    
    # Changes
    df["traffic_volume_change"] = df["traffic_volume_lag1"] - df["traffic_volume_lag2"]
    df["speed_change"] = df["avg_speed_lag1"] - df["avg_speed_lag2"]
    
    # Rolling std of volume (4 windows)
    df["traffic_volume_roll_std_4"] = grouped["traffic_volume"].transform(
        lambda s: s.shift(1).rolling(4, min_periods=2).std().fillna(0.0)
    )
    
    # Impute boundary startup lags for first rows of each road
    df["traffic_volume_lag1"] = df["traffic_volume_lag1"].bfill()
    df["traffic_volume_lag2"] = df["traffic_volume_lag2"].bfill()
    df["traffic_volume_lag3"] = df["traffic_volume_lag3"].bfill()
    df["avg_speed_lag1"] = df["avg_speed_lag1"].bfill()
    df["avg_speed_lag2"] = df["avg_speed_lag2"].bfill()
    df["occupancy_lag1"] = df["occupancy_lag1"].bfill()
    df["traffic_volume_roll_mean_4"] = df["traffic_volume_roll_mean_4"].bfill()
    df["avg_speed_roll_mean_6"] = df["avg_speed_roll_mean_6"].bfill()
    df["traffic_volume_change"] = df["traffic_volume_change"].fillna(0.0)
    df["speed_change"] = df["speed_change"].fillna(0.0)
    df["traffic_volume_roll_std_4"] = df["traffic_volume_roll_std_4"].fillna(0.0)
    
    # 5. Prediction Targets at GENUINE next 30-minute interval (t+30m) per road_id
    # Validates timestamp sequence: ensures observation is exactly 30 minutes in the future
    df["next_dt"] = grouped["dt"].shift(-1)
    is_valid_30m = (df["next_dt"] == (df["dt"] + pd.Timedelta(minutes=30)))
    
    # A. Traffic volume (regression)
    df["target_traffic_volume"] = np.where(is_valid_30m, grouped["traffic_volume"].shift(-1), np.nan)
    
    # B. Congestion level (classification: Free-flow, Moderate, Heavy, Severe)
    df["target_congestion_level"] = np.where(is_valid_30m, grouped["congestion_level"].shift(-1), np.nan)
    
    # C. Travel time (regression)
    df["target_travel_time"] = np.where(is_valid_30m, grouped["travel_time"].shift(-1), np.nan)
    
    # D. Accident risk (binary: accident_count > 0 at t+30m)
    df["target_accident_count"] = np.where(is_valid_30m, grouped["accident_count"].shift(-1), np.nan)
    df["target_accident_risk"] = np.where(is_valid_30m, (df["target_accident_count"] > 0).astype(float), np.nan)
    
    # Drop rows where genuine t+30m target is unavailable (4,385 gap intervals + 25 final window boundaries)
    df_clean = df.dropna(subset=["target_traffic_volume"]).copy().reset_index(drop=True)
    df_clean["target_traffic_volume"] = df_clean["target_traffic_volume"].astype(float)
    df_clean["target_travel_time"] = df_clean["target_travel_time"].astype(float)
    df_clean["target_accident_risk"] = df_clean["target_accident_risk"].astype(int)
    
    return df_clean

# Standard feature set definition
FEATURE_COLUMNS = [
    # Volume Lags & Rolling
    "traffic_volume_lag1",
    "traffic_volume_lag2",
    "traffic_volume_lag3",
    "traffic_volume_roll_mean_4",
    "traffic_volume_roll_std_4",
    "traffic_volume_change",
    # Speed & Occupancy Lags & Changes
    "avg_speed_lag1",
    "avg_speed_roll_mean_6",
    "speed_change",
    "occupancy_lag1",
    # Road Infrastructure
    "road_capacity",
    "signal_timing",
    # Temporal & Calendar
    "hour",
    "sin_hour",
    "cos_hour",
    "day_of_week_num",
    "sin_dow",
    "cos_dow",
    "is_weekend",
    "public_holiday",
    "event_flag",
    "roadwork_flag",
    # Weather
    "temperature",
    "rainfall",
    "visibility",
    "weather_Clear",
    "weather_Cloudy",
    "weather_Rain",
    "weather_Fog",
    # Vehicle Class Shares
    "veh_share_2w",
    "veh_share_car",
    "veh_share_lcv",
    "veh_share_hcv"
]

def split_chronological(df: pd.DataFrame, train_ratio: float = 0.70, val_ratio: float = 0.15) -> Dict[str, pd.DataFrame]:
    """
    Performs strict timestamp-based chronological partitioning.
    All road segments belonging to the same timestamp remain in the same split.
    """
    unique_timestamps = sorted(df["timestamp"].unique())
    n_ts = len(unique_timestamps)
    n_train = int(n_ts * train_ratio)
    n_val = int(n_ts * val_ratio)
    
    train_ts = set(unique_timestamps[:n_train])
    val_ts = set(unique_timestamps[n_train:n_train + n_val])
    test_ts = set(unique_timestamps[n_train + n_val:])
    
    train_df = df[df["timestamp"].isin(train_ts)].copy().sort_values(["timestamp", "road_id"]).reset_index(drop=True)
    val_df = df[df["timestamp"].isin(val_ts)].copy().sort_values(["timestamp", "road_id"]).reset_index(drop=True)
    test_df = df[df["timestamp"].isin(test_ts)].copy().sort_values(["timestamp", "road_id"]).reset_index(drop=True)
    
    return {
        "train": train_df,
        "val": val_df,
        "test": test_df,
        "split_timestamps": {
            "train_range": (unique_timestamps[0], unique_timestamps[n_train - 1]),
            "val_range": (unique_timestamps[n_train], unique_timestamps[n_train + n_val - 1]),
            "test_range": (unique_timestamps[n_train + n_val], unique_timestamps[-1])
        }
    }

def prepare_ml_data(csv_path: str = PROCESSED_DATA_PATH) -> Dict[str, Any]:
    """
    Full feature pipeline execution:
    1. Loads processed Northline dataset
    2. Constructs lags, rolling statistics, calendar, weather, vehicle distribution
    3. Chronological 70/15/15 split
    4. Fits StandardScaler strictly on train features only
    5. Returns feature arrays, target arrays, feature names, and scalers
    """
    print(f"Loading analysis-ready processed dataset from: {csv_path}")
    df_raw = pd.read_csv(csv_path, low_memory=False)
    
    print("Engineering features and shifting future targets (t+1)...")
    df_feat = build_features_and_targets(df_raw)
    print(f"Dataset with features: {df_feat.shape[0]} rows x {df_feat.shape[1]} columns")
    
    # Congestion label encoding
    congestion_classes = ["Free-flow", "Moderate", "Heavy", "Severe"]
    label_encoder = LabelEncoder()
    label_encoder.fit(congestion_classes)
    df_feat["target_congestion_code"] = label_encoder.transform(df_feat["target_congestion_level"])
    
    # Chronological Split
    splits = split_chronological(df_feat, train_ratio=0.70, val_ratio=0.15)
    train_df = splits["train"]
    val_df = splits["val"]
    test_df = splits["test"]
    
    print(f"Split sizes -> Train: {len(train_df):,} | Val: {len(val_df):,} | Test: {len(test_df):,}")
    
    # Feature Scaling - FIT ON TRAIN ONLY
    scaler = StandardScaler()
    X_train_raw = train_df[FEATURE_COLUMNS].values
    X_val_raw = val_df[FEATURE_COLUMNS].values
    X_test_raw = test_df[FEATURE_COLUMNS].values
    
    scaler.fit(X_train_raw)
    X_train = scaler.transform(X_train_raw)
    X_val = scaler.transform(X_val_raw)
    X_test = scaler.transform(X_test_raw)
    
    return {
        "feature_names": FEATURE_COLUMNS,
        "scaler": scaler,
        "label_encoder": label_encoder,
        "congestion_classes": congestion_classes,
        "splits_df": splits,
        "X_train": X_train,
        "X_val": X_val,
        "X_test": X_test,
        # Raw unscaled features for tree-based models if desired
        "X_train_raw": X_train_raw,
        "X_val_raw": X_val_raw,
        "X_test_raw": X_test_raw,
        # Targets
        "y_train_vol": train_df["target_traffic_volume"].values,
        "y_val_vol": val_df["target_traffic_volume"].values,
        "y_test_vol": test_df["target_traffic_volume"].values,
        "y_train_cong": train_df["target_congestion_code"].values,
        "y_val_cong": val_df["target_congestion_code"].values,
        "y_test_cong": test_df["target_congestion_code"].values,
        "y_train_tt": train_df["target_travel_time"].values,
        "y_val_tt": val_df["target_travel_time"].values,
        "y_test_tt": test_df["target_travel_time"].values,
        "y_train_acc": train_df["target_accident_risk"].values,
        "y_val_acc": val_df["target_accident_risk"].values,
        "y_test_acc": test_df["target_accident_risk"].values,
    }

if __name__ == "__main__":
    data = prepare_ml_data()
    print("\nFeature Engineering Verification:")
    print(f"Total features: {len(data['feature_names'])}")
    print("Features list:")
    for i, f in enumerate(data['feature_names'], 1):
        print(f"  {i}. {f}")
    print(f"\nTraffic Volume Train mean: {data['y_train_vol'].mean():.1f}, Test mean: {data['y_test_vol'].mean():.1f}")
    print(f"Accident Risk Train positive rate: {data['y_train_acc'].mean()*100:.3f}%, Test positive rate: {data['y_test_acc'].mean()*100:.3f}%")
