/**
 * FlowCast AI - High-Precision Engineering Data Visualizations (Human-Crafted)
 * Renders Multi-Horizon Volume Splines, Congestion Distribution Donuts,
 * Comparative Volume Forecast Bars, Travel Time Delay Rankings, and Confusion Matrices.
 * Built for clarity, readability, tabular alignment, and zero neon/decorative clutter.
 */

const Charts = {
  setupCanvas(canvasOrContainerId) {
    let el = document.getElementById(canvasOrContainerId);
    if (!el) return null;

    let canvas = el.tagName === "CANVAS" ? el : el.querySelector("canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = `${canvasOrContainerId}-canvas`;
      el.appendChild(canvas);
    }

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const parent = canvas.parentElement;
    const rect = parent ? parent.getBoundingClientRect() : canvas.getBoundingClientRect();
    
    // Use true client width/height if visible, or fallback to saved logical dimensions
    let logicalW = (rect && rect.width > 0) ? rect.width : (canvas._logicalWidth || 600);
    let logicalH = (rect && rect.height > 0) ? rect.height : (canvas._logicalHeight || 220);
    canvas._logicalWidth = logicalW;
    canvas._logicalHeight = logicalH;

    canvas.style.width = `${logicalW}px`;
    canvas.style.height = `${logicalH}px`;
    canvas.width = Math.round(logicalW * dpr);
    canvas.height = Math.round(logicalH * dpr);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";

    return {
      canvas,
      ctx,
      w: logicalW,
      h: logicalH,
      isDark,
      gridColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#E2E5E8",
      textColor: isDark ? "#8B949E" : "#576574",
      primaryColor: isDark ? "#58A6FF" : "#1A365D",
      accentColor: "#0969DA"
    };
  },

  // 1. Multi-Horizon Volume Trend (Past 3-Hour Observation -> +30m Predicted Next)
  renderVolumeTrend(canvasId, trendDict, currentAvg, predictedAvg) {
    const c = this.setupCanvas(canvasId);
    if (!c) return;
    const { ctx, w, h, gridColor, textColor, primaryColor, accentColor, isDark } = c;

    const times = Object.keys(trendDict || {});
    const values = Object.values(trendDict || {}).map(v => Number(v) || 0);

    times.push("+30m Pred");
    values.push(predictedAvg != null ? Math.round(Number(predictedAvg)) : values[values.length - 1] || 1000);

    if (values.length < 2) return;

    ctx.clearRect(0, 0, w, h);

    const pad = { top: 25, right: 35, bottom: 35, left: 65 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    const minVal = Math.max(0, Math.floor(Math.min(...values) * 0.90));
    const maxVal = Math.ceil(Math.max(...values) * 1.10);

    // Horizontal gridlines & Y-axis labels
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.fillStyle = textColor;
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "right";

    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const val = Math.round(minVal + (maxVal - minVal) * (i / steps));
      const y = pad.top + chartH - (i / steps) * chartH;
      
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      ctx.fillText(`${val.toLocaleString()} veh`, pad.left - 8, y + 3);
    }

    // Points mapping
    const pts = times.map((t, i) => {
      const x = pad.left + (i / (times.length - 1)) * chartW;
      const y = pad.top + chartH - ((values[i] - minVal) / (maxVal - minVal)) * chartH;
      return { x, y, t, v: values[i] };
    });

    // Clean subtle area fill under historical line
    ctx.beginPath();
    pts.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else {
        const prev = pts[i - 1];
        const cx = (prev.x + pt.x) / 2;
        ctx.bezierCurveTo(cx, prev.y, cx, pt.y, pt.x, pt.y);
      }
    });
    ctx.lineTo(pts[pts.length - 1].x, pad.top + chartH);
    ctx.lineTo(pts[0].x, pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = isDark ? "rgba(88, 166, 255, 0.08)" : "rgba(26, 54, 93, 0.05)";
    ctx.fill();

    // Solid line for historical intervals
    ctx.beginPath();
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2;
    for (let i = 0; i < pts.length - 1; i++) {
      if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
      else {
        const prev = pts[i - 1];
        const cx = (prev.x + pts[i].x) / 2;
        ctx.bezierCurveTo(cx, prev.y, cx, pts[i].y, pts[i].x, pts[i].y);
      }
    }
    ctx.stroke();

    // Dashed line connecting current observation to +30m Prediction
    const lastHist = pts[pts.length - 2];
    const predPt = pts[pts.length - 1];
    ctx.beginPath();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.moveTo(lastHist.x, lastHist.y);
    ctx.lineTo(predPt.x, predPt.y);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Draw Data Point Nodes & X-Axis labels
    pts.forEach((pt, i) => {
      const isPred = (i === pts.length - 1);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isPred ? 4.5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isPred ? accentColor : primaryColor;
      ctx.fill();
      ctx.strokeStyle = isDark ? "#161B22" : "#FFFFFF";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // X-Axis time label
      ctx.fillStyle = isPred ? accentColor : textColor;
      ctx.font = isPred ? "bold 10px Inter, sans-serif" : "10px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(pt.t, pt.x, h - 12);
    });
  },

  // 2. Congestion Distribution Donut
  renderCongestionDonut(canvasId, distDict) {
    const c = this.setupCanvas(canvasId);
    if (!c) return;
    const { ctx, w, h, isDark, textColor } = c;

    const data = [
      { label: "Free-flow", val: distDict?.["Free-flow"] || 0, color: "#1A7F37" },
      { label: "Moderate", val: distDict?.["Moderate"] || 0, color: "#9A6700" },
      { label: "Heavy", val: distDict?.["Heavy"] || 0, color: "#BC4C00" },
      { label: "Severe", val: distDict?.["Severe"] || 0, color: "#CF222E" }
    ];

    const total = data.reduce((sum, d) => sum + d.val, 0) || 1;

    ctx.clearRect(0, 0, w, h);

    const centerX = w / 2 - 35;
    const centerY = h / 2;
    const outerR = Math.min(centerX, centerY) - 15;
    const innerR = outerR * 0.62;

    let startAngle = -Math.PI / 2;

    data.forEach(d => {
      const sliceAngle = (d.val / total) * (Math.PI * 2);
      if (sliceAngle > 0) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerR, startAngle, startAngle + sliceAngle);
        ctx.arc(centerX, centerY, innerR, startAngle + sliceAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = d.color;
        ctx.fill();
        ctx.strokeStyle = isDark ? "#161B22" : "#FFFFFF";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      startAngle += sliceAngle;
    });

    // Center Label
    ctx.textAlign = "center";
    ctx.fillStyle = isDark ? "#E6EDF3" : "#1C2430";
    ctx.font = "bold 16px Inter, sans-serif";
    ctx.fillText(`${total}`, centerX, centerY + 2);
    ctx.font = "9px Inter, sans-serif";
    ctx.fillStyle = textColor;
    ctx.fillText("SEGMENTS", centerX, centerY + 15);

    // Legend on Right
    const legendX = w - 105;
    let legendY = centerY - 32;

    ctx.textAlign = "left";
    data.forEach(d => {
      ctx.fillStyle = d.color;
      ctx.fillRect(legendX, legendY - 8, 8, 8);

      ctx.fillStyle = isDark ? "#E6EDF3" : "#1C2430";
      ctx.font = "11px Inter, sans-serif";
      ctx.fillText(`${d.label}: ${d.val}`, legendX + 14, legendY);
      legendY += 18;
    });
  },

  // 3. Road Volume Comparison Bar Chart
  renderRoadForecastBars(canvasId, roads) {
    const c = this.setupCanvas(canvasId);
    if (!c) return;
    const { ctx, w, h, gridColor, textColor, isDark } = c;

    const sample = (roads || []).slice(0, 8);
    if (sample.length === 0) return;

    ctx.clearRect(0, 0, w, h);

    const pad = { top: 20, right: 20, bottom: 35, left: 55 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    const maxVal = Math.max(...sample.map(r => {
      const cur = Number(r.current_volume || 0);
      const pred = Number(r.predicted_next_30m_volume ?? r.predicted_next_volume ?? 0);
      return Math.max(cur, pred);
    })) * 1.15 || 2000;

    // Grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.fillStyle = textColor;
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "right";

    const steps = 3;
    for (let i = 0; i <= steps; i++) {
      const val = Math.round(maxVal * (i / steps));
      const y = pad.top + chartH - (i / steps) * chartH;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
      ctx.fillText(val.toLocaleString(), pad.left - 6, y + 3);
    }

    const groupW = chartW / sample.length;
    const barW = Math.max(8, groupW * 0.32);

    sample.forEach((r, i) => {
      const groupX = pad.left + i * groupW;

      // Current Volume Bar (Navy)
      const curVol = Number(r.current_volume || 0);
      const curH = (curVol / maxVal) * chartH;
      const curX = groupX + groupW * 0.15;
      const curY = pad.top + chartH - curH;
      ctx.fillStyle = isDark ? "#58A6FF" : "#1A365D";
      ctx.fillRect(curX, curY, barW, curH);

      // Predicted Volume Bar (Blue)
      const predVol = Number(r.predicted_next_30m_volume ?? r.predicted_next_volume ?? 0);
      const predH = (predVol / maxVal) * chartH;
      const predX = curX + barW + 2;
      const predY = pad.top + chartH - predH;
      ctx.fillStyle = "#0969DA";
      ctx.fillRect(predX, predY, barW, predH);

      // Road ID Label
      ctx.textAlign = "center";
      ctx.fillStyle = textColor;
      ctx.font = "10px var(--font-mono), monospace";
      ctx.fillText(r.road_id, curX + barW, h - 14);
    });
  },

  // 4. Primary Travel Time Predictions Bar Chart
  // Contract: renderTravelTimeBars(canvasOrContainerId, roadsOrData)
  // Renders real travel-time predictions for all available corridor road segments (e.g. all 25 segments)
  renderTravelTimeBars(canvasOrContainerId, roadsOrData) {
    const c = this.setupCanvas(canvasOrContainerId);
    if (!c) return;
    const { canvas, ctx, w, h, gridColor, textColor, isDark } = c;

    const roadList = Array.isArray(roadsOrData) ? roadsOrData : (roadsOrData?.road_travel_times || []);

    if (!Array.isArray(roadList) || roadList.length === 0) {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = textColor;
      ctx.font = "12px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No travel-time predictions available for active timestamp.", w / 2, h / 2);
      return;
    }

    // Sort roads naturally by road_id so all 25 segments display sequentially along the corridor
    const roads = [...roadList].sort((a, b) => 
      (a.road_id || "").localeCompare(b.road_id || "", undefined, { numeric: true })
    );

    // Dynamic scale computation covering both current and predicted travel times
    const maxVal = Math.max(12, ...roads.map(r => {
      const p = Number(r.predicted_next_travel_time_min ?? r.predicted_next_travel_time ?? 0);
      const c = Number(r.current_travel_time_min ?? 0);
      return Math.max(p, c);
    }));
    const maxScale = Math.ceil((maxVal * 1.15) / 5) * 5; // e.g. 15, 20, 25 min

    const pad = { top: 32, right: 28, bottom: 38, left: 58 };
    const chartW = Math.max(100, w - pad.left - pad.right);
    const chartH = Math.max(60, h - pad.top - pad.bottom);

    // Save chart geometry for interaction and responsive redraw
    canvas._ttData = { roads, maxScale, pad, chartW, chartH, w, h, isDark, textColor, gridColor };

    // Function to render the chart at an optional hovered index
    const drawChart = (hoverIdx = -1) => {
      ctx.clearRect(0, 0, w, h);

      // 1. Top Legend & Axis Title
      ctx.font = "10px Inter, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "left";
      ctx.fillStyle = textColor;
      ctx.fillText("Traversal Duration (min)", pad.left, 16);

      // Legend items at top right
      const legendItems = [
        { label: "<7m Nominal", color: isDark ? "#2EA043" : "#1A7F37", isBar: true },
        { label: "7-9.5m Moderate", color: isDark ? "#D29922" : "#9A6700", isBar: true },
        { label: ">9.5m Severe", color: isDark ? "#F85149" : "#CF222E", isBar: true },
        { label: "Current TT", color: isDark ? "#58A6FF" : "#0969DA", isDash: true }
      ];

      let legendRightX = w - pad.right;
      for (let i = legendItems.length - 1; i >= 0; i--) {
        const item = legendItems[i];
        const textWidth = ctx.measureText(item.label).width;
        legendRightX -= (textWidth + 20);

        if (item.isBar) {
          ctx.fillStyle = item.color;
          ctx.fillRect(legendRightX, 8, 10, 8);
        } else if (item.isDash) {
          ctx.strokeStyle = item.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(legendRightX, 12);
          ctx.lineTo(legendRightX + 10, 12);
          ctx.stroke();
        }

        ctx.fillStyle = textColor;
        ctx.textAlign = "left";
        ctx.fillText(item.label, legendRightX + 13, 15);
      }

      // 2. Horizontal Gridlines & Y-Axis Units in Minutes
      const ySteps = 4;
      ctx.font = "10px var(--font-mono), monospace";
      ctx.textAlign = "right";
      ctx.lineWidth = 1;

      for (let i = 0; i <= ySteps; i++) {
        const val = Math.round((maxScale / ySteps) * i);
        const y = pad.top + chartH - (i / ySteps) * chartH;

        ctx.strokeStyle = gridColor;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(w - pad.right, y);
        ctx.stroke();

        ctx.fillStyle = textColor;
        ctx.fillText(`${val} min`, pad.left - 8, y + 3);
      }

      // 3. Render Vertical Prediction Columns for ALL 25 Road Segments
      const totalRoads = roads.length;
      const colStep = chartW / totalRoads;
      const barW = Math.max(5, Math.min(18, colStep * 0.72));

      roads.forEach((r, i) => {
        const predTT = Number(r.predicted_next_travel_time_min ?? r.predicted_next_travel_time ?? 0);
        const curTT = Number(r.current_travel_time_min ?? predTT);
        const delay = Number(r.travel_time_delay_min ?? (predTT - curTT));

        const colCenterX = pad.left + i * colStep + colStep / 2;
        const barX = colCenterX - barW / 2;
        const barH = Math.max(3, (predTT / maxScale) * chartH);
        const barY = pad.top + chartH - barH;

        // Hover highlight column behind bar
        if (i === hoverIdx) {
          ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)";
          ctx.fillRect(pad.left + i * colStep, pad.top, colStep, chartH);
        }

        // Color coding based on predicted traversal threshold
        let barColor = isDark ? "#2EA043" : "#1A7F37"; // Free-flow (<7m)
        if (predTT >= 9.5 || delay > 1.5) {
          barColor = isDark ? "#F85149" : "#CF222E"; // Severe delay (>9.5m)
        } else if (predTT >= 7.0 || delay > 0.5) {
          barColor = isDark ? "#D29922" : "#9A6700"; // Moderate delay (7.0-9.5m)
        }

        // Bar Fill
        ctx.fillStyle = barColor;
        ctx.fillRect(barX, barY, barW, barH);

        // Current Travel Time Tick Indicator across bar
        const curY = pad.top + chartH - Math.max(2, (curTT / maxScale) * chartH);
        ctx.strokeStyle = isDark ? "#58A6FF" : "#0969DA";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(barX - 2, curY);
        ctx.lineTo(barX + barW + 2, curY);
        ctx.stroke();

        // X-Axis Road Identifiers (Compact 2-digit format e.g. "01".."25")
        const roadNum = (r.road_id || "").replace(/^[A-Za-z_-]+0?/, "");
        ctx.fillStyle = (i === hoverIdx) ? (isDark ? "#58A6FF" : "#0969DA") : textColor;
        ctx.font = (i === hoverIdx) ? "bold 10px var(--font-mono), monospace" : "9px var(--font-mono), monospace";
        ctx.textAlign = "center";
        ctx.fillText(roadNum || `${i + 1}`, colCenterX, h - 14);
      });

      // 4. Floating Detail Tooltip on Hover
      if (hoverIdx >= 0 && hoverIdx < roads.length) {
        const item = roads[hoverIdx];
        const predVal = Number(item.predicted_next_travel_time_min ?? item.predicted_next_travel_time ?? 0);
        const curVal = Number(item.current_travel_time_min ?? predVal);
        const delayVal = Number(item.travel_time_delay_min ?? (predVal - curVal));
        const speedVal = item.avg_speed_kmh != null ? Number(item.avg_speed_kmh).toFixed(1) : "—";

        const titleText = `${item.road_id} — ${item.road_name || 'Corridor'}`;
        const line1 = `Predicted Traversal (+30m): ${predVal.toFixed(2)} min`;
        const line2 = `Current Traversal: ${curVal.toFixed(2)} min  (Delay: ${delayVal >= 0 ? '+' : ''}${delayVal.toFixed(2)} min)`;
        const line3 = `Velocity: ${speedVal} km/h  •  Click to focus on map`;

        ctx.font = "bold 11px Inter, -apple-system, BlinkMacSystemFont, sans-serif";
        const wTitle = ctx.measureText(titleText).width;
        ctx.font = "10px var(--font-mono), monospace";
        const w1 = ctx.measureText(line1).width;
        const w2 = ctx.measureText(line2).width;
        const w3 = ctx.measureText(line3).width;
        const tipW = Math.max(wTitle, w1, w2, w3) + 24;
        const tipH = 70;

        let tipX = pad.left + hoverIdx * colStep + colStep / 2 - tipW / 2;
        tipX = Math.max(10, Math.min(w - tipW - 10, tipX));
        let tipY = pad.top + 10;

        // Tooltip container box
        ctx.fillStyle = isDark ? "#161B22" : "#FFFFFF";
        ctx.strokeStyle = isDark ? "#30363D" : "#D0D7DE";
        ctx.lineWidth = 1;
        ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 3;

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(tipX, tipY, tipW, tipH, 4);
        } else {
          ctx.rect(tipX, tipY, tipW, tipH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Tooltip text lines
        ctx.textAlign = "left";
        ctx.fillStyle = isDark ? "#F0F6FC" : "#1F2328";
        ctx.font = "bold 11px Inter, -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(titleText, tipX + 10, tipY + 16);

        ctx.fillStyle = isDark ? "#58A6FF" : "#0969DA";
        ctx.font = "10px var(--font-mono), monospace";
        ctx.fillText(line1, tipX + 10, tipY + 32);

        ctx.fillStyle = isDark ? "#8B949E" : "#57606A";
        ctx.fillText(line2, tipX + 10, tipY + 48);

        ctx.fillStyle = isDark ? "#3FB950" : "#1A7F37";
        ctx.font = "9px Inter, -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(line3, tipX + 10, tipY + 62);
      }
    };

    // Initial draw
    drawChart(-1);

    // Attach interactive hover and click listeners once
    if (!canvas._hasTTListeners) {
      canvas._hasTTListeners = true;

      const getHoverIndex = (e) => {
        const rect = canvas.getBoundingClientRect();
        const d = canvas._ttData;
        if (!d) return -1;
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (
          mouseX < d.pad.left ||
          mouseX > d.w - d.pad.right ||
          mouseY < d.pad.top ||
          mouseY > d.h - d.pad.bottom
        ) {
          return -1;
        }

        const colStep = d.chartW / d.roads.length;
        const idx = Math.floor((mouseX - d.pad.left) / colStep);
        return (idx >= 0 && idx < d.roads.length) ? idx : -1;
      };

      canvas.addEventListener("mousemove", (e) => {
        const idx = getHoverIndex(e);
        if (idx !== canvas._currentHoverIdx) {
          canvas._currentHoverIdx = idx;
          canvas.style.cursor = (idx >= 0) ? "pointer" : "default";
          drawChart(idx);
        }
      });

      canvas.addEventListener("mouseleave", () => {
        if (canvas._currentHoverIdx !== -1) {
          canvas._currentHoverIdx = -1;
          canvas.style.cursor = "default";
          drawChart(-1);
        }
      });

      canvas.addEventListener("click", (e) => {
        const idx = getHoverIndex(e);
        const d = canvas._ttData;
        if (idx >= 0 && d && d.roads[idx] && window.flowCastApp) {
          window.flowCastApp.focusRoadOnMap(d.roads[idx].road_id);
        }
      });
    }
  },

  // 5. Alias for backward compatibility
  renderTravelTimeDelay(canvasId, roads) {
    this.renderTravelTimeBars(canvasId, roads);
  },

  // 6. Scientific 4-Class Confusion Matrix Heatmap
  renderConfusionMatrix(containerId, matrix, classNames) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const labels = classNames || ["Free-flow", "Moderate", "Heavy", "Severe"];
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";

    let html = `
      <div style="width:100%; overflow-x:auto;">
        <table class="data-table" style="text-align:center;">
          <thead>
            <tr>
              <th style="text-align:left; font-size:10px;">Actual \\ Pred</th>
              ${labels.map(l => `<th style="text-align:center; font-size:10px;">${l}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
    `;

    matrix.forEach((row, rowIdx) => {
      const rowSum = row.reduce((a, b) => a + b, 0) || 1;
      html += `<tr><td style="text-align:left; font-weight:600; font-size:11px;">${labels[rowIdx]}</td>`;

      row.forEach((count, colIdx) => {
        const isDiag = (rowIdx === colIdx);
        const rate = (count / rowSum);
        let bg = "transparent";
        let color = isDark ? "#E6EDF3" : "#1C2430";

        if (isDiag) {
          bg = isDark ? `rgba(63, 185, 80, ${0.15 + rate * 0.35})` : `rgba(26, 127, 55, ${0.12 + rate * 0.25})`;
          color = isDark ? "#3FB950" : "#1A7F37";
        } else if (count > 0) {
          bg = isDark ? "rgba(248, 81, 73, 0.08)" : "rgba(207, 34, 46, 0.06)";
        }

        html += `
          <td style="background-color:${bg}; color:${color}; font-family:var(--font-mono); font-size:11px; font-weight:${isDiag ? '700' : 'normal'};">
            ${count.toLocaleString()}
            <div style="font-size:9px; color:var(--text-muted); font-weight:normal;">${(rate * 100).toFixed(1)}%</div>
          </td>
        `;
      });
      html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
  }
};

// Global Browser Export
if (typeof window !== "undefined") {
  window.Charts = Charts;
}
if (typeof globalThis !== "undefined") {
  globalThis.Charts = Charts;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = Charts;
}
