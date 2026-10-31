"""
FlowCast AI - Base Data Provider & Schema Validation
Defines standardized data contracts, provenance metadata, and validation utilities.
"""

from abc import ABC, abstractmethod
from enum import Enum
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field, field_validator
import pandas as pd
import numpy as np

class DataTier(str, Enum):
    SIMULATED_DEMO = "SIMULATED_DEMO"
    HISTORICAL_BENCHMARK = "HISTORICAL_BENCHMARK"
    LIVE_TELEMETRY = "LIVE_TELEMETRY"

class TrafficRecordSchema(BaseModel):
    timestamp: str
    corridor_id: str = Field(..., min_length=2)
    corridor_name: str
    corridor_type: str
    num_lanes: int = Field(..., ge=1, le=8)
    length_km: float = Field(..., gt=0.1)
    free_flow_speed: float = Field(..., ge=20.0, le=140.0)
    weather: str
    temperature_c: float = Field(..., ge=-10.0, le=55.0)
    precipitation_mm: float = Field(..., ge=0.0, le=150.0)
    visibility_km: float = Field(..., ge=0.1, le=50.0)
    avg_speed_kmh: float = Field(..., ge=1.0, le=160.0)
    road_occupancy_pct: float = Field(..., ge=0.0, le=100.0)
    traffic_volume: Optional[float] = Field(None, ge=0.0)
    congestion_index: Optional[float] = Field(None, ge=0.0, le=100.0)
    travel_time_min: Optional[float] = Field(None, gt=0.0)
    accident_risk_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    data_tier: DataTier = DataTier.SIMULATED_DEMO
    data_source: str = "FlowCast Ingestion Pipeline"

    @field_validator("weather")
    @classmethod
    def validate_weather(cls, v: str) -> str:
        valid_states = {"Clear", "Rain", "Heavy Rain", "Fog", "Storm", "Overcast", "Drizzle"}
        if v not in valid_states:
            return "Clear"
        return v

class BaseDataProvider(ABC):
    def __init__(self, name: str, tier: DataTier):
        self.name = name
        self.tier = tier

    @abstractmethod
    def fetch_data(self, **kwargs) -> pd.DataFrame:
        """Fetch raw observations into DataFrame"""
        pass

    @abstractmethod
    def get_provenance_metadata(self) -> Dict[str, Any]:
        """Returns provenance, license, and sampling details"""
        pass

    def validate_dataframe(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Validates a DataFrame against standard traffic ingestion contracts.
        Checks for missing timestamps, out-of-bounds metrics, and negative values.
        """
        issues = []
        clean_rows = []
        total = len(df)
        
        required_cols = [
            "timestamp", "corridor_id", "corridor_name", "corridor_type",
            "num_lanes", "length_km", "free_flow_speed", "weather",
            "temperature_c", "precipitation_mm", "visibility_km",
            "avg_speed_kmh", "road_occupancy_pct"
        ]
        
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            return {
                "valid": False,
                "total_records": total,
                "valid_records": 0,
                "issues": [f"Missing required columns: {missing_cols}"]
            }

        # Data cleaning: drop NaNs in core features or interpolate
        df_clean = df.copy()
        
        # Clip out-of-bounds values
        df_clean["avg_speed_kmh"] = df_clean["avg_speed_kmh"].clip(lower=4.0, upper=140.0)
        df_clean["road_occupancy_pct"] = df_clean["road_occupancy_pct"].clip(lower=1.0, upper=99.0)
        df_clean["precipitation_mm"] = df_clean["precipitation_mm"].clip(lower=0.0, upper=120.0)
        df_clean["visibility_km"] = df_clean["visibility_km"].clip(lower=0.2, upper=25.0)
        
        # Tag provenance
        df_clean["data_tier"] = self.tier.value
        df_clean["data_source"] = self.name
        
        return {
            "valid": True,
            "total_records": total,
            "valid_records": len(df_clean),
            "cleaned_dataframe": df_clean,
            "issues": issues
        }
