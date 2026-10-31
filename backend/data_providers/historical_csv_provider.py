"""
FlowCast AI - Historical CSV Data Provider
Ingests, normalizes, and validates historical traffic and benchmark datasets.
"""

import os
import pandas as pd
from typing import Dict, Any, Optional
from backend.data_providers.base_provider import BaseDataProvider, DataTier

class HistoricalCsvProvider(BaseDataProvider):
    def __init__(self, file_path: str = "d:/flowcast/data/traffic_dataset.csv", name: str = "Standard Historical Dataset"):
        super().__init__(name=name, tier=DataTier.HISTORICAL_BENCHMARK)
        self.file_path = file_path

    def fetch_data(self, **kwargs) -> pd.DataFrame:
        if not os.path.exists(self.file_path):
            raise FileNotFoundError(f"Dataset file not found: {self.file_path}")
        df = pd.read_csv(self.file_path)
        # Ensure chronological sort
        if "timestamp" in df.columns:
            df["timestamp"] = pd.to_datetime(df["timestamp"])
            df = df.sort_values("timestamp").reset_index(drop=True)
            df["timestamp"] = df["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%S")
        return df

    def import_external_csv(self, file_content: str, source_label: str) -> Dict[str, Any]:
        """
        Parses uploaded CSV text, identifies standard column mappings,
        validates constraints, and appends or returns cleaned records.
        """
        import io
        try:
            df = pd.read_csv(io.StringIO(file_content))
        except Exception as e:
            return {"success": False, "error": f"Failed to parse CSV: {str(e)}"}

        # Attempt fuzzy/standard column mapping
        col_map = {
            "time": "timestamp",
            "datetime": "timestamp",
            "date": "timestamp",
            "flow": "traffic_volume",
            "volume": "traffic_volume",
            "count": "traffic_volume",
            "speed": "avg_speed_kmh",
            "velocity": "avg_speed_kmh",
            "occupancy": "road_occupancy_pct",
            "occ": "road_occupancy_pct",
            "segment_id": "corridor_id",
            "sensor": "corridor_id",
            "road": "corridor_name"
        }
        
        rename_dict = {}
        for col in df.columns:
            lower = col.strip().lower()
            if lower in col_map:
                rename_dict[col] = col_map[lower]
        df = df.rename(columns=rename_dict)
        
        # Verify required columns
        val_result = self.validate_dataframe(df)
        val_result["source_label"] = source_label
        val_result["data_tier"] = DataTier.HISTORICAL_BENCHMARK.value
        return val_result

    def get_provenance_metadata(self) -> Dict[str, Any]:
        return {
            "provider": "HistoricalCsvProvider",
            "file_path": self.file_path,
            "data_tier": self.tier.value,
            "supports_import": True,
            "compatible_formats": ["Caltrans PeMS (vds)", "METR-LA (h5/csv)", "UK DfT Traffic Counts", "Standard FlowCast Schema"]
        }
