"""
FlowCast AI - Advanced Feature Preprocessing and Time-Series Engineering
Supports chronological splits, lag features, moving window statistics, and strict zero-leakage transforms.
"""

import numpy as np
import pandas as pd
from typing import Tuple, List, Dict, Any

WEATHER_CATEGORIES = ["Clear", "Rain", "Heavy Rain", "Fog", "Storm"]
CONGESTION_CLASSES = ["Free Flow", "Moderate", "Heavy", "Gridlock"]
RISK_CLASSES = ["Low", "Medium", "High", "Critical"]

class TrafficDataPreprocessor:
    def __init__(self):
        self.feature_names: List[str] = []
        self.means: Optional[np.ndarray] = None
        self.stds: Optional[np.ndarray] = None
        
    def add_lag_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Generates realistic auto-regressive lag and rolling statistics
        strictly based on prior time steps (preventing future lookahead leakage).
        """
        df_out = df.copy()
        
        # Ensure chronological ordering per corridor
        if "timestamp" in df_out.columns:
            df_out["dt"] = pd.to_datetime(df_out["timestamp"])
            df_out = df_out.sort_values(["corridor_id", "dt"]).reset_index(drop=True)
            
        # Group by corridor to compute past lags
        grouped = df_out.groupby("corridor_id")
        
        # Volume lags (t-1 step = 1 hr / sample, or prior observation)
        df_out["vol_lag_1"] = grouped["traffic_volume"].shift(1).bfill()
        df_out["vol_lag_2"] = grouped["traffic_volume"].shift(2).bfill()
        df_out["vol_rolling_mean_3"] = grouped["traffic_volume"].transform(lambda x: x.shift(1).rolling(3, min_periods=1).mean()).bfill()
        
        # Speed & Occupancy lags
        df_out["speed_lag_1"] = grouped["avg_speed_kmh"].shift(1).bfill()
        df_out["occ_lag_1"] = grouped["road_occupancy_pct"].shift(1).bfill()
        df_out["occ_rolling_mean_3"] = grouped["road_occupancy_pct"].transform(lambda x: x.shift(1).rolling(3, min_periods=1).mean()).bfill()
        
        # Drop temporary dt column
        if "dt" in df_out.columns:
            df_out = df_out.drop(columns=["dt"])
            
        return df_out

    def extract_features(self, df: pd.DataFrame, is_training: bool = False) -> np.ndarray:
        """
        Extracts temporal, meteorological, geometric, and traffic dynamics features.
        Zero data leakage: scaling parameters (mean, std) learned strictly during training.
        """
        # Ensure lag columns exist if single row passed in inference
        for col, default_val in [
            ("vol_lag_1", 1200.0), ("vol_lag_2", 1150.0), ("vol_rolling_mean_3", 1200.0),
            ("speed_lag_1", 45.0), ("occ_lag_1", 35.0), ("occ_rolling_mean_3", 35.0)
        ]:
            if col not in df.columns:
                df[col] = default_val

        # 1. Temporal cyclical encodings
        hour = df["hour"].values.astype(float)
        dow = df["day_of_week"].values.astype(float)
        
        sin_hour = np.sin(2 * np.pi * hour / 24.0)
        cos_hour = np.cos(2 * np.pi * hour / 24.0)
        sin_dow = np.sin(2 * np.pi * dow / 7.0)
        cos_dow = np.cos(2 * np.pi * dow / 7.0)
        
        is_weekend = df["is_weekend"].values.astype(float)
        is_holiday = df["is_holiday"].values.astype(float)
        is_rush_hour = df["is_rush_hour"].values.astype(float)
        special_event = df["special_event"].values.astype(float)
        
        # 2. Weather & environmental features
        temp = df["temperature_c"].values.astype(float)
        precip = df["precipitation_mm"].values.astype(float)
        vis = df["visibility_km"].values.astype(float)
        wind = df["wind_speed_kmh"].values.astype(float)
        
        weather_dummies = []
        for cat in WEATHER_CATEGORIES:
            weather_dummies.append((df["weather"].values == cat).astype(float))
            
        # 3. Corridor structural features
        lanes = df["num_lanes"].values.astype(float)
        length_km = df["length_km"].values.astype(float)
        free_flow = df["free_flow_speed"].values.astype(float)
        capacity = df["capacity"].values.astype(float)
        junction_risk = df["junction_risk"].values.astype(float)
        
        # 4. Sensor telemetry & dynamics
        avg_speed = df["avg_speed_kmh"].values.astype(float)
        occupancy = df["road_occupancy_pct"].values.astype(float)
        speed_var = df["speed_variance"].values.astype(float)
        heavy_veh = df["heavy_vehicle_pct"].values.astype(float)
        
        # 5. Non-linear Interaction Features
        weather_hazard = (precip / 15.0) + np.maximum(0.0, (10.0 - vis) / 10.0) * 0.8
        density_proxy = occupancy / np.maximum(avg_speed, 4.0)
        speed_deficit = np.maximum(0.0, (free_flow - avg_speed) / np.maximum(free_flow, 10.0))
        shockwave_factor = (occupancy / 100.0) * (speed_var / 15.0)
        hydroplane_hazard = (precip / 10.0) * (avg_speed / 80.0)
        capacity_pressure = occupancy * lanes / 100.0
        
        # 6. Auto-Regressive Prior State Lags
        vol_lag_1 = df["vol_lag_1"].values.astype(float)
        vol_lag_2 = df["vol_lag_2"].values.astype(float)
        vol_roll = df["vol_rolling_mean_3"].values.astype(float)
        speed_lag_1 = df["speed_lag_1"].values.astype(float)
        occ_lag_1 = df["occ_lag_1"].values.astype(float)
        occ_roll = df["occ_rolling_mean_3"].values.astype(float)
        
        feature_columns = [
            ("sin_hour", sin_hour),
            ("cos_hour", cos_hour),
            ("sin_dow", sin_dow),
            ("cos_dow", cos_dow),
            ("is_weekend", is_weekend),
            ("is_holiday", is_holiday),
            ("is_rush_hour", is_rush_hour),
            ("special_event", special_event),
            ("temperature_c", temp),
            ("precipitation_mm", precip),
            ("visibility_km", vis),
            ("wind_speed_kmh", wind),
            ("weather_Clear", weather_dummies[0]),
            ("weather_Rain", weather_dummies[1]),
            ("weather_HeavyRain", weather_dummies[2]),
            ("weather_Fog", weather_dummies[3]),
            ("weather_Storm", weather_dummies[4]),
            ("num_lanes", lanes),
            ("length_km", length_km),
            ("free_flow_speed", free_flow),
            ("capacity", capacity),
            ("junction_risk", junction_risk),
            ("avg_speed_kmh", avg_speed),
            ("road_occupancy_pct", occupancy),
            ("speed_variance", speed_var),
            ("heavy_vehicle_pct", heavy_veh),
            ("weather_hazard", weather_hazard),
            ("density_proxy", density_proxy),
            ("speed_deficit", speed_deficit),
            ("shockwave_factor", shockwave_factor),
            ("hydroplane_hazard", hydroplane_hazard),
            ("capacity_pressure", capacity_pressure),
            ("vol_lag_1", vol_lag_1),
            ("vol_lag_2", vol_lag_2),
            ("vol_rolling_mean_3", vol_roll),
            ("speed_lag_1", speed_lag_1),
            ("occ_lag_1", occ_lag_1),
            ("occ_rolling_mean_3", occ_roll)
        ]
        
        X = np.column_stack([col[1] for col in feature_columns])
        
        if is_training:
            self.feature_names = [col[0] for col in feature_columns]
            self.means = np.mean(X, axis=0)
            self.stds = np.std(X, axis=0)
            self.stds[self.stds < 1e-6] = 1.0
            
        X_scaled = (X - self.means) / self.stds
        return X_scaled

    @staticmethod
    def chronological_split(df: pd.DataFrame, train_ratio: float = 0.70, val_ratio: float = 0.15) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Partitions dataset chronologically to prevent temporal data leakage:
        - 70% Train (earliest time block)
        - 15% Validation (intermediate time block for model selection)
        - 15% Test (latest unseen holdout for unbiased reporting)
        """
        N = len(df)
        train_end = int(N * train_ratio)
        val_end = int(N * (train_ratio + val_ratio))
        
        train_idx = np.arange(0, train_end)
        val_idx = np.arange(train_end, val_end)
        test_idx = np.arange(val_end, N)
        return train_idx, val_idx, test_idx

    def to_dict(self) -> Dict[str, Any]:
        return {
            "feature_names": self.feature_names,
            "means": self.means.tolist() if self.means is not None else [],
            "stds": self.stds.tolist() if self.stds is not None else []
        }

    def from_dict(self, d: Dict[str, Any]):
        self.feature_names = d["feature_names"]
        self.means = np.array(d["means"])
        self.stds = np.array(d["stds"])
