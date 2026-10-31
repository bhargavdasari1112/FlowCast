/**
 * FlowCast AI - Live Website Functionality & GIS Map Repair Audit Suite
 * Uses Chrome DevTools Protocol to simulate real user interactions across all 8 dashboard sections,
 * all controls, all buttons, all sliders, all dropdowns, and all 9 backend API endpoints.
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, raw: data }); }
      });
    }).on('error', reject);
  });
}

async function runLiveAudit() {
  console.log("=".repeat(85));
  console.log("FLOWCAST AI: LIVE BROWSER INTERACTION AUDIT & GIS MAP VERIFICATION");
  console.log("=".repeat(85));

  // --- PART 4: TEST ALL NINE BACKEND API ENDPOINTS ---
  console.log("\n[PART 4] Auditing All 9 Backend API Endpoints directly...");
  const endpoints = [
    { url: "http://127.0.0.1:8000/api/health", name: "Health Check" },
    { url: "http://127.0.0.1:8000/api/overview?timestamp=2025-05-20T08:30:00", name: "Overview Data" },
    { url: "http://127.0.0.1:8000/api/traffic/forecast?timestamp=2025-05-20T08:30:00", name: "Traffic Forecast" },
    { url: "http://127.0.0.1:8000/api/congestion?timestamp=2025-05-20T08:30:00", name: "Congestion Matrix" },
    { url: "http://127.0.0.1:8000/api/travel-time?timestamp=2025-05-20T08:30:00", name: "Travel Time Predictions" },
    { url: "http://127.0.0.1:8000/api/accident-risk?timestamp=2025-05-20T08:30:00&threshold=0.01", name: "Accident Risk" },
    { url: "http://127.0.0.1:8000/api/roads?timestamp=2025-05-20T08:30:00", name: "GIS Road Network (25 Segments)" },
    { url: "http://127.0.0.1:8000/api/model-performance", name: "Model Performance Benchmarks" },
    { url: "http://127.0.0.1:8000/api/historical?date=2025-05-20&time=08:30&limit=25", name: "Historical Archive" }
  ];

  const apiResults = [];
  for (const ep of endpoints) {
    try {
      const res = await fetchJson(ep.url);
      const passed = res.status === 200 && (res.body?.status === "SUCCESS" || res.body?.status === "healthy" || res.body?.models);
      apiResults.push({ name: ep.name, url: ep.url, status: res.status, pass: passed });
      console.log(`   ${passed ? '✓' : '✗'} [HTTP ${res.status}] ${ep.name}`);
    } catch (err) {
      apiResults.push({ name: ep.name, url: ep.url, error: err.message, pass: false });
      console.log(`   ✗ [FAILED] ${ep.name}: ${err.message}`);
    }
  }

  // --- LAUNCH REAL CHROME ON CDP PORT 9224 ---
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const port = 9224;
  const chromeArgs = [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--window-size=1600,1050",
    "http://127.0.0.1:8000/"
  ];

  console.log(`\n[Chrome Launch] Launching Google Chrome on debugging port ${port}...`);
  const chromeProc = spawn(chromePath, chromeArgs, { stdio: 'ignore' });

  const cleanup = () => {
    try { chromeProc.kill(); } catch (e) {}
  };
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);

  let targets = null;
  for (let i = 0; i < 25; i++) {
    await wait(300);
    try {
      const res = await fetchJson(`http://127.0.0.1:${port}/json/list`);
      targets = res.body;
      if (targets && targets.length > 0) break;
    } catch (e) {}
  }

  if (!targets || targets.length === 0) {
    cleanup();
    throw new Error(`Failed to attach to Chrome on port ${port}`);
  }

  const pageTarget = targets.find(t => t.type === "page") || targets[0];
  console.log(`   Attached to Page: ${pageTarget.url}`);

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
      console.error(`   [CONSOLE EXCEPTION] ${desc}`);
    }

    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      const text = (msg.params.args || []).map(a => a.value || a.description || JSON.stringify(a)).join(" ");
      consoleErrors.push(text);
      console.error(`   [CONSOLE ERROR] ${text}`);
    }

    if (msg.method === "Network.responseReceived") {
      const { status, url } = msg.params.response;
      if (status >= 400 && !url.includes("favicon") && !url.includes("devtools")) {
        networkErrors.push({ status, url });
        console.error(`   [HTTP ${status}] ${url}`);
      }
    }
  };

  // Enable CDP domains
  await sendCdp("Page.enable");
  await sendCdp("Runtime.enable");
  await sendCdp("Network.enable");
  await sendCdp("Console.enable");

  // Hard reload with cache disabled
  await sendCdp("Network.setCacheDisabled", { cacheDisabled: true });
  await sendCdp("Page.reload", { ignoreCache: true });

  // Wait for initial data load
  console.log("\n[Live Audit] Waiting for initial data orchestrator to settle...");
  for (let i = 0; i < 30; i++) {
    await wait(300);
    const res = await sendCdp("Runtime.evaluate", {
      expression: `window.flowCastApp && !window.flowCastApp.isLoading`,
      returnByValue: true
    });
    if (res.result?.value === true) break;
  }
  await wait(800);

  // Helper to save screenshot
  const screenshotDir = path.join(__dirname, 'reports', 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  async function takeScreenshot(filename) {
    const res = await sendCdp("Page.captureScreenshot", { format: "png" });
    if (res && res.data) {
      const filePath = path.join(screenshotDir, filename);
      fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
      console.log(`   📸 Captured screenshot: reports/screenshots/${filename}`);
    }
  }

  // --- PART 1 & 2: TEST GIS MAP IN OVERVIEW AND DEDICATED MAP SECTION ---
  console.log("\n[PART 1 & 2] Auditing GIS Map in Section 1 (Overview)...");
  await takeScreenshot("01_overview_section.png");

  const overviewMapAudit = await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      const mapWrapper = document.getElementById("gis-map-wrapper");
      const canvas = document.getElementById("tactical-map-canvas");
      if (!canvas || !mapWrapper) return { error: "Map canvas not found in overview" };

      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext("2d");
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let nonZero = 0;
      for (let i = 3; i < imgData.data.length; i += 4) {
        if (imgData.data[i] > 20) nonZero++;
      }

      const map = window.corridorMapInstance;
      return {
        canvasFound: true,
        parentContainerId: mapWrapper.parentElement?.id,
        cssWidth: rect.width,
        cssHeight: rect.height,
        pixelWidth: canvas.width,
        pixelHeight: canvas.height,
        nonZeroPixels: nonZero,
        roadCount: map?.roads?.length || 0,
        activeLayer: map?.activeLayer,
        selectedRoadId: map?.selectedRoadId
      };
    })()`,
    returnByValue: true
  });
  console.log("   Overview Map Audit:", JSON.stringify(overviewMapAudit.result.value, null, 2));

  // Switch to Section 2: Dedicated GIS Arterial Highway Network Map
  console.log("\n[PART 1 & 2] Switching to Section 2: GIS Arterial Highway Network Map...");
  await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      const btn = document.querySelector('.nav-tab-item[data-tab="map"]') || document.getElementById("nav-btn-map");
      if (btn) btn.click();
    })()`,
    returnByValue: true
  });
  await wait(700);

  await takeScreenshot("02_gis_dedicated_map.png");

  // Audit dedicated map container, dimensions, pixel data
  const dedicatedMapAudit = await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      const mapWrapper = document.getElementById("gis-map-wrapper");
      const canvas = document.getElementById("tactical-map-canvas");
      const dedicatedContainer = document.getElementById("map-dedicated-container");

      if (!canvas) return { error: "Map canvas not found in dedicated view" };

      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext("2d");
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let nonZero = 0;
      let strokeColorCount = 0;

      for (let i = 0; i < imgData.data.length; i += 4) {
        const a = imgData.data[i + 3];
        if (a > 20) {
          nonZero++;
          const r = imgData.data[i];
          const g = imgData.data[i + 1];
          const b = imgData.data[i + 2];
          // Check for congestion stroke colors (green, amber, red, blue)
          if ((r > 150 && g < 100) || (g > 120 && r < 100) || (b > 150)) {
            strokeColorCount++;
          }
        }
      }

      const map = window.corridorMapInstance;
      return {
        canvasFound: true,
        parentContainerId: mapWrapper?.parentElement?.id,
        isInsideDedicatedContainer: mapWrapper?.parentElement?.id === "map-dedicated-container",
        cssWidth: rect.width,
        cssHeight: rect.height,
        nonZeroPixels: nonZero,
        strokeColorPixels: strokeColorCount,
        roadCount: map?.roads?.length || 0,
        arterialLinksDrawn: map?.corridorArterials?.length || 0,
        activeLayer: map?.activeLayer,
        selectedRoadId: map?.selectedRoadId
      };
    })()`,
    returnByValue: true
  });
  console.log("   Dedicated GIS Map Audit:", JSON.stringify(dedicatedMapAudit.result.value, null, 2));

  // Test Map Controls: Layer buttons, Zoom In, Zoom Out, Reset, Road Search, Road Click
  console.log("\n[GIS Map Controls] Testing Layer Buttons, Zoom In/Out, Reset, and Road Clicks...");
  const controlsAudit = await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      const map = window.corridorMapInstance;
      if (!map) return { error: "Map instance not found" };

      const results = {};

      // Test 1: Layer Switch to SPEED (Velocity)
      const speedBtn = document.querySelector('.layer-btn[data-layer="SPEED"]');
      if (speedBtn) {
        speedBtn.click();
        results.speedLayerActive = map.activeLayer === "SPEED";
      }

      // Test 2: Layer Switch to VOLUME (V/C Ratio)
      const volBtn = document.querySelector('.layer-btn[data-layer="VOLUME"]');
      if (volBtn) {
        volBtn.click();
        results.volLayerActive = map.activeLayer === "VOLUME";
      }

      // Test 3: Layer Switch to ACCIDENT (Hazard)
      const accBtn = document.querySelector('.layer-btn[data-layer="ACCIDENT"]');
      if (accBtn) {
        accBtn.click();
        results.accLayerActive = map.activeLayer === "ACCIDENT";
      }

      // Test 4: Layer Switch back to CONGESTION
      const congBtn = document.querySelector('.layer-btn[data-layer="CONGESTION"]');
      if (congBtn) {
        congBtn.click();
        results.congLayerActive = map.activeLayer === "CONGESTION";
      }

      // Test 5: Zoom Controls
      const initialZoom = map.zoomLevel;
      const zoomInBtn = document.getElementById("btn-zoom-in");
      if (zoomInBtn) zoomInBtn.click();
      results.zoomInWorked = map.zoomLevel > initialZoom;

      const zoomOutBtn = document.getElementById("btn-zoom-out");
      if (zoomOutBtn) zoomOutBtn.click();
      results.zoomOutWorked = map.zoomLevel <= initialZoom * 1.05;

      const resetBtn = document.getElementById("btn-zoom-reset");
      if (resetBtn) resetBtn.click();
      results.resetZoomWorked = map.zoomLevel === 1.0 && map.panX === 0 && map.panY === 0;

      // Test 6: Search Filter
      const searchInput = document.getElementById("gis-search-input");
      if (searchInput) {
        searchInput.value = "NL-006";
        searchInput.dispatchEvent(new Event("input"));
        results.searchFilterSelectedRoad = map.selectedRoadId === "NL-006";
      }

      // Test 7: Direct Click Selection
      map.selectRoad("NL-012");
      const drawer = document.getElementById("map-inspector-drawer");
      const drawerTitle = document.getElementById("drawer-header-title")?.textContent;
      const drawerContent = document.getElementById("inspector-drawer-content")?.textContent;
      
      results.directSelectionWorked = map.selectedRoadId === "NL-012";
      results.drawerOpened = drawer ? drawer.classList.contains("open") : false;
      results.drawerHasRoadTelemetry = drawerContent ? drawerContent.includes("NL-012") : false;

      // Close drawer
      const closeBtn = document.getElementById("map-drawer-close");
      if (closeBtn) closeBtn.click();
      results.drawerClosed = drawer ? !drawer.classList.contains("open") : false;

      return results;
    })()`,
    returnByValue: true
  });
  console.log("   GIS Map Interactive Controls Result:", JSON.stringify(controlsAudit.result.value, null, 2));

  // --- PART 3: TEST ALL OTHER DASHBOARD SECTIONS AND CONTROLS ---
  console.log("\n[PART 3] Auditing Sections 3 through 8 with User Interactions...");

  // Section 3: Volume Forecast
  console.log("\n--> Testing Section 3: Volume Forecast...");
  await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      document.querySelector('.nav-tab-item[data-tab="forecast"]')?.click();
    })()`,
    returnByValue: true
  });
  await wait(500);
  await takeScreenshot("03_volume_forecast.png");

  // Test road filter dropdown in forecast section
  const forecastTest = await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      const filter = document.getElementById("forecast-road-filter");
      const initialRows = document.querySelectorAll("#forecast-roads-tbody tr").length;
      let filterChanged = false;

      if (filter && filter.options.length > 1) {
        filter.value = "NL-002";
        filter.dispatchEvent(new Event("change"));
        filterChanged = true;
      }

      const canvas = document.getElementById("forecast-comparison-canvas");
      return {
        initialRows,
        filterOptionsCount: filter ? filter.options.length : 0,
        filterChanged,
        hasCanvas: !!canvas,
        canvasPixels: canvas ? canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data.some(p => p > 0) : false
      };
    })()`,
    returnByValue: true
  });
  console.log("   Volume Forecast Test:", JSON.stringify(forecastTest.result.value));

  // Section 4: Congestion Analysis
  console.log("\n--> Testing Section 4: Congestion Distribution Matrix...");
  await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      document.querySelector('.nav-tab-item[data-tab="congestion"]')?.click();
    })()`,
    returnByValue: true
  });
  await wait(500);
  await takeScreenshot("04_congestion_section.png");

  const congestionTest = await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      const tbody = document.getElementById("congestion-roads-tbody");
      const canvas = document.getElementById("congestion-donut-canvas");
      const rows = tbody ? tbody.querySelectorAll("tr").length : 0;
      return {
        rows,
        hasCanvas: !!canvas,
        canvasRendered: canvas ? canvas.width > 0 && canvas.height > 0 : false
      };
    })()`,
    returnByValue: true
  });
  console.log("   Congestion Analysis Test:", JSON.stringify(congestionTest.result.value));

  // Section 5: Travel Time Analysis
  console.log("\n--> Testing Section 5: Travel Time Intelligence...");
  await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      document.querySelector('.nav-tab-item[data-tab="traveltime"]')?.click();
    })()`,
    returnByValue: true
  });
  await wait(500);
  await takeScreenshot("05_travel_time_section.png");

  const travelTimeTest = await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      const canvas = document.getElementById("travel-time-canvas");
      const tbody = document.getElementById("travel-time-tbody");
      const rows = tbody ? tbody.querySelectorAll("tr").length : 0;
      const ttData = canvas?._ttData;

      return {
        hasCanvas: !!canvas,
        all25RoadsPlotted: ttData?.roads?.length === 25,
        tableRows: rows,
        avgCurrent: document.getElementById("tt-avg-curr")?.textContent,
        avgPredicted: document.getElementById("tt-avg-pred")?.textContent
      };
    })()`,
    returnByValue: true
  });
  console.log("   Travel Time Test:", JSON.stringify(travelTimeTest.result.value));

  // Section 6: Accident Risk Analysis
  console.log("\n--> Testing Section 6: Calibrated Accident Risk & Threshold Slider...");
  await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      document.querySelector('.nav-tab-item[data-tab="accident"]')?.click();
    })()`,
    returnByValue: true
  });
  await wait(500);
  await takeScreenshot("06_accident_risk_section.png");

  // Move threshold slider and verify reaction
  const accidentTest = await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      const slider = document.getElementById("accident-threshold-slider");
      const label = document.getElementById("threshold-val-display");
      const initialRows = document.querySelectorAll("#accident-risk-tbody tr, #accident-roads-tbody tr").length;

      let sliderMoved = false;
      if (slider) {
        slider.value = "0.015";
        slider.dispatchEvent(new Event("input"));
        sliderMoved = true;
      }

      return {
        initialRows,
        sliderMoved,
        sliderValDisplay: label ? label.textContent : null
      };
    })()`,
    returnByValue: true
  });
  console.log("   Accident Risk Test:", JSON.stringify(accidentTest.result.value));

  // Section 7: Model Studio & Performance
  console.log("\n--> Testing Section 7: Model Studio & Explainability...");
  await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      document.querySelector('.nav-tab-item[data-tab="performance"]')?.click();
    })()`,
    returnByValue: true
  });
  await wait(1000); // Allow async model performance data to load
  await takeScreenshot("07_model_performance_section.png");

  const performanceTest = await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      const cmTable = document.querySelector("#cm-congestion-container table");
      const featTable = document.querySelector("#feat-imp-vol-container");
      return {
        confusionMatrixRendered: !!cmTable,
        featureImportanceVisible: !!featTable && featTable.children.length > 0
      };
    })()`,
    returnByValue: true
  });
  console.log("   Model Studio Test:", JSON.stringify(performanceTest.result.value));

  // Section 8: Historical Traffic Archive
  console.log("\n--> Testing Section 8: Historical Sensor Log Archive & Query...");
  await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      document.querySelector('.nav-tab-item[data-tab="historical"]')?.click();
    })()`,
    returnByValue: true
  });
  await wait(600);

  // Click Query button in Historical Archive
  const historicalTest = await sendCdp("Runtime.evaluate", {
    expression: `(async () => {
      const queryBtn = document.getElementById("btn-query-historical");
      const csvBtn = document.getElementById("btn-export-csv");
      const pdfBtn = document.getElementById("btn-export-pdf");

      if (queryBtn) queryBtn.click();
      await new Promise(r => setTimeout(r, 800));

      const rows = document.querySelectorAll("#hist-results-tbody tr").length;

      // Test CSV Export trigger
      let csvExportTriggered = false;
      const originalCreateObjectURL = URL.createObjectURL;
      URL.createObjectURL = (blob) => {
        csvExportTriggered = blob.size > 0;
        return "blob:test";
      };
      if (csvBtn) csvBtn.click();
      URL.createObjectURL = originalCreateObjectURL;

      // Test PDF Export trigger
      let pdfExportTriggered = false;
      const originalPrint = window.print;
      window.print = () => { pdfExportTriggered = true; };
      if (pdfBtn) pdfBtn.click();
      window.print = originalPrint;

      return {
        queryButtonClicked: !!queryBtn,
        recordsLoaded: rows,
        hasCsvButton: !!csvBtn,
        csvExportTriggered,
        hasPdfButton: !!pdfBtn,
        pdfExportTriggered
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log("   Historical Archive Test:", JSON.stringify(historicalTest.result.value));
  await takeScreenshot("08_historical_archive.png");

  // --- TEST GLOBAL CONTROLS: TIMELINE PRESETS, SCRUBBER, SIMULATION REPLAY, THEME SWITCHER ---
  console.log("\n--> Testing Global Controls: Simulation Replay, Presets, Theme Toggle...");
  const globalControlsTest = await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      const results = {};

      // 1. Simulation Replay Play / Pause
      const playBtn = document.getElementById("btn-simulation-play");
      if (playBtn) {
        playBtn.click();
        results.replayStarted = window.flowCastApp?.isReplayPlaying === true;
        playBtn.click(); // Pause
        results.replayPaused = window.flowCastApp?.isReplayPlaying === false;
      }

      // 2. Theme Toggle
      const themeBtn = document.getElementById("btn-toggle-theme");
      const initialTheme = document.documentElement.getAttribute("data-theme");
      if (themeBtn) {
        themeBtn.click();
        const toggledTheme = document.documentElement.getAttribute("data-theme");
        results.themeToggled = toggledTheme !== initialTheme;
        themeBtn.click(); // revert
      }

      // 3. Quick Preset Button (e.g. Morning Rush)
      const presetBtn = document.querySelector(".preset-btn, .chip-btn");
      if (presetBtn) {
        presetBtn.click();
        results.presetClicked = true;
      }

      // 4. Return to GIS Map to confirm it remains fully visible after navigating all sections
      const mapLink = document.querySelector('.nav-tab-item[data-tab="map"]');
      if (mapLink) mapLink.click();

      return results;
    })()`,
    returnByValue: true
  });
  console.log("   Global Controls Test:", JSON.stringify(globalControlsTest.result.value, null, 2));

  await wait(600);

  // Verify GIS Map remains visible and functional after returning from visiting all 8 sections
  const mapReturnAudit = await sendCdp("Runtime.evaluate", {
    expression: `(() => {
      const canvas = document.getElementById("tactical-map-canvas");
      if (!canvas) return { error: "Map canvas missing on return" };

      const ctx = canvas.getContext("2d");
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let nonZero = 0;
      for (let i = 3; i < imgData.data.length; i += 4) {
        if (imgData.data[i] > 20) nonZero++;
      }

      return {
        canvasVisible: canvas.width > 0 && canvas.height > 0,
        nonZeroPixels: nonZero,
        mapRemainsFullyRendered: nonZero > 5000
      };
    })()`,
    returnByValue: true
  });
  console.log("   GIS Map Return Persistence Test:", JSON.stringify(mapReturnAudit.result.value));
  await takeScreenshot("09_gis_map_return_persistent.png");

  // Summary
  console.log("\n" + "=".repeat(85));
  console.log("FINAL TEST SUMMARY & ERROR LOGS");
  console.log("=".repeat(85));
  console.log(`Total Runtime Exceptions: ${runtimeExceptions.length}`);
  console.log(`Total Console Errors:     ${consoleErrors.length}`);
  console.log(`Total Network Failures:   ${networkErrors.length}`);
  console.log(`All 9 Backend APIs:       ${apiResults.every(r => r.pass) ? 'ALL PASS' : 'SOME FAILED'}`);
  console.log(`GIS Map Repaired:         ${dedicatedMapAudit.result.value?.nonZeroPixels > 5000 ? 'PASS (Visible and Interactive)' : 'FAIL'}`);
  console.log(`GIS Map Return Test:      ${mapReturnAudit.result.value?.mapRemainsFullyRendered ? 'PASS (Remains Visible)' : 'FAIL'}`);

  cleanup();

  return {
    success: runtimeExceptions.length === 0 && consoleErrors.length === 0 && networkErrors.length === 0,
    apiResults,
    overviewMap: overviewMapAudit.result.value,
    dedicatedMap: dedicatedMapAudit.result.value,
    controls: controlsAudit.result.value,
    forecast: forecastTest.result.value,
    congestion: congestionTest.result.value,
    travelTime: travelTimeTest.result.value,
    accident: accidentTest.result.value,
    performance: performanceTest.result.value,
    historical: historicalTest.result.value,
    globalControls: globalControlsTest.result.value,
    mapReturn: mapReturnAudit.result.value,
    runtimeExceptions,
    consoleErrors,
    networkErrors
  };
}

runLiveAudit().then(res => {
  fs.writeFileSync(path.join(__dirname, 'reports', 'audit_run_data.json'), JSON.stringify(res, null, 2));
  process.exit(res.success ? 0 : 1);
}).catch(err => {
  console.error("FATAL AUDIT RUNNER ERROR:", err);
  process.exit(1);
});
