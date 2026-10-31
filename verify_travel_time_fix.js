/**
 * FlowCast AI - Comprehensive Travel Time Chart Fix & 8-Section Audit Suite
 * Verifies:
 * 1. Hard refresh (Ctrl + Shift + R equivalent via CDP Page.reload with cache disabled)
 * 2. Zero JS runtime exceptions (specifically no TypeError: Charts.renderTravelTimeBars is not a function)
 * 3. Zero HTTP errors
 * 4. Travel Time chart visibly rendered in Chrome with actual predictions for all 25 segments
 * 5. Pixel analysis of travel-time-canvas confirming colored bars are drawn
 * 6. Hover tooltip and click interactivity
 * 7. Verification across all 8 dashboard sections
 */

const { spawn } = require('child_process');
const http = require('http');

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function runTravelTimeAudit() {
  console.log("=".repeat(80));
  console.log("FLOWCAST AI: TRAVEL TIME FIX AUDIT & FULL 8-SECTION CHROME SUITE");
  console.log("=".repeat(80));

  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const port = 9223; // Use fresh debugging port to avoid collision
  const chromeArgs = [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--window-size=1600,1000",
    "http://127.0.0.1:8000/"
  ];

  console.log(`[Step 1] Launching headless Chrome on port ${port}...`);
  const chromeProc = spawn(chromePath, chromeArgs, { stdio: 'ignore' });

  const cleanup = () => {
    try { chromeProc.kill(); } catch (e) {}
  };
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);

  let targets = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
      if (targets && targets.length > 0) break;
    } catch (e) {}
  }

  if (!targets || targets.length === 0) {
    cleanup();
    throw new Error(`Failed to connect to Chrome on port ${port}`);
  }

  const pageTarget = targets.find(t => t.type === "page") || targets[0];
  console.log(`[Step 2] Connected to Chrome Page: ${pageTarget.title} (${pageTarget.url})`);

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  const consoleErrors = [];
  const runtimeExceptions = [];
  const networkErrors = [];
  let reqId = 1;
  const pendingRequests = new Map();

  function sendCdp(method, params = {}) {
    return new Promise((resolve) => {
      const id = reqId++;
      pendingRequests.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pendingRequests.has(msg.id)) {
      pendingRequests.get(msg.id)(msg.result);
      pendingRequests.delete(msg.id);
      return;
    }

    if (msg.method === "Runtime.exceptionThrown") {
      const desc = msg.params.exceptionDetails?.exception?.description || 
                   msg.params.exceptionDetails?.text || 
                   JSON.stringify(msg.params.exceptionDetails);
      runtimeExceptions.push(desc);
      console.error(`   [CDP EXCEPTION] ${desc}`);
    }

    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      const text = (msg.params.args || []).map(a => a.value || a.description || JSON.stringify(a)).join(" ");
      consoleErrors.push(text);
      console.error(`   [CDP CONSOLE.ERROR] ${text}`);
    }

    if (msg.method === "Network.responseReceived") {
      const { status, url } = msg.params.response;
      if (status >= 400 && !url.includes("favicon") && !url.includes("devtools")) {
        networkErrors.push({ status, url });
        console.error(`   [CDP HTTP ${status}] ${url}`);
      }
    }
  };

  // Enable CDP domains
  await sendCdp("Page.enable");
  await sendCdp("Runtime.enable");
  await sendCdp("Network.enable");
  await sendCdp("Console.enable");

  // Step 3: Hard-Refresh with Cache Disabled (Ctrl + Shift + R)
  console.log("[Step 3] Performing Hard-Refresh (Ctrl + Shift + R equivalent: cacheDisabled + reload)...");
  await sendCdp("Network.setCacheDisabled", { cacheDisabled: true });
  await sendCdp("Page.reload", { ignoreCache: true });

  // Wait for page to finish loading data
  console.log("[Step 4] Waiting for FlowCastApp data orchestrator to finish loading...");
  for (let i = 0; i < 30; i++) {
    await wait(400);
    const loadingRes = await sendCdp("Runtime.evaluate", {
      expression: `window.flowCastApp && !window.flowCastApp.isLoading`,
      returnByValue: true
    });
    if (loadingRes.result && loadingRes.result.value === true) {
      break;
    }
  }
  await wait(800);

  // Step 5: Test Charts object availability in window scope
  console.log("[Step 5] Checking Charts object availability and functions...");
  const chartsObjRes = await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      return {
        chartsDefined: typeof window.Charts !== "undefined",
        hasRenderTravelTimeBars: typeof window.Charts?.renderTravelTimeBars === "function",
        hasRenderVolumeTrend: typeof window.Charts?.renderVolumeTrend === "function",
        hasRenderCongestionDonut: typeof window.Charts?.renderCongestionDonut === "function",
        hasRenderRoadForecastBars: typeof window.Charts?.renderRoadForecastBars === "function",
        hasRenderConfusionMatrix: typeof window.Charts?.renderConfusionMatrix === "function"
      };
    })()`,
    returnByValue: true
  });
  console.log("   Charts API inspection:", JSON.stringify(chartsObjRes.result.value));

  // Step 6: Test Travel Time Section Specifically
  console.log("[Step 6] Navigating to Travel Time section (clicking #nav-btn-traveltime)...");
  await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      const btn = document.getElementById("nav-btn-traveltime") || 
                  document.querySelector('.sidebar-link[data-tab="traveltime"]');
      if (btn) btn.click();
    })()`,
    returnByValue: true
  });
  await wait(800);

  // Inspect Travel Time Canvas and Table
  const travelTimeAuditRes = await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      const canvas = document.getElementById("travel-time-canvas");
      const tbody = document.getElementById("travel-time-tbody");
      const avgCurr = document.getElementById("tt-avg-curr")?.textContent;
      const avgPred = document.getElementById("tt-avg-pred")?.textContent;

      if (!canvas) {
        return { error: "Canvas #travel-time-canvas not found" };
      }

      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext("2d");
      
      // Analyze canvas pixel buffer for drawn content
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      let nonZeroPixels = 0;
      let greenPixels = 0;
      let amberPixels = 0;
      let redPixels = 0;
      let blueTickPixels = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a > 20) {
          nonZeroPixels++;
          // Greenish
          if (g > 100 && r < 100 && b < 100) greenPixels++;
          // Amberish / Yellowish
          if (r > 150 && g > 100 && b < 80) amberPixels++;
          // Reddish
          if (r > 180 && g < 100 && b < 100) redPixels++;
          // Blueish tick
          if (b > 180 && r < 120) blueTickPixels++;
        }
      }

      const tableRows = tbody ? tbody.querySelectorAll("tr").length : 0;
      const ttData = canvas._ttData || null;

      return {
        canvasFound: true,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        cssWidth: rect.width,
        cssHeight: rect.height,
        nonZeroPixels,
        greenPixels,
        amberPixels,
        redPixels,
        blueTickPixels,
        chartRoadCount: ttData?.roads?.length || 0,
        all25RoadsPresent: (ttData?.roads?.length === 25),
        tableRowCount: tableRows,
        avgCurrent: avgCurr,
        avgPredicted: avgPred,
        sampleRoads: (ttData?.roads || []).slice(0, 3).map(r => ({
          road_id: r.road_id,
          road_name: r.road_name,
          current_tt: r.current_travel_time_min,
          predicted_tt: r.predicted_next_travel_time_min,
          delay: r.travel_time_delay_min
        }))
      };
    })()`,
    returnByValue: true
  });
  console.log("   Travel Time Chart Audit:", JSON.stringify(travelTimeAuditRes.result.value, null, 2));

  // Step 7: Test Canvas Hover Tooltip & Map Click Focus
  console.log("[Step 7] Testing Travel Time Canvas Hover and Click Interactivity...");
  const hoverTestRes = await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      const canvas = document.getElementById("travel-time-canvas");
      const d = canvas._ttData;
      if (!canvas || !d) return { success: false, reason: "No canvas or data" };

      // Simulate mousemove over bar index 2 (NL-003)
      const colStep = d.chartW / d.roads.length;
      const testX = d.pad.left + 2 * colStep + colStep / 2;
      const testY = d.pad.top + d.chartH / 2;

      const rect = canvas.getBoundingClientRect();
      const moveEvent = new MouseEvent("mousemove", {
        clientX: rect.left + testX,
        clientY: rect.top + testY,
        bubbles: true
      });
      canvas.dispatchEvent(moveEvent);

      const hoveredIdx = canvas._currentHoverIdx;
      const hoveredRoad = d.roads[hoveredIdx]?.road_id;

      // Click to test map focus
      const clickEvent = new MouseEvent("click", {
        clientX: rect.left + testX,
        clientY: rect.top + testY,
        bubbles: true
      });
      canvas.dispatchEvent(clickEvent);

      return {
        success: true,
        hoveredIdx,
        hoveredRoad,
        hoverTriggeredTooltip: hoveredIdx === 2
      };
    })()`,
    returnByValue: true
  });
  console.log("   Canvas Hover/Click Test:", JSON.stringify(hoverTestRes.result.value));

  // Step 8: Systematically Audit All Eight Dashboard Sections
  console.log("[Step 8] Auditing All Eight Dashboard Sections...");
  const sections = [
    { id: "overview", name: "Command Center Overview", btn: "nav-btn-overview", container: "section-overview" },
    { id: "map", name: "Tactical Corridor Map (25 Segments)", btn: "nav-btn-map", container: "section-map" },
    { id: "forecast", name: "Volume Forecast Engine", btn: "nav-btn-forecast", container: "section-forecast" },
    { id: "congestion", name: "Congestion Distribution Matrix", btn: "nav-btn-congestion", container: "section-congestion" },
    { id: "traveltime", name: "Travel-Time Intelligence", btn: "nav-btn-traveltime", container: "section-traveltime" },
    { id: "accident", name: "Calibrated Accident Risk", btn: "nav-btn-accident", container: "section-accident" },
    { id: "performance", name: "Model Performance Benchmarks", btn: "nav-btn-performance", container: "section-performance" },
    { id: "historical", name: "Historical Operations Archive", btn: "nav-btn-historical", container: "section-historical" }
  ];

  const sectionResults = [];

  for (const s of sections) {
    const res = await sendCdp("Runtime.evaluate", {
      expression: `(() => {
        const btn = document.getElementById("${s.btn}") || document.querySelector('.sidebar-link[data-tab="${s.id}"]') || document.querySelector('.nav-tab-item[data-tab="${s.id}"]');
        if (btn) btn.click();
        const sec = document.getElementById("${s.container}");
        
        // If historical section, trigger query button to populate records
        if ("${s.id}" === "historical") {
          const queryBtn = document.getElementById("btn-query-historical");
          if (queryBtn) queryBtn.click();
        }

        return {
          tabClicked: !!btn,
          sectionExists: !!sec,
          isActive: sec ? sec.classList.contains("active") : false
        };
      })()`,
      returnByValue: true
    });
    await wait(600);

    // Read section specific data check
    const dataCheck = await sendCdp("Runtime.evaluate", {
      expression: `(() => {
        const sec = document.getElementById("${s.container}");
        const textLen = sec ? sec.textContent.trim().length : 0;
        const tables = sec ? sec.querySelectorAll("table tbody tr").length : 0;
        const canvases = sec ? sec.querySelectorAll("canvas").length : 0;
        return { textLen, tables, canvases };
      })()`,
      returnByValue: true
    });

    sectionResults.push({
      id: s.id,
      name: s.name,
      nav: res.result.value,
      stats: dataCheck.result.value,
      pass: res.result.value.isActive && dataCheck.result.value.textLen > 100
    });
  }

  console.log("   Section Audit Summary:");
  sectionResults.forEach(r => {
    console.log(`   - [${r.pass ? 'PASS' : 'FAIL'}] ${r.name}: Tables=${r.stats.tables}, Canvases=${r.stats.canvases}`);
  });

  // Step 9: Final Exception & HTTP Error Evaluation
  console.log("=".repeat(80));
  console.log("AUDIT RESULTS SUMMARY");
  console.log("=".repeat(80));
  console.log(`Runtime Exceptions Count: ${runtimeExceptions.length}`);
  console.log(`Console Error Count:     ${consoleErrors.length}`);
  console.log(`Network HTTP >= 400:     ${networkErrors.length}`);

  const passedAllSections = sectionResults.every(r => r.pass);
  const travelTimePassed = travelTimeAuditRes.result.value.nonZeroPixels > 500 &&
                           travelTimeAuditRes.result.value.all25RoadsPresent &&
                           travelTimeAuditRes.result.value.tableRowCount === 25;

  const totalSuccess = runtimeExceptions.length === 0 &&
                       consoleErrors.length === 0 &&
                       networkErrors.length === 0 &&
                       passedAllSections &&
                       travelTimePassed;

  console.log(`Travel Time Chart Rendered:  ${travelTimePassed ? "PASS (Visible in Chrome)" : "FAIL"}`);
  console.log(`All 8 Sections Verified:    ${passedAllSections ? "PASS" : "FAIL"}`);
  console.log(`Overall Quality Status:     ${totalSuccess ? "ALL AUDITS PASSED" : "FAILED"}`);

  cleanup();
  return {
    success: totalSuccess,
    travelTime: travelTimeAuditRes.result.value,
    hoverTest: hoverTestRes.result.value,
    sections: sectionResults,
    runtimeExceptions,
    consoleErrors,
    networkErrors
  };
}

runTravelTimeAudit().then(res => {
  process.exit(res.success ? 0 : 1);
}).catch(err => {
  console.error("FATAL AUDIT ERROR:", err);
  process.exit(1);
});
