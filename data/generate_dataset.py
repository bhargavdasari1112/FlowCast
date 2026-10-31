"""
FlowCast AI - Traffic Analytics Platform
Synthetic Realistic Dataset Generator
Generates multi-sensor corridor traffic, weather, and calendar data over 90 days.
"""

import os
import json
import numpy as np
import pandas as pd

# Define 12 major city corridors with structural attributes
CORRIDORS = [
    {
        "id": "C01",
        "name": "Metro Expressway East",
        "type": "Highway",
        "lanes": 4,
        "free_flow_speed": 100.0,
        "length_km": 14.5,
        "capacity_per_lane": 1800,
        "base_accident_factor": 0.08,
        "coords": [[12.9716, 77.5946], [12.9850, 77.6350], [13.0020, 77.6780]],
        "junction_risk": 0.15
    },
    {
        "id": "C02",
        "name": "Metro Expressway West",
        "type": "Highway",
        "lanes": 4,
        "free_flow_speed": 100.0,
        "length_km": 14.5,
        "capacity_per_lane": 1800,
        "base_accident_factor": 0.08,
        "coords": [[12.9716, 77.5946], [12.9550, 77.5450], [12.9320, 77.4980]],
        "junction_risk": 0.14
    },
    {
        "id": "C03",
        "name": "Downtown Core Arterial",
        "type": "Urban Arterial",
        "lanes": 3,
        "free_flow_speed": 50.0,
        "length_km": 6.2,
        "capacity_per_lane": 1100,
        "base_accident_factor": 0.14,
        "coords": [[12.9716, 77.5946], [12.9790, 77.6020], [12.9860, 77.6100]],
        "junction_risk": 0.35
    },
    {
        "id": "C04",
        "name": "Financial District Bypass",
        "type": "Urban Arterial",
        "lanes": 3,
        "free_flow_speed": 60.0,
        "length_km": 8.0,
        "capacity_per_lane": 1250,
        "base_accident_factor": 0.11,
        "coords": [[12.9620, 77.5900], [12.9680, 77.6150], [12.9740, 77.6320]],
        "junction_risk": 0.22
    },
    {
        "id": "C05",
        "name": "Airport Link Expressway",
        "type": "Expressway",
        "lanes": 3,
        "free_flow_speed": 90.0,
        "length_km": 18.2,
        "capacity_per_lane": 1600,
        "base_accident_factor": 0.09,
        "coords": [[13.0020, 77.6780], [13.0800, 77.6950], [13.1980, 77.7060]],
        "junction_risk": 0.12
    },
    {
        "id": "C06",
        "name": "Tech Corridor Boulevard",
        "type": "Major Arterial",
        "lanes": 3,
        "free_flow_speed": 70.0,
        "length_km": 11.4,
        "capacity_per_lane": 1350,
        "base_accident_factor": 0.12,
        "coords": [[12.9320, 77.6850], [12.9150, 77.6650], [12.8980, 77.6450]],
        "junction_risk": 0.28
    },
    {
        "id": "C07",
        "name": "Harbor Bridge Crossing",
        "type": "Bridge Chokepoint",
        "lanes": 2,
        "free_flow_speed": 60.0,
        "length_km": 4.8,
        "capacity_per_lane": 1050,
        "base_accident_factor": 0.18,
        "coords": [[12.9550, 77.6250], [12.9580, 77.6400], [12.9620, 77.6550]],
        "junction_risk": 0.42
    },
    {
        "id": "C08",
        "name": "Riverside Parkway",
        "type": "Scenic Arterial",
        "lanes": 2,
        "free_flow_speed": 60.0,
        "length_km": 9.5,
        "capacity_per_lane": 1100,
        "base_accident_factor": 0.10,
        "coords": [[12.9450, 77.5850], [12.9600, 77.5750], [12.9800, 77.5680]],
        "junction_risk": 0.18
    },
    {
        "id": "C09",
        "name": "North Ring Orbital",
        "type": "Orbital Highway",
        "lanes": 4,
        "free_flow_speed": 100.0,
        "length_km": 22.0,
        "capacity_per_lane": 1750,
        "base_accident_factor": 0.07,
        "coords": [[13.0100, 77.5500], [13.0350, 77.6000], [13.0450, 77.6600]],
        "junction_risk": 0.16
    },
    {
        "id": "C10",
        "name": "University Avenue",
        "type": "City Collector",
        "lanes": 2,
        "free_flow_speed": 45.0,
        "length_km": 5.3,
        "capacity_per_lane": 950,
        "base_accident_factor": 0.15,
        "coords": [[12.9400, 77.5600], [12.9520, 77.5700], [12.9650, 77.5800]],
        "junction_risk": 0.32
    },
    {
        "id": "C11",
        "name": "Commercial Shopping Hub",
        "type": "Urban Collector",
        "lanes": 2,
        "free_flow_speed": 40.0,
        "length_km": 3.8,
        "capacity_per_lane": 900,
        "base_accident_factor": 0.16,
        "coords": [[12.9750, 77.6050], [12.9820, 77.6120], [12.9890, 77.6200]],
        "junction_risk": 0.38
    },
    {
        "id": "C12",
        "name": "Industrial Freight Corridor",
        "type": "Freight Arterial",
        "lanes": 3,
        "free_flow_speed": 70.0,
        "length_km": 12.6,
        "capacity_per_lane": 1400,
        "base_accident_factor": 0.13,
        "coords": [[12.9100, 77.5200], [12.9250, 77.5000], [12.9450, 77.4800]],
        "junction_risk": 0.25
    }
]

def generate_traffic_dataset(num_days=60, seed=42):
    np.random.seed(seed)
    
    # 60 days * 24 hours = 1,440 hours * 12 corridors = 17,280 samples
    dates = pd.date_range(start="2026-08-01", periods=num_days * 24, freq="h")
    
    records = []
    
    # Pre-generate weather series to have temporal continuity across hours
    weather_states = ["Clear", "Rain", "Heavy Rain", "Fog", "Storm"]
    weather_probs = [0.65, 0.20, 0.07, 0.05, 0.03]
    
    current_weather = "Clear"
    weather_timeline = []
    
    for i in range(len(dates)):
        # Weather Markov transition: 85% stay same, 15% switch
        if np.random.rand() > 0.85:
            current_weather = np.random.choice(weather_states, p=weather_probs)
        
        hour = dates[i].hour
        # Diurnal temperature cycle: coolest at 5 AM, warmest at 2 PM
        temp = 24.0 + 7.0 * np.sin((hour - 8) * np.pi / 12) + np.random.normal(0, 1.5)
        
        if current_weather == "Clear":
            precip = 0.0
            vis = np.clip(10.0 + np.random.normal(0, 1.5), 6.0, 15.0)
            wind = np.clip(8.0 + np.random.normal(0, 3.0), 2.0, 25.0)
            surface = "Dry"
        elif current_weather == "Rain":
            precip = np.clip(np.random.exponential(4.0), 1.0, 12.0)
            vis = np.clip(5.0 + np.random.normal(0, 1.0), 2.5, 8.0)
            wind = np.clip(18.0 + np.random.normal(0, 5.0), 8.0, 35.0)
            surface = "Wet"
        elif current_weather == "Heavy Rain":
            precip = np.clip(np.random.exponential(12.0) + 10.0, 12.0, 45.0)
            vis = np.clip(2.0 + np.random.normal(0, 0.6), 0.8, 3.5)
            wind = np.clip(32.0 + np.random.normal(0, 8.0), 18.0, 55.0)
            surface = "Standing Water"
        elif current_weather == "Fog":
            precip = 0.2
            vis = np.clip(0.8 + np.random.normal(0, 0.3), 0.3, 1.8)
            wind = np.clip(4.0 + np.random.normal(0, 2.0), 1.0, 10.0)
            surface = "Damp"
        else: # Storm
            precip = np.clip(np.random.exponential(20.0) + 20.0, 22.0, 65.0)
            vis = np.clip(1.0 + np.random.normal(0, 0.4), 0.4, 2.2)
            wind = np.clip(45.0 + np.random.normal(0, 10.0), 28.0, 75.0)
            surface = "Flooded"
            
        weather_timeline.append({
            "weather": current_weather,
            "temp": round(float(temp), 1),
            "precip": round(float(precip), 1),
            "vis": round(float(vis), 2),
            "wind": round(float(wind), 1),
            "surface": surface
        })

    for d_idx, dt in enumerate(dates):
        hour = dt.hour
        dow = dt.dayofweek # 0=Monday, 6=Sunday
        is_weekend = int(dow >= 5)
        # Indian/Global holidays in Aug-Oct (e.g. Independence Day, Labor Day, Gandhi Jayanti)
        is_holiday = int((dt.month == 8 and dt.day == 15) or (dt.month == 10 and dt.day == 2))
        
        # Rush hour flags: Morning 7:30-10:00 (hours 7, 8, 9), Evening 16:30-19:30 (hours 16, 17, 18, 19)
        is_morning_rush = int((not is_weekend) and (7 <= hour <= 9))
        is_evening_rush = int((not is_weekend) and (16 <= hour <= 19))
        is_rush_hour = int(is_morning_rush or is_evening_rush)
        
        # Special events (e.g. stadium match or concerts on Friday/Saturday nights on C01, C06, C11)
        special_event = int((dow in [4, 5]) and (18 <= hour <= 22) and (d_idx % 7 == 0))
        
        w = weather_timeline[d_idx]
        
        for c in CORRIDORS:
            total_capacity = c["lanes"] * c["capacity_per_lane"]
            
            # Base diurnal curve
            if not is_weekend:
                # Commuter profile: twin peaks at 8 AM and 18 PM
                curve = (
                    0.15
                    + 0.65 * np.exp(-((hour - 8.2) ** 2) / 3.5)
                    + 0.75 * np.exp(-((hour - 17.8) ** 2) / 4.2)
                    + 0.35 * np.exp(-((hour - 13.0) ** 2) / 8.0)
                )
            else:
                # Weekend profile: gradual rise peaking mid-afternoon 13:00 - 20:00
                curve = (
                    0.12
                    + 0.70 * np.exp(-((hour - 14.5) ** 2) / 16.0)
                    + 0.65 * np.exp(-((hour - 19.0) ** 2) / 8.0)
                )
                
            # Corridor specific demand adjustments
            corridor_demand_scale = 1.0
            if c["id"] in ["C01", "C02", "C09"]: # Major expressways
                corridor_demand_scale = 1.15
            elif c["id"] in ["C03", "C04"]: # Downtown
                corridor_demand_scale = 1.05 if not is_weekend else 0.75
            elif c["id"] == "C11": # Shopping
                corridor_demand_scale = 1.35 if is_weekend else 0.85
            elif c["id"] == "C12": # Freight
                corridor_demand_scale = 1.2 if hour in [22, 23, 0, 1, 2, 3, 4] else 0.8
                
            if special_event and c["id"] in ["C01", "C06", "C11"]:
                corridor_demand_scale *= 1.45
                
            # Weather impact on demand: heavy rain or storm slightly reduces total vehicle trips
            if w["weather"] in ["Heavy Rain", "Storm"]:
                corridor_demand_scale *= 0.88
                
            expected_volume = total_capacity * curve * corridor_demand_scale * 0.72
            # Add stochastic sensor noise (Poisson-like)
            volume = np.random.normal(expected_volume, expected_volume * 0.06)
            volume = max(120, min(int(volume), int(total_capacity * 1.15)))
            
            # Traffic Physics: Greenshields / Newell-Daganzo model for speed & density
            # volume-to-capacity ratio (v/c)
            v_c_ratio = volume / total_capacity
            
            # Weather penalty on free flow speed: rain reduces traction & visibility
            weather_speed_penalty = 1.0
            if w["weather"] == "Rain":
                weather_speed_penalty = 0.88
            elif w["weather"] == "Heavy Rain":
                weather_speed_penalty = 0.75
            elif w["weather"] == "Fog":
                weather_speed_penalty = 0.78
            elif w["weather"] == "Storm":
                weather_speed_penalty = 0.62
                
            eff_free_flow = c["free_flow_speed"] * weather_speed_penalty
            
            # Non-linear speed degradation as v/c approaches and exceeds 0.75 (breakdown)
            if v_c_ratio < 0.65:
                speed_ratio = 1.0 - 0.22 * (v_c_ratio / 0.65) ** 1.8
            elif v_c_ratio < 0.95:
                speed_ratio = 0.78 - 0.40 * ((v_c_ratio - 0.65) / 0.30) ** 1.4
            else: # Gridlock / severe congestion shockwave
                speed_ratio = 0.38 - 0.26 * min(1.0, (v_c_ratio - 0.95) / 0.20)
                
            avg_speed = eff_free_flow * max(0.12, speed_ratio) + np.random.normal(0, 2.0)
            avg_speed = round(float(np.clip(avg_speed, 8.0, c["free_flow_speed"])), 1)
            
            # Road occupancy percentage (loop detector metric)
            # High occupancy indicates bumper-to-bumper queue
            occupancy = np.clip(
                (1.0 - (avg_speed / c["free_flow_speed"])) * 85.0 + (v_c_ratio * 25.0) + np.random.normal(0, 3.0),
                4.0,
                98.0
            )
            occupancy = round(float(occupancy), 1)
            
            # Speed variance between lanes (surges during erratic braking / congestion onset)
            speed_variance = round(float(np.clip(
                (c["free_flow_speed"] - avg_speed) * 0.35 + (w["precip"] * 0.4) + np.random.normal(2.5, 0.8),
                1.0,
                28.0
            )), 1)
            
            # Heavy vehicle percentage (buses, trucks)
            heavy_veh_pct = round(float(np.clip(
                (18.0 if c["type"] == "Freight Arterial" else 6.0) + (8.0 if hour < 6 else 0.0) + np.random.normal(0, 1.5),
                1.5,
                38.0
            )), 1)
            
            # Target 1: Traffic Volume (vehicles / hour) -> volume
            
            # Target 2: Congestion Index (0 to 100) & Congestion Level
            # Continuous score: 0 = completely clear, 100 = total standstill
            congestion_index = np.clip(
                ((c["free_flow_speed"] - avg_speed) / c["free_flow_speed"]) * 70.0
                + (occupancy / 100.0) * 30.0,
                0.0,
                100.0
            )
            congestion_index = round(float(congestion_index), 1)
            
            if congestion_index < 25.0:
                congestion_level = "Free Flow"
            elif congestion_index < 50.0:
                congestion_level = "Moderate"
            elif congestion_index < 75.0:
                congestion_level = "Heavy"
            else:
                congestion_level = "Gridlock"
                
            # Target 3: Travel Time (minutes)
            # Baseline traversal: (length_km / speed) * 60
            raw_travel_time = (c["length_km"] / max(avg_speed, 6.0)) * 60.0
            # Intersection queue delay penalty for urban arterials
            junction_delay = c["junction_risk"] * 12.0 * (congestion_index / 100.0) ** 1.5
            travel_time_min = round(float(raw_travel_time + junction_delay), 2)
            
            # Target 4: Accident Risk Score (0.00 to 1.00 probability) & Risk Level
            # Empirical traffic safety factors:
            # - Rain / wet surface / standing water hazard
            # - Visibility reduction
            # - High speed variance (sudden stop shockwaves)
            # - Corridor base junction risk
            # - Heavy vehicle mix
            precip_hazard = min(1.0, (w["precip"] / 25.0) ** 1.2) * 0.30
            vis_hazard = max(0.0, (5.0 - w["vis"]) / 5.0) * 0.22
            var_hazard = (speed_variance / 28.0) * 0.24
            cong_shock_hazard = (1.0 if 45 <= congestion_index <= 85 else 0.3) * 0.15 # Crash risk highest in stop-and-go onset!
            junction_hazard = c["junction_risk"] * 0.18
            base_risk = c["base_accident_factor"]
            
            raw_risk = (
                base_risk
                + precip_hazard
                + vis_hazard
                + var_hazard
                + cong_shock_hazard
                + junction_hazard
                + np.random.normal(0, 0.04)
            )
            accident_risk_score = round(float(np.clip(raw_risk, 0.02, 0.98)), 3)
            
            if accident_risk_score < 0.28:
                accident_risk_level = "Low"
            elif accident_risk_score < 0.55:
                accident_risk_level = "Medium"
            elif accident_risk_score < 0.78:
                accident_risk_level = "High"
            else:
                accident_risk_level = "Critical"
                
            records.append({
                "timestamp": dt.isoformat(),
                "hour": hour,
                "day_of_week": dow,
                "month": dt.month,
                "is_weekend": is_weekend,
                "is_holiday": is_holiday,
                "is_rush_hour": is_rush_hour,
                "is_morning_rush": is_morning_rush,
                "is_evening_rush": is_evening_rush,
                "special_event": special_event,
                "corridor_id": c["id"],
                "corridor_name": c["name"],
                "corridor_type": c["type"],
                "num_lanes": c["lanes"],
                "length_km": c["length_km"],
                "free_flow_speed": c["free_flow_speed"],
                "capacity": total_capacity,
                "junction_risk": c["junction_risk"],
                "weather": w["weather"],
                "temperature_c": w["temp"],
                "precipitation_mm": w["precip"],
                "visibility_km": w["vis"],
                "wind_speed_kmh": w["wind"],
                "road_surface": w["surface"],
                "avg_speed_kmh": avg_speed,
                "road_occupancy_pct": occupancy,
                "speed_variance": speed_variance,
                "heavy_vehicle_pct": heavy_veh_pct,
                # 4 Core Prediction Targets
                "traffic_volume": volume,
                "congestion_index": congestion_index,
                "congestion_level": congestion_level,
                "travel_time_min": travel_time_min,
                "accident_risk_score": accident_risk_score,
                "accident_risk_level": accident_risk_level
            })
            
    df = pd.DataFrame(records)
    return df

if __name__ == "__main__":
    synthetic_dir = "d:/flowcast/data/synthetic"
    os.makedirs(synthetic_dir, exist_ok=True)
    
    print("Generating FlowCast synthetic demonstration dataset (60 days across 12 corridors)...")
    print("NOTE: Original raw telemetry in data/raw/ is protected and read-only.")
    df = generate_traffic_dataset(num_days=60)
    synthetic_csv_path = os.path.join(synthetic_dir, "synthetic_traffic_dataset.csv")
    df.to_csv(synthetic_csv_path, index=False)
    print(f"Synthetic dataset generated successfully! Shape: {df.shape}")
    print(f"Saved to: {synthetic_csv_path}")
    print(f"Corridors: {df['corridor_id'].nunique()}")
    print("Sample targets summary:")
    print(df[["traffic_volume", "congestion_index", "travel_time_min", "accident_risk_score"]].describe().T)
