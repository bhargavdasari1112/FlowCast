/**
 * FlowCast AI - Stage 3 API Client
 * Interfaces with FastAPI backend for the Northline Corridor (Delhi) dataset:
 * Endpoints:
 *   1. /api/overview
 *   2. /api/traffic/forecast
 *   3. /api/congestion
 *   4. /api/travel-time
 *   5. /api/accident-risk
 *   6. /api/roads
 *   7. /api/model-performance
 *   8. /api/historical
 *   + /api/health
 */

const API = {
  baseUrl: window.location.origin.includes("http") ? "" : "http://127.0.0.1:8000",

  async getHealth() {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error("Health check failed:", err);
      return { status: "offline", error: err.message };
    }
  },

  async getOverview(params = {}) {
    const qs = new URLSearchParams();
    if (params.timestamp) qs.append("timestamp", params.timestamp);
    if (params.date) qs.append("date", params.date);
    if (params.time) qs.append("time", params.time);
    
    const url = `${this.baseUrl}/api/overview${qs.toString() ? '?' + qs.toString() : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch overview`);
    return await res.json();
  },

  async getTrafficForecast(params = {}) {
    const qs = new URLSearchParams();
    if (params.timestamp) qs.append("timestamp", params.timestamp);
    if (params.road_id) qs.append("road_id", params.road_id);

    const url = `${this.baseUrl}/api/traffic/forecast${qs.toString() ? '?' + qs.toString() : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch traffic forecast`);
    return await res.json();
  },

  async getCongestion(params = {}) {
    const qs = new URLSearchParams();
    if (params.timestamp) qs.append("timestamp", params.timestamp);
    if (params.road_id) qs.append("road_id", params.road_id);

    const url = `${this.baseUrl}/api/congestion${qs.toString() ? '?' + qs.toString() : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch congestion analytics`);
    return await res.json();
  },

  async getTravelTime(params = {}) {
    const qs = new URLSearchParams();
    if (params.timestamp) qs.append("timestamp", params.timestamp);
    if (params.road_id) qs.append("road_id", params.road_id);

    const url = `${this.baseUrl}/api/travel-time${qs.toString() ? '?' + qs.toString() : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch travel time`);
    return await res.json();
  },

  async getAccidentRisk(params = {}) {
    const qs = new URLSearchParams();
    if (params.timestamp) qs.append("timestamp", params.timestamp);
    if (params.threshold !== undefined) qs.append("threshold", params.threshold);
    if (params.road_id) qs.append("road_id", params.road_id);

    const url = `${this.baseUrl}/api/accident-risk${qs.toString() ? '?' + qs.toString() : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch accident risk`);
    return await res.json();
  },

  async getRoads(params = {}) {
    const qs = new URLSearchParams();
    if (params.timestamp) qs.append("timestamp", params.timestamp);

    const url = `${this.baseUrl}/api/roads${qs.toString() ? '?' + qs.toString() : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch roads`);
    return await res.json();
  },

  async getModelPerformance() {
    const url = `${this.baseUrl}/api/model-performance`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch model performance`);
    return await res.json();
  },

  async getHistorical(params = {}) {
    const qs = new URLSearchParams();
    if (params.date) qs.append("date", params.date);
    if (params.time) qs.append("time", params.time);
    if (params.road_id) qs.append("road_id", params.road_id);
    if (params.limit) qs.append("limit", params.limit);

    const url = `${this.baseUrl}/api/historical${qs.toString() ? '?' + qs.toString() : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch historical data`);
    return await res.json();
  }
};
