"""
FlowCast AI - Intelligent Traffic Analytics & Forecasting Engine (Stage 3 Integration)
Serving the Delhi Northline Corridor (25 Segments) using original sensor logs and validated ML models:
  - Gradient Boosting Regressor (Volume & Travel Time)
  - Gradient Boosting Classifier (Congestion Level)
  - Platt-Calibrated Logistic Regression (Accident Risk)
  - Deep Learning GRU & Model Benchmark Studio
"""

import os
import sys
import json
import time
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

# Ensure project root is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.inference_service import get_service, ACCIDENT_DISCLAIMER

app = FastAPI(
    title="FlowCast AI - Northline Corridor Traffic Analytics Engine",
    description="Professional smart-city traffic intelligence platform for Delhi Northline Corridor. Features real-time ML inference for volume forecasting, 4-class congestion classification, travel time estimation, and calibrated accident risk analysis.",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_anti_caching_headers(request, call_next):
    response = await call_next(request)
    # Strict anti-cache headers to ensure the browser always receives fresh frontend assets
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# Initialize ML Inference Engine (Singleton)
service = get_service()

# =========================================================================
# REQUIRED STAGE 3 API ENDPOINTS
# =========================================================================

@app.get("/api/overview")
def get_overview(
    timestamp: Optional[str] = Query(None, description="ISO timestamp (e.g. 2025-05-20T08:30:00)"),
    ts: Optional[str] = Query(None, description="Alias for timestamp"),
    date: Optional[str] = Query(None, description="Date filter (YYYY-MM-DD between 2025-01-01 and 2025-05-31)"),
    time: Optional[str] = Query(None, description="Time filter (HH:MM)")
):
    """
    Overview endpoint returning total road segments, current selected historical timestamp,
    average traffic volume, average speed, average congestion, and traffic distribution.
    """
    selected_ts = timestamp or ts
    res = service.get_overview(ts=selected_ts, date=date, time_str=time)
    if isinstance(res, dict) and res.get("status") == "ERROR":
        status_code = 404 if res.get("error_type") == "NOT_FOUND" else 400
        raise HTTPException(status_code=status_code, detail=res.get("message", "Error"))
    return res


@app.get("/api/traffic/forecast")
def get_traffic_forecast(
    timestamp: Optional[str] = Query(None, description="ISO timestamp"),
    ts: Optional[str] = Query(None, description="Alias for timestamp"),
    road_id: Optional[str] = Query(None, description="Filter for specific road ID (e.g. NL-001)")
):
    """
    Traffic volume forecasting endpoint returning next 30-minute volume prediction,
    actual historical traffic volume, road-wise predictions, and model name.
    """
    selected_ts = timestamp or ts
    res = service.get_traffic_forecast(ts=selected_ts, road_id=road_id)
    if isinstance(res, dict) and res.get("status") == "ERROR":
        status_code = 404 if res.get("error_type") == "NOT_FOUND" else 400
        raise HTTPException(status_code=status_code, detail=res.get("message", "Error"))
    return res


@app.get("/api/congestion")
def get_congestion(
    timestamp: Optional[str] = Query(None, description="ISO timestamp"),
    ts: Optional[str] = Query(None, description="Alias for timestamp"),
    road_id: Optional[str] = Query(None, description="Filter for specific road ID")
):
    """
    Congestion analytics endpoint returning predicted 4-class congestion,
    congestion distribution, and road-wise congestion status.
    """
    selected_ts = timestamp or ts
    res = service.get_congestion_analytics(ts=selected_ts, road_id=road_id)
    if isinstance(res, dict) and res.get("status") == "ERROR":
        status_code = 404 if res.get("error_type") == "NOT_FOUND" else 400
        raise HTTPException(status_code=status_code, detail=res.get("message", "Error"))
    return res


@app.get("/api/travel-time")
def get_travel_time(
    timestamp: Optional[str] = Query(None, description="ISO timestamp"),
    ts: Optional[str] = Query(None, description="Alias for timestamp"),
    road_id: Optional[str] = Query(None, description="Filter for specific road ID")
):
    """
    Travel time endpoint returning predicted travel time, historical travel time,
    and road-wise comparison.
    """
    selected_ts = timestamp or ts
    res = service.get_travel_time(ts=selected_ts, road_id=road_id)
    if isinstance(res, dict) and res.get("status") == "ERROR":
        status_code = 404 if res.get("error_type") == "NOT_FOUND" else 400
        raise HTTPException(status_code=status_code, detail=res.get("message", "Error"))
    return res


@app.get("/api/accident-risk")
def get_accident_risk(
    timestamp: Optional[str] = Query(None, description="ISO timestamp"),
    ts: Optional[str] = Query(None, description="Alias for timestamp"),
    threshold: float = Query(0.010, ge=0.001, le=0.100, description="Operational decision threshold (default 0.010 = 1.0%)"),
    road_id: Optional[str] = Query(None, description="Filter for specific road ID")
):
    """
    Accident risk analytics endpoint returning calibrated accident probability,
    risk classification, model limitations, and experimental disclaimer.
    """
    selected_ts = timestamp or ts
    res = service.get_accident_risk(ts=selected_ts, threshold=threshold, road_id=road_id)
    if isinstance(res, dict) and res.get("status") == "ERROR":
        status_code = 404 if res.get("error_type") == "NOT_FOUND" else 400
        raise HTTPException(status_code=status_code, detail=res.get("message", "Error"))
    return res


@app.get("/api/roads")
def get_roads(
    timestamp: Optional[str] = Query(None, description="ISO timestamp"),
    ts: Optional[str] = Query(None, description="Alias for timestamp")
):
    """
    Roads registry endpoint returning all 25 Northline road segments with
    road IDs, names, actual latitude and longitude, and traffic conditions.
    """
    selected_ts = timestamp or ts
    res = service.get_roads(ts=selected_ts)
    if isinstance(res, dict) and res.get("status") == "ERROR":
        raise HTTPException(status_code=400, detail=res.get("message", "Error"))
    return res


@app.get("/api/model-performance")
def get_model_performance():
    """
    Model performance studio endpoint returning verified evaluation metrics,
    regression/classification comparisons, accident model evaluation, and persistence baselines.
    """
    res = service.get_model_performance()
    return res


@app.get("/api/historical")
def get_historical(
    date: Optional[str] = Query(None, description="Date filter YYYY-MM-DD (2025-01-01 to 2025-05-31)"),
    time: Optional[str] = Query(None, description="Time filter HH:MM"),
    road_id: Optional[str] = Query(None, description="Filter for specific road ID"),
    limit: int = Query(50, ge=1, le=500, description="Max records to return")
):
    """
    Historical data explorer endpoint allowing date/time/road filtering
    across the verified Northline Corridor dataset (Jan 1 to May 31, 2025).
    """
    res = service.get_historical(date=date, time_str=time, road_id=road_id, limit=limit)
    if isinstance(res, dict) and res.get("status") == "ERROR":
        status_code = 404 if res.get("error_type") == "NOT_FOUND" else 400
        raise HTTPException(status_code=status_code, detail=res.get("message", "Error"))
    return res


# =========================================================================
# SYSTEM HEALTH & METADATA
# =========================================================================

@app.get("/api/health")
def get_health():
    """System health check and operational status."""
    return {
        "status": "healthy",
        "service": "FlowCast AI - Northline Corridor Traffic Intelligence Engine",
        "version": "3.0.0",
        "environment": "Delhi Northline Corridor (25 Monitored Segments)",
        "dataset": {
            "name": "Northline Corridor Sensor & Weather Dataset",
            "coverage": "2025-01-01 to 2025-05-31",
            "total_segments": 25,
            "prediction_interval": "t+30 minutes"
        },
        "loaded_models": {
            "volume_primary": "HistGradientBoostingRegressor (models/vol_gradient_boosting.joblib)",
            "congestion_primary": "HistGradientBoostingClassifier (models/cong_gradient_boosting.joblib)",
            "travel_time_primary": "HistGradientBoostingRegressor (models/tt_gradient_boosting.joblib)",
            "accident_risk_primary": "LogisticRegression + Platt Calibrator (models/acc_logistic_platt_calibrated.joblib)"
        },
        "data_provenance": "Original Northline Sensor Log (Actual) + Trained ML Inference (Predicted)",
        "experimental_disclaimer": ACCIDENT_DISCLAIMER
    }

# =========================================================================
# STATIC FRONTEND SERVING (Delhi Northline Corridor - Single Source of Truth)
# =========================================================================

frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

@app.get("/", include_in_schema=False)
def serve_index_dashboard():
    """Explicitly serves the Northline Delhi index.html with strict cache-busting headers."""
    index_file = os.path.join(frontend_dir, "index.html")
    if not os.path.exists(index_file):
        raise HTTPException(status_code=404, detail="Frontend index.html not found")
    return FileResponse(
        index_file,
        media_type="text/html",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

if os.path.exists(frontend_dir):
    css_dir = os.path.join(frontend_dir, "css")
    js_dir = os.path.join(frontend_dir, "js")
    if os.path.exists(css_dir):
        app.mount("/css", StaticFiles(directory=css_dir), name="css")
    if os.path.exists(js_dir):
        app.mount("/js", StaticFiles(directory=js_dir), name="js")
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

