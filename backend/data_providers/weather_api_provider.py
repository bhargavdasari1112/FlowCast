"""
FlowCast AI - Weather API Data Provider
Integrates with Open-Meteo Weather API for real-time atmospheric data with fallback.
"""

import time
import urllib.request
import json
from typing import Dict, Any
from backend.data_providers.base_provider import BaseDataProvider, DataTier

class WeatherApiProvider(BaseDataProvider):
    def __init__(self, lat: float = 17.3850, lon: float = 78.4867, city: str = "Hyderabad"):
        super().__init__(name="Open-Meteo Weather Service", tier=DataTier.LIVE_TELEMETRY)
        self.lat = lat
        self.lon = lon
        self.city = city
        self._cached_weather: Optional[Dict[str, Any]] = None
        self._cache_time: float = 0
        self._cache_ttl: float = 600 # 10 minutes

    def _map_wmo_code(self, code: int) -> str:
        """Maps WMO Weather interpretation code to FlowCast category"""
        if code in [0, 1]: return "Clear"
        if code in [2, 3]: return "Clear" # Part cloud
        if code in [45, 48]: return "Fog"
        if code in [51, 53, 55, 61, 63]: return "Rain"
        if code in [65, 80, 81, 82]: return "Heavy Rain"
        if code in [95, 96, 99]: return "Storm"
        return "Rain" if code > 50 else "Clear"

    def fetch_current_weather(self) -> Dict[str, Any]:
        """Fetches live weather or falls back gracefully to realistic seasonal weather"""
        now = time.time()
        if self._cached_weather and (now - self._cache_time < self._cache_ttl):
            return self._cached_weather

        url = f"https://api.open-meteo.com/v1/forecast?latitude={self.lat}&longitude={self.lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m"
        
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "FlowCast-TrafficAnalytics/2.0"})
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                current = data.get("current", {})
                
                temp = float(current.get("temperature_2m", 26.5))
                precip = float(current.get("precipitation", 0.0))
                wind = float(current.get("wind_speed_10m", 12.0))
                wmo = int(current.get("weather_code", 0))
                weather_cat = self._map_wmo_code(wmo)
                
                vis = 12.0 if weather_cat == "Clear" else (5.0 if weather_cat == "Rain" else (1.2 if weather_cat == "Fog" else 2.5))
                
                result = {
                    "city": self.city,
                    "weather": weather_cat,
                    "temperature_c": round(temp, 1),
                    "precipitation_mm": round(precip, 1),
                    "visibility_km": round(vis, 1),
                    "wind_speed_kmh": round(wind, 1),
                    "wmo_code": wmo,
                    "data_tier": DataTier.LIVE_TELEMETRY.value,
                    "source": "Open-Meteo Live API",
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                }
                self._cached_weather = result
                self._cache_time = now
                return result
        except Exception:
            # Fallback to realistic seasonal Hyderabad weather (Dry/Moderate Monsoon cycle)
            fallback = {
                "city": self.city,
                "weather": "Rain",
                "temperature_c": 27.2,
                "precipitation_mm": 6.8,
                "visibility_km": 5.4,
                "wind_speed_kmh": 14.5,
                "wmo_code": 61,
                "data_tier": DataTier.SIMULATED_DEMO.value,
                "source": "Hyderabad Seasonal Fallback Generator",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }
            self._cached_weather = fallback
            self._cache_time = now
            return fallback

    def fetch_data(self, **kwargs):
        return pd.DataFrame([self.fetch_current_weather()])

    def get_provenance_metadata(self) -> Dict[str, Any]:
        return {
            "provider": "WeatherApiProvider",
            "api_endpoint": "https://api.open-meteo.com/v1/forecast",
            "license": "Creative Commons Attribution 4.0 International (CC BY 4.0)",
            "city": self.city,
            "coordinates": [self.lat, self.lon]
        }
