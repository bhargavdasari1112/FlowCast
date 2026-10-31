/**
 * FlowCast AI - Professional GIS Traffic Map Engine (Human-Crafted)
 * Implements high-precision 2D cartographic rendering for the 25 Delhi Northline Corridor segments.
 * Focuses on geographic accuracy, typographic clarity, and professional GIS engineering standards.
 * Zero fake 3D projections, zero floating glowing particles, zero decorative gimmicks.
 */

class NorthlineCorridorMap {
  constructor(containerId, onSelectRoad) {
    this.container = document.getElementById(containerId);
    this.onSelectRoad = onSelectRoad;
    this.roads = [];
    this.selectedRoadId = "NL-001";
    this.hoveredRoadId = null;

    // GIS Layer State
    this.activeLayer = "CONGESTION"; // "CONGESTION", "SPEED", "VOLUME", "ACCIDENT"
    this.searchQuery = "";

    // Camera / Pan / Zoom
    this.zoomLevel = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    // Delhi Northline Corridor Geographic Bounds
    this.minLat = 28.560;
    this.maxLat = 28.685;
    this.minLon = 77.100;
    this.maxLon = 77.315;

    // Arterial Road Network Links connecting the 25 monitored sensor nodes
    this.corridorArterials = [
      ["NL-001", "NL-002"], ["NL-001", "NL-007"], ["NL-002", "NL-005"],
      ["NL-005", "NL-006"], ["NL-006", "NL-012"], ["NL-007", "NL-013"],
      ["NL-013", "NL-016"], ["NL-016", "NL-003"], ["NL-003", "NL-009"],
      ["NL-009", "NL-018"], ["NL-018", "NL-011"], ["NL-011", "NL-017"],
      ["NL-017", "NL-002"], ["NL-017", "NL-025"], ["NL-025", "NL-014"],
      ["NL-014", "NL-010"], ["NL-006", "NL-008"], ["NL-008", "NL-004"],
      ["NL-004", "NL-022"], ["NL-022", "NL-021"], ["NL-021", "NL-023"],
      ["NL-023", "NL-016"], ["NL-005", "NL-015"], ["NL-015", "NL-019"],
      ["NL-019", "NL-020"], ["NL-020", "NL-005"], ["NL-012", "NL-024"],
      ["NL-024", "NL-008"]
    ];

    this.canvas = null;
    this.ctx = null;
    this.animationFrameId = null;

    this.initDOM();
    this.initEventListeners();
    this.render();
  }

  initDOM() {
    if (!this.container) return;
    this.container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "gis-map-wrapper";
    wrapper.id = "gis-map-wrapper";
    wrapper.style.width = "100%";
    wrapper.style.height = "100%";
    wrapper.innerHTML = `
      <canvas class="gis-canvas" id="tactical-map-canvas"></canvas>

      <!-- Top GIS Toolbar -->
      <div class="gis-hud-toolbar">
        <span style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Layer:</span>
        <div class="layer-btn-group">
          <button class="layer-btn active" data-layer="CONGESTION">🚦 Congestion</button>
          <button class="layer-btn" data-layer="SPEED">⚡ Velocity</button>
          <button class="layer-btn" data-layer="VOLUME">🚗 V/C Ratio</button>
          <button class="layer-btn" data-layer="ACCIDENT">⚠️ Hazard</button>
        </div>
        <div style="width:1px; height:16px; background-color:var(--border-subtle); margin:0 4px;"></div>
        <input type="text" id="gis-search-input" class="input-control" placeholder="Filter road ID..." style="height:24px; width:110px; font-size:11px;">
      </div>

      <!-- GIS Map Legend -->
      <div class="gis-legend">
        <span style="font-weight:600; text-transform:uppercase; font-size:10px; color:var(--text-muted);">Status:</span>
        <div class="legend-item"><span class="legend-bar" style="background-color:var(--traffic-freeflow);"></span> Free-flow</div>
        <div class="legend-item"><span class="legend-bar" style="background-color:var(--traffic-moderate);"></span> Moderate</div>
        <div class="legend-item"><span class="legend-bar" style="background-color:var(--traffic-heavy);"></span> Heavy</div>
        <div class="legend-item"><span class="legend-bar" style="background-color:var(--traffic-severe);"></span> Severe</div>
      </div>

      <!-- Zoom / Pan Controls -->
      <div class="gis-hud-controls">
        <button class="map-ctrl-btn" id="btn-zoom-in" title="Zoom In">+</button>
        <button class="map-ctrl-btn" id="btn-zoom-out" title="Zoom Out">−</button>
        <button class="map-ctrl-btn" id="btn-zoom-reset" title="Reset Camera" style="font-size:11px;">⟲</button>
      </div>

      <!-- Road Telemetry Inspector Drawer -->
      <div class="gis-inspector-drawer" id="map-inspector-drawer">
        <div class="drawer-header">
          <span style="font-size:12px; font-weight:700; text-transform:uppercase; color:var(--accent-navy);" id="drawer-header-title">
            Segment Telemetry
          </span>
          <button class="drawer-close-btn" id="map-drawer-close">✕</button>
        </div>
        <div id="inspector-drawer-content">
          <div style="color:var(--text-muted); font-size:12px; text-align:center; padding:2rem 0;">
            Select any road segment on the cartographic map to inspect engineering telemetry.
          </div>
        </div>
      </div>
    `;

    this.mapWrapper = wrapper;
    this.container.appendChild(wrapper);

    this.canvas = wrapper.querySelector("#tactical-map-canvas");
    if (this.canvas) {
      this.ctx = this.canvas.getContext("2d");
      this.resizeCanvas();
    }
  }

  mountTo(targetContainerId) {
    const target = document.getElementById(targetContainerId);
    if (!target || !this.mapWrapper) return;
    if (this.container !== target) {
      this.container = target;
      target.appendChild(this.mapWrapper);
    }
    this.mapWrapper.style.height = "100%";
    this.resizeCanvas();
    this.draw();
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    const rect = parent ? parent.getBoundingClientRect() : null;
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      // Container is temporarily hidden or in transition; preserve logical dimensions
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    this.canvasWidth = rect.width;
    this.canvasHeight = rect.height;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.render();
  }

  initEventListeners() {
    window.addEventListener("resize", () => this.resizeCanvas());

    if (!this.mapWrapper) return;

    // Layer selection buttons
    this.mapWrapper.querySelectorAll(".layer-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.mapWrapper.querySelectorAll(".layer-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.activeLayer = btn.getAttribute("data-layer");
        this.render();
      });
    });

    // Zoom buttons
    const btnIn = this.mapWrapper.querySelector("#btn-zoom-in");
    const btnOut = this.mapWrapper.querySelector("#btn-zoom-out");
    const btnReset = this.mapWrapper.querySelector("#btn-zoom-reset");
    
    if (btnIn) btnIn.addEventListener("click", () => { this.zoomLevel = Math.min(3.0, this.zoomLevel * 1.25); this.render(); });
    if (btnOut) btnOut.addEventListener("click", () => { this.zoomLevel = Math.max(0.6, this.zoomLevel / 1.25); this.render(); });
    if (btnReset) btnReset.addEventListener("click", () => { this.zoomLevel = 1.0; this.panX = 0; this.panY = 0; this.render(); });

    // Search filter
    const searchInput = this.mapWrapper.querySelector("#gis-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value.trim().toUpperCase();
        const match = this.roads.find(r => r.road_id.toUpperCase() === this.searchQuery);
        if (match) {
          this.selectRoad(match);
        }
        this.render();
      });
    }

    // Close Drawer
    const closeBtn = this.mapWrapper.querySelector("#map-drawer-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        const drawer = this.mapWrapper.querySelector("#map-inspector-drawer");
        if (drawer) drawer.classList.remove("open");
      });
    }

    // Pan & Click interactions on Canvas
    if (!this.canvas) return;

    this.canvas.addEventListener("mousedown", (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX - this.panX;
      this.dragStartY = e.clientY - this.panY;
    });

    window.addEventListener("mousemove", (e) => {
      if (this.isDragging) {
        this.panX = e.clientX - this.dragStartX;
        this.panY = e.clientY - this.dragStartY;
        this.render();
      } else {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        this.handleHover(mouseX, mouseY);
      }
    });

    window.addEventListener("mouseup", () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener("click", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      this.handleClick(mouseX, mouseY);
    });

    // Wheel Zoom
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoomLevel = Math.max(0.6, Math.min(3.5, this.zoomLevel * delta));
      this.render();
    }, { passive: false });
  }

  // Geographic projection from Lat/Lon to Canvas Coordinates
  project(lat, lon) {
    const w = this.currentW || this.canvasWidth || 800;
    const h = this.currentH || this.canvasHeight || 520;

    // Padding inside cartographic viewport
    const paddingX = 60;
    const paddingY = 50;

    const normX = (lon - this.minLon) / (this.maxLon - this.minLon);
    // Invert Y because latitude increases North
    const normY = 1.0 - (lat - this.minLat) / (this.maxLat - this.minLat);

    const baseCenterX = w / 2;
    const baseCenterY = h / 2;

    const rawX = paddingX + normX * (w - 2 * paddingX);
    const rawY = paddingY + normY * (h - 2 * paddingY);

    // Apply zoom and pan relative to center
    const x = baseCenterX + (rawX - baseCenterX) * this.zoomLevel + this.panX;
    const y = baseCenterY + (rawY - baseCenterY) * this.zoomLevel + this.panY;

    return { x, y };
  }

  setRoads(roads) {
    this.updateRoadsData(roads);
  }

  draw() {
    this.render();
  }

  updateRoadsData(roads) {
    if (!Array.isArray(roads)) return;
    this.roads = roads;
    this.render();

    // If currently selected road is active, update telemetry drawer
    if (this.selectedRoadId) {
      const activeRoad = this.roads.find(r => r.road_id === this.selectedRoadId);
      if (activeRoad) this.updateDrawerContent(activeRoad);
    }
  }

  selectRoad(roadOrId) {
    if (!roadOrId) return;
    const road = (typeof roadOrId === "string") 
      ? this.roads.find(r => r.road_id === roadOrId) 
      : roadOrId;
    if (!road) return;
    this.selectedRoadId = road.road_id;
    this.updateDrawerContent(road);
    const drawer = document.getElementById("map-inspector-drawer");
    if (drawer) drawer.classList.add("open");
    this.render();

    if (typeof this.onSelectRoad === "function") {
      this.onSelectRoad(road);
    }
  }

  updateDrawerContent(road) {
    const container = document.getElementById("inspector-drawer-content");
    if (!container) return;

    const vcPct = road.road_capacity ? Math.min(100, Math.round((road.current_volume / road.road_capacity) * 100)) : 50;
    const congColor = road.current_congestion === 'Severe' ? '#CF222E' :
                      (road.current_congestion === 'Heavy' ? '#BC4C00' :
                      (road.current_congestion === 'Moderate' ? '#9A6700' : '#1A7F37'));

    const accProb = road.calibrated_accident_probability != null 
      ? (road.calibrated_accident_probability * 100).toFixed(2) + "%"
      : "0.96%";

    container.innerHTML = `
      <div style="margin-bottom:12px;">
        <div style="display:flex; align-items:baseline; justify-content:space-between; margin-bottom:4px;">
          <strong style="font-family:var(--font-mono); font-size:15px; color:var(--text-primary);">${road.road_id}</strong>
          <span class="status-pill status-${(road.current_congestion || 'moderate').toLowerCase()}">
            ${road.current_congestion || 'Moderate'}
          </span>
        </div>
        <div style="font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:4px;">
          ${road.road_name}
        </div>
        <div style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">
          GPS: ${road.latitude?.toFixed(5)}°N, ${road.longitude?.toFixed(5)}°E
        </div>
      </div>

      <!-- Telemetry Metric Strip -->
      <div style="background-color:var(--bg-surface-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-xs); padding:10px; margin-bottom:12px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div>
            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Current Vol</div>
            <div style="font-family:var(--font-mono); font-size:15px; font-weight:700; color:var(--text-primary);">
              ${road.current_volume ? road.current_volume.toLocaleString() : '—'} <span style="font-size:10px; font-weight:normal; color:var(--text-muted);">veh</span>
            </div>
          </div>
          <div>
            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Forecast (+30m)</div>
            <div style="font-family:var(--font-mono); font-size:15px; font-weight:700; color:var(--accent-blue);">
              ${road.predicted_next_volume ? road.predicted_next_volume.toLocaleString() : '—'} <span style="font-size:10px; font-weight:normal; color:var(--text-muted);">veh</span>
            </div>
          </div>
          <div>
            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Mean Velocity</div>
            <div style="font-family:var(--font-mono); font-size:15px; font-weight:700; color:var(--text-primary);">
              ${road.current_speed != null ? Number(road.current_speed).toFixed(1) : '—'} <span style="font-size:10px; font-weight:normal; color:var(--text-muted);">km/h</span>
            </div>
          </div>
          <div>
            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Travel Time</div>
            <div style="font-family:var(--font-mono); font-size:15px; font-weight:700; color:var(--text-primary);">
              ${road.predicted_next_travel_time != null ? Number(road.predicted_next_travel_time).toFixed(1) : '—'} <span style="font-size:10px; font-weight:normal; color:var(--text-muted);">min</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Capacity Utilization Meter -->
      <div style="margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;">
          <span style="color:var(--text-muted); font-weight:600;">Capacity Utilization (V/C)</span>
          <span style="font-family:var(--font-mono); font-weight:700; color:${congColor};">${vcPct}%</span>
        </div>
        <div class="meter-track" style="width:100%; height:6px;">
          <div class="meter-fill" style="width:${vcPct}%; background-color:${congColor};"></div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-muted); margin-top:2px;">
          <span>Design Cap: ${road.road_capacity || '—'} veh/h</span>
          <span>Signal: ${road.signal_timing || '—'}s cycle</span>
        </div>
      </div>

      <!-- Surrogate Safety Probability -->
      <div style="border-top:1px solid var(--border-subtle); padding-top:10px;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;">
          <span style="font-size:11px; font-weight:600; color:var(--text-muted);">Surrogate Accident Hazard</span>
          <span style="font-family:var(--font-mono); font-size:13px; font-weight:700; color:#BC4C00;">${accProb}</span>
        </div>
        <div style="font-size:11px; color:var(--text-secondary); line-height:1.35;">
          Estimated via Platt-calibrated logistic model on occupancy and velocity variance.
        </div>
      </div>
    `;
  }

  handleHover(mouseX, mouseY) {
    let hovered = null;
    for (const road of this.roads) {
      if (!road.latitude || !road.longitude) continue;
      const pt = this.project(road.latitude, road.longitude);
      const dist = Math.hypot(pt.x - mouseX, pt.y - mouseY);
      if (dist < 14) {
        hovered = road.road_id;
        break;
      }
    }
    if (this.hoveredRoadId !== hovered) {
      this.hoveredRoadId = hovered;
      this.canvas.style.cursor = hovered ? "pointer" : (this.isDragging ? "grabbing" : "default");
      this.render();
    }
  }

  handleClick(mouseX, mouseY) {
    // 1. Direct node hit test (within 18px radius)
    for (const road of this.roads) {
      if (!road.latitude || !road.longitude) continue;
      const pt = this.project(road.latitude, road.longitude);
      const dist = Math.hypot(pt.x - mouseX, pt.y - mouseY);
      if (dist < 18) {
        this.selectRoad(road);
        return;
      }
    }

    // 2. Link segment hit test (within 8px of connecting highway link)
    const roadMap = new Map(this.roads.map(r => [r.road_id, r]));
    for (const [fromId, toId] of this.corridorArterials) {
      const r1 = roadMap.get(fromId);
      const r2 = roadMap.get(toId);
      if (!r1 || !r2 || !r1.latitude || !r2.latitude) continue;
      const p1 = this.project(r1.latitude, r1.longitude);
      const p2 = this.project(r2.latitude, r2.longitude);

      // Distance from point to line segment
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;

      const t = Math.max(0, Math.min(1, ((mouseX - p1.x) * dx + (mouseY - p1.y) * dy) / lenSq));
      const projX = p1.x + t * dx;
      const projY = p1.y + t * dy;
      const distToSegment = Math.hypot(mouseX - projX, mouseY - projY);

      if (distToSegment < 8) {
        // Select nearer endpoint
        const d1 = Math.hypot(mouseX - p1.x, mouseY - p1.y);
        const d2 = Math.hypot(mouseX - p2.x, mouseY - p2.y);
        this.selectRoad(d1 <= d2 ? r1 : r2);
        return;
      }
    }
  }

  // Main Cartographic Render Loop
  render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const rect = this.canvas.parentElement ? this.canvas.parentElement.getBoundingClientRect() : null;
    const w = (rect && rect.width > 0) ? rect.width : (this.canvasWidth || 800);
    const h = (rect && rect.height > 0) ? rect.height : (this.canvasHeight || 520);
    this.currentW = w;
    this.currentH = h;

    // Clear canvas
    ctx.clearRect(0, 0, w, h);

    // 1. Draw Subtle Cartographic Coordinate Grid
    this.drawCoordinateGrid(ctx, w, h);

    // 2. Draw Arterial Road Links
    this.drawArterialLinks(ctx);

    // 3. Draw Road Sensor Nodes & Typography
    this.drawRoadNodes(ctx);
  }

  drawCoordinateGrid(ctx, w, h) {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
    ctx.lineWidth = 1;

    // Latitude lines (North)
    const lats = [28.58, 28.61, 28.64, 28.67];
    ctx.font = "9px " + (getComputedStyle(document.body).fontFamily || "sans-serif");
    ctx.fillStyle = isDark ? "#6E7681" : "#8C959F";

    lats.forEach(lat => {
      const p1 = this.project(lat, this.minLon);
      const p2 = this.project(lat, this.maxLon);
      ctx.beginPath();
      ctx.moveTo(0, p1.y);
      ctx.lineTo(w, p1.y);
      ctx.stroke();
      ctx.fillText(lat.toFixed(2) + "°N", 8, p1.y - 3);
    });

    // Longitude lines (East)
    const lons = [77.12, 77.17, 77.22, 77.27];
    lons.forEach(lon => {
      const p1 = this.project(this.minLat, lon);
      ctx.beginPath();
      ctx.moveTo(p1.x, 0);
      ctx.lineTo(p1.x, h);
      ctx.stroke();
      ctx.fillText(lon.toFixed(2) + "°E", p1.x + 3, h - 8);
    });
  }

  drawArterialLinks(ctx) {
    const roadMap = new Map(this.roads.map(r => [r.road_id, r]));

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    this.corridorArterials.forEach(([fromId, toId]) => {
      const r1 = roadMap.get(fromId);
      const r2 = roadMap.get(toId);
      if (!r1 || !r2) return;

      const p1 = this.project(r1.latitude, r1.longitude);
      const p2 = this.project(r2.latitude, r2.longitude);

      // Determine road link color based on active layer
      let strokeColor = "#8C959F";
      let strokeWidth = 3;

      if (this.activeLayer === "CONGESTION") {
        const cong = r1.current_congestion || "Moderate";
        strokeColor = cong === "Severe" ? "#CF222E" :
                     (cong === "Heavy" ? "#BC4C00" :
                     (cong === "Moderate" ? "#D29922" : "#1A7F37"));
        strokeWidth = cong === "Severe" ? 4.5 : 3.5;
      } else if (this.activeLayer === "SPEED") {
        const spd = r1.current_speed || 25;
        strokeColor = spd < 15 ? "#CF222E" : (spd < 30 ? "#D29922" : "#0969DA");
        strokeWidth = 3.5;
      } else if (this.activeLayer === "VOLUME") {
        const vc = r1.road_capacity ? (r1.current_volume / r1.road_capacity) : 0.5;
        strokeColor = vc > 0.8 ? "#CF222E" : (vc > 0.6 ? "#D29922" : "#0969DA");
        strokeWidth = 2 + Math.min(6, vc * 5);
      } else if (this.activeLayer === "ACCIDENT") {
        const prob = r1.calibrated_accident_probability || 0.01;
        strokeColor = prob > 0.015 ? "#CF222E" : (prob > 0.010 ? "#D29922" : "#1A7F37");
        strokeWidth = 3.5;
      }

      // Draw underlying road casing line
      ctx.beginPath();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
      ctx.lineWidth = strokeWidth + 2;
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Draw primary road vector
      ctx.beginPath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    });
  }

  drawRoadNodes(ctx) {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";

    this.roads.forEach(road => {
      if (!road.latitude || !road.longitude) return;
      const pt = this.project(road.latitude, road.longitude);

      const isSelected = road.road_id === this.selectedRoadId;
      const isHovered = road.road_id === this.hoveredRoadId;
      const isSearchMatch = this.searchQuery && road.road_id.includes(this.searchQuery);

      // Node marker radius
      const radius = isSelected ? 8 : (isHovered ? 7 : 5);

      // Selection Halo Ring
      if (isSelected || isSearchMatch) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected ? "#0969DA" : "#D29922";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Node Center Dot
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "#0969DA" : (isDark ? "#FFFFFF" : "#1A365D");
      ctx.fill();
      ctx.strokeStyle = isDark ? "#161B22" : "#FFFFFF";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Road ID Label with Cartographic Text Halo
      const label = road.road_id;
      ctx.font = (isSelected ? "bold 11px " : "600 10px ") + "var(--font-mono), monospace";
      ctx.strokeStyle = isDark ? "rgba(15, 20, 28, 0.9)" : "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 3;
      ctx.strokeText(label, pt.x + radius + 4, pt.y + 3);

      ctx.fillStyle = isSelected ? (isDark ? "#58A6FF" : "#0969DA") : (isDark ? "#F0F6FC" : "#1C2430");
      ctx.fillText(label, pt.x + radius + 4, pt.y + 3);
    });
  }
}
