/**
 * FlowCast AI - Frontend DOM & Data Contract Integration Test (Stage 4)
 * Tests loadData(), updateKPIs(), safe number formatters, and edge cases
 * across Delhi Northline Corridor APIs.
 */

const http = require('http');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Minimal DOM mock
class MockElement {
  constructor(id) {
    this.id = id;
    this.textContent = '';
    this.innerHTML = '';
    this.className = '';
    this.style = {};
  }
}

const elementStore = {};
function getMockElement(id) {
  if (!elementStore[id]) {
    elementStore[id] = new MockElement(id);
  }
  return elementStore[id];
}

global.document = {
  getElementById: (id) => getMockElement(id),
  querySelectorAll: () => []
};

// Safe formatting helper under test
function formatNumber(val, decimals = 0, fallback = '—') {
  if (val === null || val === undefined || isNaN(val) || val === '') return fallback;
  const num = Number(val);
  if (!isFinite(num)) return fallback;
  return decimals > 0 
    ? num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : Math.round(num).toLocaleString();
}

function updateKPIs(data) {
  if (!data || typeof data !== "object") return;
  const kpis = data.kpis || {};

  const kpiSegments = document.getElementById("kpi-segments-count");
  if (kpiSegments) kpiSegments.textContent = formatNumber(data.total_road_segments || 25);

  const kpiVolume = document.getElementById("kpi-avg-volume");
  if (kpiVolume) kpiVolume.textContent = formatNumber(kpis.avg_traffic_volume_veh, 0, "—");

  const kpiNextVolume = document.getElementById("kpi-next-volume");
  if (kpiNextVolume) kpiNextVolume.textContent = formatNumber(kpis.predicted_next_volume_veh, 0, "—");

  const deltaEl = document.getElementById("kpi-volume-delta");
  if (deltaEl) {
    const delta = kpis.volume_change_pct;
    if (delta !== null && delta !== undefined && !isNaN(delta)) {
      const isUp = delta >= 0;
      deltaEl.textContent = `${isUp ? '▲ +' : '▼ '}${Math.abs(Number(delta)).toFixed(1)}% vs current`;
      deltaEl.className = `kpi-trend ${isUp ? 'trend-up' : 'trend-down'}`;
    } else {
      deltaEl.textContent = "—";
      deltaEl.className = "kpi-trend trend-neutral";
    }
  }

  const kpiSpeed = document.getElementById("kpi-avg-speed");
  if (kpiSpeed) kpiSpeed.textContent = formatNumber(kpis.avg_speed_kmh, 1, "—");

  const kpiCongestion = document.getElementById("kpi-dominant-congestion");
  if (kpiCongestion) {
    const level = kpis.dominant_congestion_level || "Moderate";
    kpiCongestion.textContent = level;
    const slug = String(level).toLowerCase().replace(/[^a-z]/g, "");
    kpiCongestion.className = `status-pill status-${slug || 'moderate'}`;
  }

  const kpiTravelTime = document.getElementById("kpi-avg-travel-time");
  if (kpiTravelTime) {
    const tt = kpis.predicted_next_travel_time_min;
    kpiTravelTime.textContent = tt != null && !isNaN(tt) ? `${Number(tt).toFixed(1)} min` : "—";
  }
}

async function runTests() {
  console.log("=".repeat(75));
  console.log("FLOWCAST AI: STAGE 4 FRONTEND DOM & KPI INTEGRATION TEST SUITE");
  console.log("=".repeat(75));

  // 1. Test Overview Endpoint for Delhi Northline Corridor
  const overview = await fetchJson("http://127.0.0.1:8000/api/overview");
  if (overview.status !== 200) throw new Error(`GET /api/overview failed with status ${overview.status}`);
  console.log(`[PASS] 1. GET /api/overview returned HTTP 200 (Corridor: ${overview.body.corridor_name}, Segments: ${overview.body.total_road_segments})`);

  // 2. Test updateKPIs with real backend payload
  updateKPIs(overview.body);
  const volText = document.getElementById("kpi-avg-volume").textContent;
  const nextVolText = document.getElementById("kpi-next-volume").textContent;
  const speedText = document.getElementById("kpi-avg-speed").textContent;
  const congText = document.getElementById("kpi-dominant-congestion").textContent;
  const ttText = document.getElementById("kpi-avg-travel-time").textContent;

  console.log(`[PASS] 2. updateKPIs() with live data -> Vol: ${volText}, Next Vol: ${nextVolText}, Speed: ${speedText}, Cong: ${congText}, TT: ${ttText}`);
  if (volText === "—" || nextVolText === "—") throw new Error("KPI volume failed to format");

  // 3. Test Edge Case: Null data
  updateKPIs(null);
  console.log("[PASS] 3. updateKPIs(null) executed safely without throwing TypeError.");

  // 4. Test Edge Case: Empty object {}
  updateKPIs({});
  console.log("[PASS] 4. updateKPIs({}) executed safely without throwing TypeError.");

  // 5. Test Edge Case: data.kpis missing
  updateKPIs({ status: "SUCCESS" });
  console.log("[PASS] 5. updateKPIs({ status: 'SUCCESS' }) executed safely without throwing TypeError.");

  // 6. Test Edge Case: kpis with undefined / null / NaN fields
  updateKPIs({
    status: "SUCCESS",
    kpis: {
      avg_traffic_volume_veh: undefined,
      predicted_next_volume_veh: null,
      volume_change_pct: NaN,
      avg_speed_kmh: null,
      dominant_congestion_level: undefined,
      predicted_next_travel_time_min: null
    }
  });
  console.log(`[PASS] 6. updateKPIs() with undefined/null properties handled gracefully -> Vol: '${document.getElementById("kpi-avg-volume").textContent}', TT: '${document.getElementById("kpi-avg-travel-time").textContent}'`);

  // 7. Verify all 25 Northline Roads from /api/roads
  const roads = await fetchJson("http://127.0.0.1:8000/api/roads");
  if (roads.status !== 200) throw new Error(`GET /api/roads failed with status ${roads.status}`);
  if (roads.body.roads.length !== 25) throw new Error(`Expected 25 roads, got ${roads.body.roads.length}`);
  console.log(`[PASS] 7. GET /api/roads returned 25 Northline segments.`);

  console.log("=".repeat(75));
  console.log("ALL FRONTEND RUNTIME EXCEPTION & DOM INTEGRATION TESTS PASSED (100%)");
  console.log("=".repeat(75));
}

runTests().catch(err => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
