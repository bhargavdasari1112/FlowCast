"""
FlowCast AI - Professional Inference Service & Dashboard Data Engine
Integrates trained machine learning models with the original Northline Corridor datasets:
  - Gradient Boosting Regressor (Volume & Travel Time)
  - Gradient Boosting Classifier (Congestion)
  - Platt-Calibrated Logistic Regression (Accident Risk)
  - Random Forest, NumPy GD, PyTorch GRU, and Persistence Baselines
Provides real-time model inference, historical query resolution, and metric reporting.
"""

import os
import sys
import json
import time
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
import __main__

sys.path.insert(0, "d:/flowcast")
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.features import build_features_and_targets, FEATURE_COLUMNS
from src.models_runner import NumPyGradientDescentRegressor, TrafficGRU

# Ensure custom classes can be unpickled across entry points
setattr(__main__, "NumPyGradientDescentRegressor", NumPyGradientDescentRegressor)
setattr(__main__, "TrafficGRU", TrafficGRU)

MODELS_DIR = "d:/flowcast/models"
REPORTS_DIR = "d:/flowcast/reports"
PROCESSED_DATA_PATH = "d:/flowcast/data/processed/northline_traffic_processed.csv"

# Experimental Accident Disclaimer
ACCIDENT_DISCLAIMER = (
    "STRICTLY EXPERIMENTAL RESEARCH PROTOTYPE: Severe class skew (106:1) limits precision to 1.82% at a 1.0% threshold "
    "(98.2% false-alarm rate) with PR-AUC of 0.0199 and ROC-AUC of 0.6185. Not designed, certified, or intended for "
    "operational emergency dispatch, automated life-safety response, or deterministic collision warning."
)

class NorthlineInferenceService:
    _instance = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        print("Initializing Northline Corridor Inference Service...")
        t0 = time.time()
        
        # 1. Load Preprocessing Artifacts & Models
        self.feature_names = json.load(open(os.path.join(MODELS_DIR, "feature_names.json")))
        self.scaler = joblib.load(os.path.join(MODELS_DIR, "scaler.joblib"))
        self.label_encoder = joblib.load(os.path.join(MODELS_DIR, "label_encoder.joblib"))
        
        # Volume Models
        self.vol_gb = joblib.load(os.path.join(MODELS_DIR, "vol_gradient_boosting.joblib"))
        self.vol_rf = joblib.load(os.path.join(MODELS_DIR, "vol_random_forest.joblib"))
        self.vol_lr = joblib.load(os.path.join(MODELS_DIR, "vol_linear_numpy_gd.joblib"))
        
        # Congestion Models
        self.cong_gb = joblib.load(os.path.join(MODELS_DIR, "cong_gradient_boosting.joblib"))
        self.cong_rf = joblib.load(os.path.join(MODELS_DIR, "cong_random_forest.joblib"))
        
        # Travel Time Models
        self.tt_gb = joblib.load(os.path.join(MODELS_DIR, "tt_gradient_boosting.joblib"))
        self.tt_rf = joblib.load(os.path.join(MODELS_DIR, "tt_random_forest.joblib"))
        self.tt_lr = joblib.load(os.path.join(MODELS_DIR, "tt_linear_regression.joblib"))
        
        # Accident Risk Calibrated Model
        acc_bundle = joblib.load(os.path.join(MODELS_DIR, "acc_logistic_platt_calibrated.joblib"))
        self.acc_base = acc_bundle["base_model"]
        self.acc_platt = acc_bundle["calibrator"]
        
        # Load Evaluation Metrics & Confusion Matrices
        self.eval_metrics = json.load(open(os.path.join(REPORTS_DIR, "evaluation_metrics.json")))
        self.confusion_matrices = json.load(open(os.path.join(REPORTS_DIR, "confusion_matrices.json")))
        self.feature_importances = json.load(open(os.path.join(REPORTS_DIR, "feature_importance.json")))
        
        # 2. Load Processed Dataset & Build Feature Store
        print("Building feature store from processed Northline dataset...")
        df_raw = pd.read_csv(PROCESSED_DATA_PATH, low_memory=False)
        self.df_feat = build_features_and_targets(df_raw)
        
        # Pre-index for O(1) timestamp and road lookups
        self.df_feat["dt_idx"] = pd.to_datetime(self.df_feat["timestamp"])
        self.df_feat["date_str"] = self.df_feat["dt_idx"].dt.strftime("%Y-%m-%d")
        self.df_feat["time_str"] = self.df_feat["dt_idx"].dt.strftime("%H:%M")
        
        # Unique road metadata table
        road_cols = [
            "road_id", "road_name", "latitude", "longitude",
            "weather_station_id", "road_capacity", "signal_timing"
        ]
        self.roads_meta = self.df_feat[road_cols].drop_duplicates("road_id").sort_values("road_id").reset_index(drop=True)
        self.roads_dict = {r["road_id"]: r for r in self.roads_meta.to_dict(orient="records")}
        
        # Default representative timestamp (Holdout Test Morning Peak)
        self.default_timestamp = "2025-05-20T08:30:00"
        
        t1 = time.time()
        print(f"NorthlineInferenceService initialized in {t1 - t0:.2f}s across {len(self.roads_dict)} road segments.")

    def resolve_timestamp(self, ts: Optional[str] = None, date: Optional[str] = None, time_str: Optional[str] = None) -> str:
        """Resolves provided date/time or timestamp into a valid dataset timestamp within Jan 1 - May 31 2025."""
        if ts:
            ts_norm = ts.replace(" ", "T")
            if len(ts_norm) == 16:
                ts_norm += ":00"
            if ts_norm in self.df_feat["timestamp"].values:
                return ts_norm
                
        if date and time_str:
            target = f"{date}T{time_str}:00" if len(time_str) == 5 else f"{date}T{time_str}"
            if target in self.df_feat["timestamp"].values:
                return target
            # Try fuzzy match on date
            matches = self.df_feat[self.df_feat["date_str"] == date]
            if not matches.empty:
                return str(matches["timestamp"].iloc[0])
                
        if date:
            matches = self.df_feat[self.df_feat["date_str"] == date]
            if not matches.empty:
                return str(matches["timestamp"].iloc[0])
                
        return self.default_timestamp

    def get_corridor_inference(self, timestamp: str) -> pd.DataFrame:
        """Extracts feature slice for a given timestamp and runs real-time model inference across all 25 segments."""
        sub = self.df_feat[self.df_feat["timestamp"] == timestamp].copy()
        if sub.empty:
            sub = self.df_feat[self.df_feat["timestamp"] == self.default_timestamp].copy()
            timestamp = self.default_timestamp

        # Handle missing sensor timestamps gracefully: ensure all 25 corridor segments are represented
        if len(sub) < len(self.roads_dict):
            present_rids = set(sub["road_id"].unique())
            dt_curr = pd.to_datetime(timestamp)
            missing_rids = [rid for rid in self.roads_dict if rid not in present_rids]
            fill_rows = []
            for rid in missing_rids:
                road_history = self.df_feat[(self.df_feat["road_id"] == rid) & (self.df_feat["dt_idx"] <= dt_curr)]
                if not road_history.empty:
                    fill_rows.append(road_history.iloc[-1:])
                else:
                    fill_rows.append(self.df_feat[self.df_feat["road_id"] == rid].iloc[:1])
            if fill_rows:
                sub = pd.concat([sub] + fill_rows, ignore_index=True)

        # Sort deterministically by road_id NL-001 -> NL-025
        sub = sub.sort_values("road_id").reset_index(drop=True)
            
        X_raw = sub[FEATURE_COLUMNS].values
        X_scaled = self.scaler.transform(X_raw)
        
        # 1. Traffic Volume (HistGB)
        sub["pred_volume"] = np.maximum(0.0, self.vol_gb.predict(X_raw)).round().astype(int)
        
        # 2. Congestion Level (HistGB)
        cong_codes = self.cong_gb.predict(X_raw)
        sub["pred_congestion"] = self.label_encoder.inverse_transform(cong_codes)
        
        # 3. Travel Time (HistGB)
        sub["pred_travel_time"] = np.maximum(0.1, self.tt_gb.predict(X_raw)).round(2)
        
        # 4. Accident Risk (Platt Calibrated Logistic Model)
        acc_logits = self.acc_base.decision_function(X_scaled).reshape(-1, 1)
        sub["pred_accident_prob"] = self.acc_platt.predict_proba(acc_logits)[:, 1]
        
        return sub

    # =========================================================================
    # ENDPOINT 1: OVERVIEW
    # =========================================================================
    def get_overview(self, ts: Optional[str] = None, date: Optional[str] = None, time_str: Optional[str] = None) -> Dict[str, Any]:
        if date and (date < "2025-01-01" or date > "2025-05-31"):
            return {
                "status": "ERROR",
                "error_type": "BAD_REQUEST",
                "message": f"Invalid date '{date}'. The Northline Corridor dataset covers January 1, 2025 to May 31, 2025."
            }
        target_ts = self.resolve_timestamp(ts, date, time_str)
        sub = self.get_corridor_inference(target_ts)
        
        avg_vol = float(sub["traffic_volume"].mean())
        avg_speed = float(sub["avg_speed"].mean())
        avg_tt = float(sub["travel_time"].mean())
        
        pred_avg_vol = float(sub["pred_volume"].mean())
        pred_avg_tt = float(sub["pred_travel_time"].mean())
        
        # Congestion distribution
        cong_counts = sub["congestion_level"].value_counts().to_dict()
        pred_cong_counts = sub["pred_congestion"].value_counts().to_dict()
        for cat in ["Free-flow", "Moderate", "Heavy", "Severe"]:
            cong_counts.setdefault(cat, 0)
            pred_cong_counts.setdefault(cat, 0)
            
        # Recent volume trend (past 6 time windows across corridor)
        curr_dt = pd.to_datetime(target_ts)
        trend_dt_start = curr_dt - pd.Timedelta(hours=3)
        trend_df = self.df_feat[(self.df_feat["dt_idx"] >= trend_dt_start) & (self.df_feat["dt_idx"] <= curr_dt)]
        vol_trend = (
            trend_df.groupby("time_str")["traffic_volume"]
            .mean()
            .round()
            .to_dict()
        )
        
        # Network condition summary
        dominant_cong = sub["pred_congestion"].mode()[0] if not sub.empty else "Moderate"
        total_veh = int(sub["traffic_volume"].sum())
        
        # Calendar & Event flags from verified dataset
        cal_holiday = bool(sub["public_holiday"].iloc[0]) if "public_holiday" in sub.columns else False
        cal_h_name = str(sub["holiday_name"].iloc[0]) if ("holiday_name" in sub.columns and pd.notna(sub["holiday_name"].iloc[0]) and str(sub["holiday_name"].iloc[0]).strip() != "") else None
        cal_event = bool(sub["event_flag"].iloc[0]) if "event_flag" in sub.columns else False
        cal_e_name = str(sub["event_name"].iloc[0]) if ("event_name" in sub.columns and pd.notna(sub["event_name"].iloc[0]) and str(sub["event_name"].iloc[0]).strip() != "") else None
        cal_roadwork = bool(sub["roadwork_flag"].iloc[0]) if "roadwork_flag" in sub.columns else False

        # Top bottlenecks ranking by V/C ratio
        sub_sorted = sub.sort_values(by="traffic_volume", ascending=False)
        top_bottlenecks = []
        for _, brow in sub_sorted.head(5).iterrows():
            top_bottlenecks.append({
                "road_id": brow["road_id"],
                "road_name": brow["road_name"],
                "current_volume": int(brow["traffic_volume"]),
                "road_capacity": int(brow["road_capacity"]),
                "vc_ratio": round(float(brow["traffic_volume"]) / max(float(brow["road_capacity"]), 1.0), 2),
                "avg_speed": round(float(brow["avg_speed"]), 1),
                "congestion_level": brow["congestion_level"],
                "pred_volume": int(brow["pred_volume"])
            })

        # Peak window classification
        sel_hour = int(target_ts.split("T")[1].split(":")[0])
        if 8 <= sel_hour <= 10:
            peak_name = "Morning Commute Surge"
            peak_time = "08:00 - 10:30"
            peak_tier = "HIGH"
        elif 17 <= sel_hour <= 20:
            peak_name = "Evening Return Rush"
            peak_time = "17:30 - 20:30"
            peak_tier = "CRITICAL"
        elif 11 <= sel_hour <= 16:
            peak_name = "Midday Arterial Flow"
            peak_time = "11:00 - 16:30"
            peak_tier = "MODERATE"
        else:
            peak_name = "Night Low-Flow Window"
            peak_time = "21:00 - 05:30"
            peak_tier = "LOW"

        return {
            "status": "SUCCESS",
            "data_provenance": "HISTORICAL_NORTHLINE_TELEMETRY (Actual) + REALTIME_MODEL_INFERENCE (Predicted)",
            "corridor_name": "Northline Corridor, Delhi",
            "total_road_segments": len(self.roads_dict),
            "selected_timestamp": target_ts,
            "selected_date": target_ts.split("T")[0],
            "selected_time": target_ts.split("T")[1][:5],
            "weather": {
                "condition": sub["weather_condition"].iloc[0] if not sub.empty else "Clear",
                "temperature_c": float(sub["temperature"].iloc[0]) if not sub.empty else 25.0,
                "rainfall_mm": float(sub["rainfall"].iloc[0]) if not sub.empty else 0.0,
                "visibility_m": float(sub["visibility"].iloc[0]) if not sub.empty else 5000.0
            },
            "calendar": {
                "public_holiday": cal_holiday,
                "holiday_name": cal_h_name,
                "event_flag": cal_event,
                "event_name": cal_e_name,
                "roadwork_flag": cal_roadwork
            },
            "peak_analysis": {
                "period_name": peak_name,
                "time_window": peak_time,
                "congestion_intensity": peak_tier,
                "hour_of_day": sel_hour
            },
            "top_bottlenecks": top_bottlenecks,
            "kpis": {
                "total_corridor_volume_veh_30m": total_veh,
                "avg_traffic_volume_veh": round(avg_vol, 1),
                "predicted_next_volume_veh": round(pred_avg_vol, 1),
                "volume_change_pct": round(((pred_avg_vol - avg_vol) / max(avg_vol, 1.0)) * 100.0, 2),
                "avg_speed_kmh": round(avg_speed, 1),
                "avg_travel_time_min": round(avg_tt, 2),
                "predicted_next_travel_time_min": round(pred_avg_tt, 2),
                "dominant_congestion_level": dominant_cong
            },
            "congestion_distribution": {
                "actual": cong_counts,
                "predicted": pred_cong_counts
            },
            "volume_trend_past_3h": vol_trend,
            "condition_summary": f"Network operating under {dominant_cong} status. Corridor vehicle flow is {total_veh:,} veh/30m with mean speed {avg_speed:.1f} km/h."
        }

    # =========================================================================
    # ENDPOINT 2: TRAFFIC FORECAST
    # =========================================================================
    def get_traffic_forecast(self, ts: Optional[str] = None, road_id: Optional[str] = None) -> Dict[str, Any]:
        target_ts = self.resolve_timestamp(ts)
        sub = self.get_corridor_inference(target_ts)
        
        if road_id:
            if road_id not in self.roads_dict:
                return {
                    "status": "ERROR",
                    "error_type": "NOT_FOUND",
                    "message": f"Road segment '{road_id}' not found. Valid road IDs: NL-001 through NL-025."
                }
            sub = sub[sub["road_id"] == road_id]
                
        # Build road-wise forecast list
        road_forecasts = []
        for _, row in sub.iterrows():
            actual_next = row.get("target_traffic_volume", np.nan)
            pred_next = float(row["pred_volume"])
            curr_v = float(row["traffic_volume"])
            
            road_forecasts.append({
                "road_id": row["road_id"],
                "road_name": row["road_name"],
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "current_volume": int(curr_v),
                "predicted_next_30m_volume": int(pred_next),
                "actual_next_30m_volume": int(actual_next) if not pd.isna(actual_next) else None,
                "forecast_delta_veh": int(pred_next - curr_v),
                "forecast_growth_pct": round(((pred_next - curr_v) / max(curr_v, 1.0)) * 100.0, 2),
                "road_capacity": int(row["road_capacity"]),
                "volume_to_capacity_ratio": round(pred_next / (row["road_capacity"] / 2.0), 3)
            })
            
        avg_pred = float(np.mean([r["predicted_next_30m_volume"] for r in road_forecasts]))
        avg_curr = float(np.mean([r["current_volume"] for r in road_forecasts]))
        
        vol_eval = self.eval_metrics.get("traffic_volume", {})
        return {
            "status": "SUCCESS",
            "model_name": "Gradient Boosting Regressor (HistGB - 150 Iterations)",
            "selected_timestamp": target_ts,
            "forecast_horizon": "+30 Minutes",
            "corridor_avg_current_volume": round(avg_curr, 1),
            "corridor_avg_predicted_volume": round(avg_pred, 1),
            "expected_growth_pct": round(((avg_pred - avg_curr) / max(avg_curr, 1.0)) * 100.0, 2),
            "road_forecasts": road_forecasts,
            "model_alternatives": {
                "HistGB (Primary)": {
                    "rmse": vol_eval.get("Gradient Boosting (HistGB)", {}).get("rmse", 58.80),
                    "r2": vol_eval.get("Gradient Boosting (HistGB)", {}).get("r2", 0.9584)
                },
                "Random Forest": {
                    "rmse": vol_eval.get("Random Forest", {}).get("rmse", 62.31),
                    "r2": vol_eval.get("Random Forest", {}).get("r2", 0.9533)
                },
                "PyTorch GRU": {
                    "rmse": vol_eval.get("PyTorch GRU Sequence Model", {}).get("rmse", 64.19),
                    "r2": vol_eval.get("PyTorch GRU Sequence Model", {}).get("r2", 0.9504)
                },
                "Linear Regression (NumPy GD)": {
                    "rmse": vol_eval.get("Linear Regression (NumPy GD)", {}).get("rmse", 108.34),
                    "r2": vol_eval.get("Linear Regression (NumPy GD)", {}).get("r2", 0.8588)
                }
            }
        }

    # =========================================================================
    # ENDPOINT 3: CONGESTION ANALYTICS
    # =========================================================================
    def get_congestion_analytics(self, ts: Optional[str] = None, road_id: Optional[str] = None) -> Dict[str, Any]:
        target_ts = self.resolve_timestamp(ts)
        sub = self.get_corridor_inference(target_ts)
        
        if road_id:
            if road_id not in self.roads_dict:
                return {
                    "status": "ERROR",
                    "error_type": "NOT_FOUND",
                    "message": f"Road segment '{road_id}' not found. Valid road IDs: NL-001 through NL-025."
                }
            sub = sub[sub["road_id"] == road_id]
                
        road_status = []
        for _, row in sub.iterrows():
            vc = round(row["traffic_volume"] / (row["road_capacity"] / 2.0), 3)
            road_status.append({
                "road_id": row["road_id"],
                "road_name": row["road_name"],
                "current_congestion": row["congestion_level"],
                "predicted_next_congestion": row["pred_congestion"],
                "actual_next_congestion": row.get("target_congestion_level", "Unknown"),
                "vc_ratio": vc,
                "avg_speed_kmh": float(row["avg_speed"]),
                "occupancy_pct": float(row["occupancy"])
            })
            
        pred_dist = sub["pred_congestion"].value_counts().to_dict()
        actual_dist = sub["congestion_level"].value_counts().to_dict()
        for cat in ["Free-flow", "Moderate", "Heavy", "Severe"]:
            pred_dist.setdefault(cat, 0)
            actual_dist.setdefault(cat, 0)
            
        return {
            "status": "SUCCESS",
            "model_name": "Gradient Boosting Classifier (HistGB - 4 Classes)",
            "selected_timestamp": target_ts,
            "forecast_horizon": "+30 Minutes",
            "distribution_summary": {
                "predicted_distribution": pred_dist,
                "current_distribution": actual_dist
            },
            "road_congestion_status": road_status,
            "congestion_thresholds": {
                "Free-flow": "V/C < 0.50 (Unimpeded traffic speed)",
                "Moderate": "0.50 <= V/C < 0.80 (Stable flow, light friction)",
                "Heavy": "0.80 <= V/C < 1.00 (Unstable flow, significant queuing)",
                "Severe": "V/C >= 1.00 (Breakdown, gridlock conditions)"
            }
        }

    # =========================================================================
    # ENDPOINT 4: TRAVEL TIME PREDICTION
    # =========================================================================
    def get_travel_time(self, ts: Optional[str] = None, road_id: Optional[str] = None) -> Dict[str, Any]:
        target_ts = self.resolve_timestamp(ts)
        sub = self.get_corridor_inference(target_ts)
        
        if road_id:
            if road_id not in self.roads_dict:
                return {
                    "status": "ERROR",
                    "error_type": "NOT_FOUND",
                    "message": f"Road segment '{road_id}' not found. Valid road IDs: NL-001 through NL-025."
                }
            sub = sub[sub["road_id"] == road_id]
                
        road_tt = []
        for _, row in sub.iterrows():
            actual_next = row.get("target_travel_time", np.nan)
            pred_tt = float(row["pred_travel_time"])
            curr_tt = float(row["travel_time"])
            
            road_tt.append({
                "road_id": row["road_id"],
                "road_name": row["road_name"],
                "current_travel_time_min": curr_tt,
                "predicted_next_travel_time_min": pred_tt,
                "actual_next_travel_time_min": round(float(actual_next), 2) if not pd.isna(actual_next) else None,
                "travel_time_delay_min": round(pred_tt - curr_tt, 2),
                "avg_speed_kmh": float(row["avg_speed"])
            })
            
        avg_curr_tt = float(np.mean([r["current_travel_time_min"] for r in road_tt]))
        avg_pred_tt = float(np.mean([r["predicted_next_travel_time_min"] for r in road_tt]))
        
        return {
            "status": "SUCCESS",
            "model_name": "Gradient Boosting Regressor (HistGB - Travel Time)",
            "selected_timestamp": target_ts,
            "forecast_horizon": "+30 Minutes",
            "corridor_avg_current_travel_time": round(avg_curr_tt, 2),
            "corridor_avg_predicted_travel_time": round(avg_pred_tt, 2),
            "road_travel_times": road_tt
        }

    # =========================================================================
    # ENDPOINT 5: ACCIDENT RISK ANALYTICS (CALIBRATED & EXPERIMENTAL)
    # =========================================================================
    def get_accident_risk(self, ts: Optional[str] = None, threshold: float = 0.010, road_id: Optional[str] = None) -> Dict[str, Any]:
        target_ts = self.resolve_timestamp(ts)
        sub = self.get_corridor_inference(target_ts)
        
        if road_id:
            if road_id not in self.roads_dict:
                return {
                    "status": "ERROR",
                    "error_type": "NOT_FOUND",
                    "message": f"Road segment '{road_id}' not found. Valid road IDs: NL-001 through NL-025."
                }
            sub = sub[sub["road_id"] == road_id]
                
        road_risks = []
        for _, row in sub.iterrows():
            prob = float(row["pred_accident_prob"])
            prob_pct = round(prob * 100.0, 2)
            
            if prob < 0.010:
                level = "Low"
            elif prob < 0.020:
                level = "Elevated"
            else:
                level = "High Friction"
                
            road_risks.append({
                "road_id": row["road_id"],
                "road_name": row["road_name"],
                "calibrated_accident_probability": round(prob, 4),
                "calibrated_probability_pct": prob_pct,
                "risk_classification": level,
                "exceeds_operational_threshold": bool(prob >= threshold),
                "actual_next_incident_count": int(row.get("target_accident_count", 0)),
                "contributing_factors": {
                    "occupancy_pct": float(row["occupancy"]),
                    "speed_kmh": float(row["avg_speed"]),
                    "speed_change": float(row["speed_change"]),
                    "rainfall_mm": float(row["rainfall"])
                }
            })
            
        mean_prob = float(np.mean([r["calibrated_accident_probability"] for r in road_risks]))
        elevated_count = int(np.sum([r["exceeds_operational_threshold"] for r in road_risks]))
        
        return {
            "status": "SUCCESS",
            "model_name": "Logistic Regression with Validation Platt Scaling",
            "selected_timestamp": target_ts,
            "forecast_horizon": "+30 Minutes",
            "experimental_disclaimer": ACCIDENT_DISCLAIMER,
            "operational_threshold_active": threshold,
            "corridor_mean_calibrated_probability_pct": round(mean_prob * 100.0, 2),
            "roads_exceeding_threshold_count": elevated_count,
            "threshold_performance_guide": {
                "0.005 (0.5%)": {"catch_rate_recall": "100.0%", "specificity": "0.13%", "precision": "0.97%"},
                "0.010 (1.0% RECOMMENDED)": {"catch_rate_recall": "46.18%", "specificity": "75.68%", "precision": "1.82%"},
                "0.015 (1.5%)": {"catch_rate_recall": "24.10%", "specificity": "90.75%", "precision": "2.47%"},
                "0.020 (2.0%)": {"catch_rate_recall": "11.24%", "specificity": "96.55%", "precision": "3.08%"}
            },
            "warning": "EXPERIMENTAL PROTOTYPE ONLY: Low precision (1.82%) and high false alarms (~98%) preclude operational safety dispatch.",
            "road_risk_evaluations": road_risks
        }

    # =========================================================================
    # ENDPOINT 6: ROADS REGISTRY
    # =========================================================================
    def get_roads(self, ts: Optional[str] = None) -> Dict[str, Any]:
        target_ts = self.resolve_timestamp(ts)
        sub = self.get_corridor_inference(target_ts)
        
        roads_list = []
        for _, row in sub.iterrows():
            roads_list.append({
                "road_id": row["road_id"],
                "road_name": row["road_name"],
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "weather_station_id": row["weather_station_id"],
                "road_capacity": int(row["road_capacity"]),
                "signal_timing": int(row["signal_timing"]),
                "current_volume": int(row["traffic_volume"]),
                "current_speed": float(row["avg_speed"]),
                "current_occupancy": float(row["occupancy"]),
                "current_congestion": row["congestion_level"],
                "predicted_next_volume": int(row["pred_volume"]),
                "predicted_next_congestion": row["pred_congestion"],
                "predicted_next_travel_time": float(row["pred_travel_time"]),
                "calibrated_accident_probability": round(float(row["pred_accident_prob"]), 4)
            })
            
        return {
            "status": "SUCCESS",
            "corridor": "Northline Corridor, Delhi",
            "total_roads": len(roads_list),
            "timestamp": target_ts,
            "center_coords": [28.635, 77.205],
            "roads": roads_list
        }

    # =========================================================================
    # ENDPOINT 7: MODEL PERFORMANCE STUDIO
    # =========================================================================
    def get_model_performance(self) -> Dict[str, Any]:
        vol_gb = self.eval_metrics.get("traffic_volume", {}).get("Gradient Boosting (HistGB)", {})
        cong_gb = self.eval_metrics.get("congestion", {}).get("Gradient Boosting (HistGB)", {})
        gru = self.eval_metrics.get("traffic_volume", {}).get("PyTorch GRU Sequence Model", {})
        return {
            "status": "SUCCESS",
            "corridor": "Northline Corridor, Delhi",
            "evaluation_split": "70% Train, 15% Validation, 15% Test (Holdout Test Window: 9 May – 31 May 2025)",
            "metrics": self.eval_metrics,
            "confusion_matrices": self.confusion_matrices,
            "feature_importance": self.feature_importances,
            "key_takeaways": [
                f"Gradient Boosting Regressor (HistGB) achieved top volume forecasting accuracy (RMSE: {vol_gb.get('rmse', 58.80):.2f} veh, R²: {vol_gb.get('r2', 0.9584):.4f}).",
                f"Gradient Boosting Classifier achieved {cong_gb.get('accuracy', 0.8711)*100:.2f}% 4-class congestion classification accuracy (Macro-F1: {cong_gb.get('f1_macro', 0.7574):.4f}).",
                f"PyTorch GRU deep recurrent model trained end-to-end, achieving {gru.get('rmse', 64.19):.2f} veh RMSE (R²: {gru.get('r2', 0.9504):.4f}).",
                "Platt-calibrated Logistic Regression restored genuine probability calibration (Brier score: 0.00952, beating prevalence baseline 0.00971)."
            ]
        }

    # =========================================================================
    # ENDPOINT 8: HISTORICAL DATA EXPLORER
    # =========================================================================
    def get_historical(
        self,
        date: Optional[str] = None,
        time_str: Optional[str] = None,
        road_id: Optional[str] = None,
        limit: int = 50
    ) -> Dict[str, Any]:
        df = self.df_feat.copy()
        
        # Enforce date bounds 2025-01-01 to 2025-05-31
        if date:
            if date < "2025-01-01" or date > "2025-05-31":
                return {
                    "status": "ERROR",
                    "error_type": "BAD_REQUEST",
                    "message": f"Invalid date '{date}'. The Northline Corridor dataset covers January 1, 2025 to May 31, 2025."
                }
            df = df[df["date_str"] == date]
            
        if time_str:
            df = df[df["time_str"] == time_str]
            
        if road_id:
            if road_id not in self.roads_dict:
                return {
                    "status": "ERROR",
                    "error_type": "NOT_FOUND",
                    "message": f"Road segment '{road_id}' not found. Valid road IDs: NL-001 through NL-025."
                }
            df = df[df["road_id"] == road_id]
            
        total_matching = len(df)
        records_subset = df.head(limit)
        
        # Format records for table view
        formatted_records = []
        for _, r in records_subset.iterrows():
            formatted_records.append({
                "timestamp": r["timestamp"],
                "date": r["date_str"],
                "time": r["time_str"],
                "road_id": r["road_id"],
                "road_name": r["road_name"],
                "traffic_volume": int(r["traffic_volume"]),
                "target_next_volume": int(r["target_traffic_volume"]) if not pd.isna(r["target_traffic_volume"]) else None,
                "avg_speed": float(r["avg_speed"]),
                "occupancy": float(r["occupancy"]),
                "congestion_level": r["congestion_level"],
                "target_next_congestion": r["target_congestion_level"] if not pd.isna(r["target_congestion_level"]) else None,
                "travel_time": float(r["travel_time"]),
                "target_next_travel_time": float(r["target_travel_time"]) if not pd.isna(r["target_travel_time"]) else None,
                "accident_count": int(r["accident_count"]),
                "weather_condition": r["weather_condition"],
                "temperature": float(r["temperature"]),
                "rainfall": float(r["rainfall"])
            })
            
        return {
            "status": "SUCCESS",
            "coverage_dates": {"min": "2025-01-01", "max": "2025-05-31"},
            "total_matching_records": total_matching,
            "returned_count": len(formatted_records),
            "records": formatted_records
        }

# Global singleton accessor
def get_service():
    return NorthlineInferenceService.get_instance()
