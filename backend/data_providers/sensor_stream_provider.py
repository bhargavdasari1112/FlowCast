"""
FlowCast AI - Sensor Telemetry Stream Provider
Simulates high-fidelity loop detector, radar, and camera feeds with health diagnostics.
"""

import time
import numpy as np
import pandas as pd
from typing import Dict, Any, List
from backend.data_providers.base_provider import BaseDataProvider, DataTier
from data.hyderabad_corridors import HYDERABAD_CORRIDORS
from data.generate_dataset import CORRIDORS as METRO_CORRIDORS

class SensorStreamProvider(BaseDataProvider):
    def __init__(self):
        super().__init__(name="FlowCast High-Fidelity Loop Detector Simulator", tier=DataTier.SIMULATED_DEMO)
        self.sensor_health: Dict[str, Dict[str, Any]] = {}
        self._init_sensor_health()

    def _init_sensor_health(self):
        all_corridors = HYDERABAD_CORRIDORS + METRO_CORRIDORS
        for c in all_corridors:
            self.sensor_health[c["id"]] = {
                "sensor_id": f"SNSR-{c['id']}",
                "status": "ONLINE" if np.random.rand() > 0.08 else "DEGRADED",
                "uptime_pct": round(98.2 + np.random.rand() * 1.7, 2),
                "packet_loss_pct": round(np.random.exponential(0.3), 2),
                "drift_error_kmh": round(np.random.normal(0, 0.6), 2),
                "last_heartbeat": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "sensor_tech": "Inductive Dual-Loop + Thermal Radar"
            }

    def get_live_telemetry(self, corridors: List[Dict[str, Any]], weather_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        now = pd.Timestamp.now()
        hour = now.hour
        dow = now.day_of_week
        is_weekend = int(dow >= 5)
        is_rush = int((not is_weekend) and (7 <= hour <= 10 or 17 <= hour <= 20))
        
        telemetry_stream = []
        for c in corridors:
            cap = c["lanes"] * c["capacity_per_lane"]
            # Rush hour factor
            is_cyber_zone = "Cyberabad" in c.get("zone", "") or "IT" in c.get("type", "")
            surge_multiplier = 1.35 if (is_rush and is_cyber_zone) else (1.15 if is_rush else 0.70)
            
            # Weather penalty
            w = weather_info.get("weather", "Clear")
            w_penalty = 0.85 if w in ["Rain", "Heavy Rain"] else (0.70 if w == "Storm" else 1.0)
            
            # Expected speed & occupancy
            base_occ = min(92.0, max(12.0, (48.0 * surge_multiplier) + (15.0 if w != "Clear" else 0.0) + np.random.normal(0, 2.5)))
            eff_speed = c["free_flow_speed"] * w_penalty * max(0.18, (1.0 - (base_occ / 100.0) ** 1.3)) + np.random.normal(0, 1.5)
            eff_speed = max(8.0, min(float(c["free_flow_speed"]), float(eff_speed)))
            
            health = self.sensor_health.get(c["id"], {
                "sensor_id": f"SNSR-{c['id']}",
                "status": "ONLINE",
                "uptime_pct": 99.1,
                "packet_loss_pct": 0.2
            })
            
            telemetry_stream.append({
                "corridor_id": c["id"],
                "name": c["name"],
                "zone": c.get("zone", "General"),
                "avg_speed_kmh": round(eff_speed, 1),
                "road_occupancy_pct": round(base_occ, 1),
                "speed_variance": round(min(25.0, max(2.0, (c["free_flow_speed"] - eff_speed) * 0.35 + np.random.normal(2.5, 0.8))), 1),
                "heavy_vehicle_pct": round(float(14.0 if "Highway" in c["type"] else 5.5), 1),
                "sensor_health": health,
                "data_tier": self.tier.value,
                "provenance_notice": "DEMONSTRATION SIMULATION - HYDERABAD SMART CITY PILOT",
                "timestamp": now.isoformat()
            })
        return telemetry_stream

    def fetch_data(self, **kwargs):
        return pd.DataFrame(self.get_live_telemetry(HYDERABAD_CORRIDORS, {"weather": "Clear"}))

    def get_provenance_metadata(self) -> Dict[str, Any]:
        return {
            "provider": "SensorStreamProvider",
            "tier": self.tier.value,
            "fidelity": "Microscopic traffic dynamics based on Greenshields & Newell-Daganzo continuum flow",
            "compliance": "Clearly tagged as DEMONSTRATION SIMULATION to preserve data integrity."
        }
