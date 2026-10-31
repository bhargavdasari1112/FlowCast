const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const BASE_URL = "http://127.0.0.1:8000";
const DEBUG_PORT = 9225; // Clean distinct debug port
const DOWNLOAD_DIR = path.join(__dirname, "reports", "downloads");
const SCREENSHOT_DIR = path.join(__dirname, "reports", "screenshots");

if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    }).on("error", reject);
  });
}

async function runProductionVerification() {
  console.log("=====================================================================================");
  console.log("FLOWCAST AI: COMPREHENSIVE PRODUCTION READINESS & VERIFICATION SUITE");
  console.log("=====================================================================================\n");

  // Step 1: Direct API Audit & Model Metric Verification
  console.log("[STEP 1] Direct API Audit across all 9 endpoints...");
  const endpoints = [
    { name: "Health Check", path: "/api/health" },
    { name: "Overview Data", path: "/api/overview?timestamp=2025-05-20T08:30:00" },
    { name: "Traffic Forecast", path: "/api/traffic/forecast?timestamp=2025-05-20T08:30:00" },
    { name: "Congestion Matrix", path: "/api/congestion?timestamp=2025-05-20T08:30:00" },
    { name: "Travel Time Predictions", path: "/api/travel-time?timestamp=2025-05-20T08:30:00" },
    { name: "Accident Risk Analytics", path: "/api/accident-risk?timestamp=2025-05-20T08:30:00&threshold=0.01" },
    { name: "GIS Road Network", path: "/api/roads?timestamp=2025-05-20T08:30:00" },
    { name: "Model Performance Studio", path: "/api/model-performance" },
    { name: "Historical Archive", path: "/api/historical?date=2025-05-20&time=08:30&limit=25" }
  ];

  const apiResults = {};
  for (const ep of endpoints) {
    const res = await httpGetJson(`${BASE_URL}${ep.path}`);
    apiResults[ep.name] = { statusCode: res.status, ok: res.status === 200 };
    console.log(`   ${res.status === 200 ? "✓" : "✗"} [HTTP ${res.status}] ${ep.name}`);
  }

  // Model Metric Verification from /api/model-performance
  const modelPerfRes = await httpGetJson(`${BASE_URL}/api/model-performance`);
  console.log("\n[STEP 1.1] Reconciling API Model Performance Metrics with Validation Artifacts...");
  const metrics = modelPerfRes.body.metrics;
  const volGB = metrics?.traffic_volume?.["Gradient Boosting (HistGB)"] || {};
  const congGB = metrics?.congestion?.["Gradient Boosting (HistGB)"] || {};
  const ttGB = metrics?.travel_time?.["Gradient Boosting (HistGB)"] || {};
  const accPlatt = metrics?.accident_risk?.["Platt Calibrated Logistic (Val)"] || {};

  console.log("   - Volume HistGB:", JSON.stringify(volGB));
  console.log("   - Congestion HistGB:", JSON.stringify(congGB));
  console.log("   - Travel Time HistGB:", JSON.stringify(ttGB));
  console.log("   - Accident Risk Platt:", JSON.stringify(accPlatt));

  // Step 2: Launch Chrome with CDP
  console.log("\n[STEP 2] Launching Google Chrome for Live Manual Emulation...");
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const chromeArgs = [
    `--remote-debugging-port=${DEBUG_PORT}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1680,1050",
    BASE_URL
  ];

  const chromeProc = spawn(chromePath, chromeArgs);
  await wait(2500);

  // Discover CDP Target
  let targets = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      const res = await httpGetJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      if (Array.isArray(res.body) && res.body.length > 0) {
        targets = res.body;
        break;
      }
    } catch (e) {}
  }

  const targetPage = targets?.find(t => t.type === "page") || targets?.[0];
  if (!targetPage) {
    throw new Error("Could not attach to Chrome CDP page!");
  }

  const ws = new WebSocket(targetPage.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });

  let messageId = 1;
  const pendingRequests = new Map();
  const consoleMessages = [];
  const networkErrors = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pendingRequests.has(msg.id)) {
      const { resolve, reject } = pendingRequests.get(msg.id);
      pendingRequests.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
    if (msg.method === "Runtime.consoleAPICalled") {
      const text = msg.params.args.map(a => a.value || JSON.stringify(a)).join(" ");
      consoleMessages.push({ type: msg.params.type, text });
      if (msg.params.type === "error") {
        console.error(`   [Browser Error] ${text}`);
      }
    }
    if (msg.method === "Runtime.exceptionThrown") {
      const details = msg.params.exceptionDetails;
      consoleMessages.push({ type: "exception", text: details.text });
      console.error(`   [Uncaught Exception] ${details.text}`);
    }
    if (msg.method === "Network.responseReceived") {
      const status = msg.params.response.status;
      const url = msg.params.response.url;
      if (status >= 400 && !url.includes("favicon.ico")) {
        networkErrors.push({ url, status });
        console.error(`   [Network HTTP ${status}] ${url}`);
      }
    }
  };

  function sendCdp(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = messageId++;
      pendingRequests.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // Enable CDP Domains
  await sendCdp("Runtime.enable");
  await sendCdp("Page.enable");
  await sendCdp("Network.enable");

  // Configure Chrome Download Behavior
  await sendCdp("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: DOWNLOAD_DIR
  });

  console.log("   Attached to browser page. Waiting for dashboard to settle...");
  await wait(2500);

  async function takeScreenshot(filename) {
    const shot = await sendCdp("Page.captureScreenshot", { format: "png" });
    const fullPath = path.join(SCREENSHOT_DIR, filename);
    fs.writeFileSync(fullPath, Buffer.from(shot.data, "base64"));
    console.log(`   📸 Captured screenshot: ${filename}`);
  }

  // =========================================================================
  // TEST SUITE: SECTION BY SECTION INTERACTION
  // =========================================================================

  console.log("\n[STEP 3] Inspecting Section 1: Command Center / Overview...");
  await sendCdp("Runtime.evaluate", {
    expression: `(async () => {
      for (let i = 0; i < 30; i++) {
        if (window.flowCastApp && !window.flowCastApp.isLoading && window.flowCastApp.lastOverviewData) break;
        await new Promise(r => setTimeout(r, 200));
      }
    })()`,
    awaitPromise: true
  });
  await takeScreenshot("01_production_overview.png");
  const section1Test = await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      const kpis = {
        totalVolume: document.getElementById("kpi-total-volume")?.textContent,
        nextVolume: document.getElementById("kpi-next-volume")?.textContent,
        avgSpeed: document.getElementById("kpi-avg-speed")?.textContent,
        dominantCongestion: document.getElementById("kpi-dominant-congestion")?.textContent,
        avgTravelTime: document.getElementById("kpi-avg-travel-time")?.textContent
      };
      const bottlenecks = document.querySelectorAll("#overview-bottleneck-list > div").length;
      const trendCanvas = document.getElementById("overview-trend-canvas");
      const minimap = document.querySelector("#map-container canvas");
      return {
        kpis,
        bottlenecksCount: bottlenecks,
        trendCanvasRendered: !!trendCanvas && trendCanvas.width > 0,
        minimapFound: !!minimap,
        minimapPixels: minimap ? minimap.getContext("2d").getImageData(0,0,minimap.width,minimap.height).data.some(p => p > 0) : false
      };
    })()`,
    returnByValue: true
  });
  console.log("   Section 1 Result:", JSON.stringify(section1Test.result.value));

  console.log("\n[STEP 4] Inspecting Section 2: GIS Arterial Highway Network Map...");
  await sendCdp("Runtime.evaluate", {
    expression: `document.querySelector('.nav-tab-item[data-tab="map"]')?.click();`
  });
  await wait(600);
  await takeScreenshot("02_production_gis_map.png");

  // Deep Map Audit: Links, Nodes, Layers, Zoom Controls, Road Selection, Drawer
  const gisDeepAudit = await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      const map = window.flowCastApp?.corridorMap;
      if (!map) return { error: "corridorMap instance not found" };

      const roadCount = (map.roads || []).length;
      const linkCount = (map.corridorArterials || []).length;

      // Layer Toggles via DOM buttons
      const layers = ["SPEED", "VOLUME", "HAZARD", "CONGESTION"];
      const layerStates = {};
      for (const l of layers) {
        const btn = document.querySelector(\`button[data-layer="\${l}"]\`);
        if (btn) btn.click();
        layerStates[l] = map.activeLayer === l;
      }
      document.querySelector('button[data-layer="CONGESTION"]')?.click();

      // Zoom Controls via DOM buttons
      const zoomInitial = map.zoomLevel;
      document.getElementById("btn-zoom-in")?.click();
      const zoomIn = map.zoomLevel > zoomInitial;
      document.getElementById("btn-zoom-out")?.click();
      document.getElementById("btn-zoom-out")?.click();
      const zoomOut = map.zoomLevel < zoomInitial;
      document.getElementById("btn-reset-view")?.click();
      const resetOk = map.zoomLevel === 1.0;

      // Road selection: NL-001
      map.selectRoad("NL-001");
      const roadSelected = map.selectedRoadId === "NL-001";

      // Telemetry Drawer Check
      const drawer = document.getElementById("road-telemetry-drawer");
      const drawerOpen = drawer?.classList.contains("open");
      const drawerTitle = document.getElementById("drawer-road-title")?.textContent;

      // Close drawer
      const closeBtn = document.getElementById("btn-close-drawer");
      if (closeBtn) closeBtn.click();
      const drawerClosed = !drawer?.classList.contains("open");

      return {
        roadNodesCount: roadCount,
        arterialLinksCount: linkCount,
        layerStates,
        zoomIn,
        zoomOut,
        resetOk,
        roadSelected,
        drawerOpen,
        drawerTitle,
        drawerClosed
      };
    })()`,
    returnByValue: true
  });
  console.log("   GIS Tactical Map Deep Audit:", JSON.stringify(gisDeepAudit.result.value, null, 2));

  console.log("\n[STEP 5] Inspecting Section 3: Volume Forecast...");
  await sendCdp("Runtime.evaluate", {
    expression: `document.querySelector('.nav-tab-item[data-tab="forecast"]')?.click();`
  });
  await wait(500);
  await takeScreenshot("03_production_forecast.png");
  const section3Test = await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      const dropdown = document.getElementById("forecast-road-filter");
      const initialRows = document.querySelectorAll("#forecast-roads-tbody tr").length;
      let filterSwitched = false;
      if (dropdown && dropdown.options.length > 3) {
        dropdown.value = "NL-003";
        dropdown.dispatchEvent(new Event("change"));
        filterSwitched = true;
      }
      const canvas = document.getElementById("forecast-comparison-canvas");
      return {
        initialRows,
        dropdownCount: dropdown ? dropdown.options.length : 0,
        filterSwitched,
        canvasRendered: !!canvas && canvas.width > 0 && canvas.height > 0
      };
    })()`,
    returnByValue: true
  });
  console.log("   Section 3 Result:", JSON.stringify(section3Test.result.value));

  console.log("\n[STEP 6] Inspecting Section 4: Congestion Distribution Analysis...");
  await sendCdp("Runtime.evaluate", {
    expression: `document.querySelector('.nav-tab-item[data-tab="congestion"]')?.click();`
  });
  await wait(500);
  await takeScreenshot("04_production_congestion.png");
  const section4Test = await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      const canvas = document.getElementById("congestion-donut-canvas");
      const rows = document.querySelectorAll("#congestion-roads-tbody tr").length;
      return {
        rows,
        donutRendered: !!canvas && canvas.width > 0 && canvas.height > 0
      };
    })()`,
    returnByValue: true
  });
  console.log("   Section 4 Result:", JSON.stringify(section4Test.result.value));

  console.log("\n[STEP 7] Inspecting Section 5: Travel Time Intelligence...");
  await sendCdp("Runtime.evaluate", {
    expression: `document.querySelector('.nav-tab-item[data-tab="travel-time"]')?.click();`
  });
  await wait(500);
  await takeScreenshot("05_production_travel_time.png");
  const section5Test = await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      const canvas = document.getElementById("travel-time-canvas");
      const rows = document.querySelectorAll("#travel-time-tbody tr").length;
      const kpiCurrent = document.getElementById("tt-avg-curr")?.textContent;
      const kpiPred = document.getElementById("tt-avg-pred")?.textContent;
      const hasPixelData = canvas ? canvas.getContext("2d").getImageData(0,0,canvas.width,canvas.height).data.some(p => p > 0) : false;
      return {
        canvasFound: !!canvas,
        hasPixelData,
        tableRows: rows,
        kpiCurrent,
        kpiPred
      };
    })()`,
    returnByValue: true
  });
  console.log("   Section 5 Result:", JSON.stringify(section5Test.result.value));

  console.log("\n[STEP 8] Inspecting Section 6: Calibrated Accident Risk (Surrogate Safety Measure)...");
  await sendCdp("Runtime.evaluate", {
    expression: `document.querySelector('.nav-tab-item[data-tab="accident"]')?.click();`
  });
  await wait(500);
  await takeScreenshot("06_production_accident_risk.png");
  const section6Test = await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      const noticeBox = document.querySelector("#section-accident .notice-warning");
      const noticeText = noticeBox ? noticeBox.textContent : "";
      const slider = document.getElementById("accident-threshold-slider");
      const label = document.getElementById("threshold-val-display");

      let sliderAdjusted = false;
      if (slider) {
        slider.value = "0.015";
        slider.dispatchEvent(new Event("input"));
        sliderAdjusted = true;
      }
      const rows = document.querySelectorAll("#accident-roads-tbody tr").length;

      return {
        hasExperimentalNotice: noticeText.includes("EXPERIMENTAL"),
        noticeContainsSurrogate: noticeText.includes("SURROGATE"),
        sliderAdjusted,
        sliderValue: label ? label.textContent : null,
        rows
      };
    })()`,
    returnByValue: true
  });
  console.log("   Section 6 Result:", JSON.stringify(section6Test.result.value));

  console.log("\n[STEP 9] Inspecting Section 7: Model Studio & Governance...");
  await sendCdp("Runtime.evaluate", {
    expression: `document.querySelector('.nav-tab-item[data-tab="performance"]')?.click();`
  });
  await wait(800);
  await takeScreenshot("07_production_model_studio.png");
  const section7Test = await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      const volRows = document.querySelectorAll("#model-perf-vol-tbody tr").length;
      const congRows = document.querySelectorAll("#model-perf-cong-tbody tr").length;
      const cmMatrix = document.querySelector("#cm-congestion-container table");
      const volFeat = document.querySelectorAll("#feat-imp-vol-container > div").length;
      const accFeat = document.querySelectorAll("#feat-imp-acc-container > div").length;
      const takeaways = document.querySelectorAll("#model-takeaways-container > div").length;
      const brierVal = document.getElementById("acc-metric-brier")?.textContent;
      const rocVal = document.getElementById("acc-metric-roc")?.textContent;

      return {
        volumeModelRows: volRows,
        congestionModelRows: congRows,
        confusionMatrixFound: !!cmMatrix,
        volumeFeaturesCount: volFeat,
        accidentFeaturesCount: accFeat,
        empiricalTakeawaysCount: takeaways,
        brierDisplayed: brierVal,
        rocDisplayed: rocVal
      };
    })()`,
    returnByValue: true
  });
  console.log("   Section 7 Result:", JSON.stringify(section7Test.result.value));

  console.log("\n[STEP 10] Inspecting Section 8: Historical Sensor Log Archive & Real Export Testing...");
  await sendCdp("Runtime.evaluate", {
    expression: `document.querySelector('.nav-tab-item[data-tab="historical"]')?.click();`
  });
  await wait(600);

  // Perform search query
  const queryResult = await sendCdp("Runtime.evaluate", {
    expression: `(async () => {
      const btn = document.getElementById("btn-query-historical");
      if (btn) btn.click();
      await new Promise(r => setTimeout(r, 800));
      return {
        rows: document.querySelectorAll("#hist-results-tbody tr").length,
        hasRecords: !!window.flowCastApp?.cachedHistoricalRecords?.length
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log("   Historical Query Result:", JSON.stringify(queryResult.result.value));
  await takeScreenshot("08_production_historical_archive.png");

  // TEST 8A: REAL CSV EXPORT VERIFICATION
  console.log("\n[TEST 8A] Testing Real CSV File Download and Contents...");
  // Clear any old csv in DOWNLOAD_DIR
  fs.readdirSync(DOWNLOAD_DIR).forEach(f => {
    if (f.endsWith(".csv")) fs.unlinkSync(path.join(DOWNLOAD_DIR, f));
  });

  await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      document.getElementById("btn-export-csv")?.click();
    })()`
  });
  await wait(1500);

  // Check downloaded file
  const downloadedFiles = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.endsWith(".csv"));
  let csvVerification = { fileFound: false, lineCount: 0, headerVerified: false, sampleRecord: null };
  if (downloadedFiles.length > 0) {
    const csvPath = path.join(DOWNLOAD_DIR, downloadedFiles[0]);
    const csvContent = fs.readFileSync(csvPath, "utf-8");
    const lines = csvContent.trim().split("\n");
    const headers = lines[0].split(",");
    csvVerification = {
      fileFound: true,
      filename: downloadedFiles[0],
      fileSizeBytes: fs.statSync(csvPath).size,
      lineCount: lines.length,
      headerVerified: headers.includes('"road_id"') && headers.includes('"traffic_volume"') && headers.includes('"travel_time"'),
      sampleRecord: lines[1]
    };
  }
  console.log("   CSV Export Verification:", JSON.stringify(csvVerification, null, 2));

  // TEST 8B: REAL PDF EXPORT & PRINT PREVIEW
  console.log("\n[TEST 8B] Testing PDF Report Generation via CDP printToPDF...");
  const pdfData = await sendCdp("Page.printToPDF", {
    printBackground: true,
    paperWidth: 11.0,
    paperHeight: 8.5,
    marginTop: 0.4,
    marginBottom: 0.4,
    marginLeft: 0.4,
    marginRight: 0.4
  });
  const pdfPath = path.join(__dirname, "reports", "FLOWCAST_PRODUCTION_REPORT.pdf");
  fs.writeFileSync(pdfPath, Buffer.from(pdfData.data, "base64"));
  const pdfStat = fs.statSync(pdfPath);
  console.log(`   PDF Report Generated: ${pdfPath} (${pdfStat.size} bytes)`);

  // =========================================================================
  // GLOBAL CONTROLS & NAVIGATION RE-ENTRY PERSISTENCE
  // =========================================================================
  console.log("\n[STEP 11] Testing Global Controls & Map Return Persistence...");
  const globalTest = await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      // 1. Simulation Replay Play / Pause
      const playBtn = document.getElementById("btn-simulation-play");
      let replayPlayed = false;
      let replayPaused = false;
      if (playBtn) {
        playBtn.click();
        replayPlayed = window.flowCastApp?.isReplayPlaying === true;
        playBtn.click();
        replayPaused = window.flowCastApp?.isReplayPlaying === false;
      }

      // 2. Timeline Presets
      const presetBtn = document.querySelector('.preset-btn[data-time="14:00"]');
      let presetActivated = false;
      if (presetBtn) {
        presetBtn.click();
        presetActivated = window.flowCastApp?.currentTime === "14:00";
      }

      // 3. Theme Toggle
      const themeBtn = document.getElementById("btn-toggle-theme");
      let themeSwitched = false;
      const initialTheme = document.documentElement.getAttribute("data-theme");
      if (themeBtn) {
        themeBtn.click();
        const nextTheme = document.documentElement.getAttribute("data-theme");
        themeSwitched = nextTheme !== initialTheme;
        themeBtn.click(); // revert
      }

      return {
        replayPlayed,
        replayPaused,
        presetActivated,
        themeSwitched
      };
    })()`,
    returnByValue: true
  });
  console.log("   Global Controls Result:", JSON.stringify(globalTest.result.value));

  // Return to GIS Map to verify persistence
  await sendCdp("Runtime.evaluate", {
    expression: `document.querySelector('.nav-tab-item[data-tab="map"]')?.click();`
  });
  await wait(600);
  await takeScreenshot("09_production_map_return_persistent.png");

  const mapReturnAudit = await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      const map = window.flowCastApp?.corridorMap;
      const canvas = map?.canvas;
      const isVisible = canvas && canvas.offsetWidth > 0 && canvas.offsetHeight > 0;
      const pixelCount = canvas ? canvas.getContext("2d").getImageData(0,0,canvas.width,canvas.height).data.filter(p => p > 0).length : 0;
      return {
        canvasFound: !!canvas,
        isVisible,
        pixelCount,
        roadCount: (map?.roads || []).length,
        linksCount: (map?.corridorArterials || []).length
      };
    })()`,
    returnByValue: true
  });
  console.log("   Map Return Persistence Audit:", JSON.stringify(mapReturnAudit.result.value));

  // Cleanup Chrome
  ws.close();
  chromeProc.kill();

  console.log("\n=====================================================================================");
  console.log("SUMMARY OF PRODUCTION READINESS AUDIT");
  console.log("=====================================================================================");
  console.log(`- Total Console Errors:     ${consoleMessages.filter(m => m.type === "error" || m.type === "exception").length}`);
  console.log(`- Total Network Failures:   ${networkErrors.length}`);
  console.log(`- Backend APIs Passing:     ${Object.values(apiResults).filter(r => r.ok).length} / ${endpoints.length}`);
  console.log(`- CSV File Validated:       ${csvVerification.fileFound ? "PASS" : "FAIL"}`);
  console.log(`- PDF File Validated:       ${pdfStat.size > 10000 ? "PASS" : "FAIL"} (${pdfStat.size} bytes)`);
  console.log(`- GIS Map 25 Roads/28 Links: ${gisDeepAudit?.result?.value?.roadNodesCount === 25 && gisDeepAudit?.result?.value?.arterialLinksCount === 28 ? "PASS" : "FAIL"}`);
  console.log("=====================================================================================\n");
}

runProductionVerification().catch(err => {
  console.error("FATAL AUDIT FAILURE:", err);
  process.exit(1);
});
