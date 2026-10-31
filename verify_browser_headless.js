/**
 * FlowCast AI - Real Chrome Headless DevTools Verification Suite
 * Connects directly to Google Chrome via Chrome DevTools Protocol (CDP) WebSocket,
 * capturing console logs, network responses, and runtime exceptions.
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

async function runBrowserAudit() {
  console.log("=".repeat(75));
  console.log("FLOWCAST AI: REAL CHROME BROWSER HEADLESS AUDIT & CONSOLE INSPECTION");
  console.log("=".repeat(75));

  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const chromeArgs = [
    "--headless=new",
    "--remote-debugging-port=9222",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "http://127.0.0.1:8000/"
  ];

  console.log(`[1] Launching headless Chrome: ${chromePath}...`);
  const chromeProc = spawn(chromePath, chromeArgs, { stdio: 'ignore' });

  // Ensure Chrome is closed on exit
  const cleanup = () => {
    try { chromeProc.kill(); } catch (e) {}
  };
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);

  // Wait for DevTools port to open
  let targets = null;
  for (let i = 0; i < 15; i++) {
    await wait(400);
    try {
      targets = await fetchJson("http://127.0.0.1:9222/json/list");
      if (targets && targets.length > 0) break;
    } catch (e) {}
  }

  if (!targets || targets.length === 0) {
    cleanup();
    throw new Error("Failed to connect to Chrome DevTools port 9222");
  }

  const pageTarget = targets.find(t => t.type === "page") || targets[0];
  console.log(`[2] Chrome target attached: ${pageTarget.title} (${pageTarget.url})`);
  console.log(`[3] WebSocket Debugger URL: ${pageTarget.webSocketDebuggerUrl}`);

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  const consoleLogs = [];
  const networkErrors = [];
  const runtimeExceptions = [];
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

    if (msg.method === "Runtime.consoleAPICalled") {
      const args = (msg.params.args || []).map(a => a.value || a.description || JSON.stringify(a)).join(" ");
      consoleLogs.push({ type: msg.params.type, text: args });
      console.log(`   [Browser Console - ${msg.params.type.toUpperCase()}] ${args}`);
    }

    if (msg.method === "Runtime.exceptionThrown") {
      const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
      runtimeExceptions.push(desc);
      console.error(`   [Browser Runtime Exception] ${desc}`);
    }

    if (msg.method === "Network.responseReceived") {
      const { status, url } = msg.params.response;
      if (status >= 400 && !url.includes("favicon") && !url.includes("devtools")) {
        networkErrors.push({ status, url });
        console.error(`   [Browser Network HTTP ${status}] ${url}`);
      }
    }
  };

  // Enable DevTools Domains
  await sendCdp("Page.enable");
  await sendCdp("Runtime.enable");
  await sendCdp("Network.enable");
  await sendCdp("Console.enable");

  // Wait for initial page scripts and data loading
  console.log("[4] Waiting for initial page load and loadData() execution...");
  for (let i = 0; i < 20; i++) {
    const loadingState = await sendCdp("Runtime.evaluate", {
      expression: `window.flowCastApp ? window.flowCastApp.isLoading : true`,
      returnByValue: true
    });
    if (loadingState.result.value === false) break;
    await wait(500);
  }
  await wait(1000);

  // Evaluate KPI card values in actual DOM
  console.log("[5] Inspecting DOM elements rendered by Chrome...");
  const evalKpis = await sendCdp("Runtime.evaluate", {
    expression: `({
      totalVolume: document.getElementById('kpi-total-volume')?.textContent,
      avgVolume: document.getElementById('kpi-avg-volume')?.textContent,
      nextVolume: document.getElementById('kpi-next-volume')?.textContent,
      volumeDelta: document.getElementById('kpi-volume-delta')?.textContent,
      speed: document.getElementById('kpi-avg-speed')?.textContent,
      congestion: document.getElementById('kpi-dominant-congestion')?.textContent,
      travelTime: document.getElementById('kpi-avg-travel-time')?.textContent,
      segments: document.getElementById('kpi-segments-count')?.textContent,
      systemHealth: document.getElementById('kpi-system-health')?.textContent,
      timestamp: document.getElementById('active-timestamp-display')?.textContent
    })`,
    returnByValue: true
  });
  console.log("   --> Rendered KPIs in Live DOM:", evalKpis.result.value);

  // Test Refresh click
  console.log("[6] Triggering Refresh (btn-refresh-data) in browser DOM...");
  await sendCdp("Runtime.evaluate", {
    expression: `document.getElementById('btn-refresh-data')?.click();`
  });
  await wait(1500);

  // Test Tab Switching through all 8 tabs
  console.log("[7] Clicking through all 8 dashboard tabs in browser DOM...");
  const tabs = ["overview", "map", "forecast", "congestion", "traveltime", "accident", "performance", "historical"];
  for (const t of tabs) {
    await sendCdp("Runtime.evaluate", {
      expression: `document.getElementById('nav-btn-${t}')?.click();`
    });
    await wait(300);
  }

  // Final check
  await wait(1000);
  ws.close();
  cleanup();

  console.log("=".repeat(75));
  console.log("REAL BROWSER AUDIT RESULTS:");
  console.log(`Total Console Messages Captured: ${consoleLogs.length}`);
  console.log(`Total 404 / HTTP Network Errors: ${networkErrors.length}`);
  console.log(`Total JavaScript TypeErrors / Exceptions: ${runtimeExceptions.length}`);

  if (networkErrors.length > 0) {
    console.error("FAILED: 404 or HTTP errors detected in browser network traffic:", networkErrors);
    process.exit(1);
  }

  if (runtimeExceptions.length > 0) {
    console.error("FAILED: JavaScript TypeErrors or exceptions thrown in browser:", runtimeExceptions);
    process.exit(1);
  }

  console.log("[PASS] Browser console verified: 0 404 errors, 0 JavaScript TypeErrors!");
  console.log("=".repeat(75));
}

runBrowserAudit().catch(err => {
  console.error("Browser Audit Error:", err);
  process.exit(1);
});
