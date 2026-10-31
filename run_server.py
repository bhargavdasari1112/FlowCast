"""
FlowCast AI - Server Launcher
Starts the FastAPI application and serves both the REST API and the Frontend dashboard.
"""

import os
import sys
import uvicorn

if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    print("=" * 65)
    print("  FLOWCAST AI: INTELLIGENT TRAFFIC ANALYTICS PLATFORM")
    print("  Serving Dashboard & API on: http://127.0.0.1:8000")
    print("=" * 65)
    uvicorn.run("backend.app:app", host="127.0.0.1", port=8000, reload=False, log_level="info")
