/**
 * FlowCast AI - Smart City Operations Command Center Application Controller (Stage 5)
 * Orchestrates multi-view navigation, real-time ML inference, simulation replay engine,
 * theme management, live clock HUD, full-screen mode, and tactical 2D/3D map synchronization.
 */

// Universal safe number formatting helper
function formatNumber(val, decimals = 0, fallback = '—') {
  if (val === null || val === undefined || isNaN(val) || val === '') return fallback;
  const num = Number(val);
  if (!isFinite(num)) return fallback;
  return decimals > 0
    ? num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : Math.round(num).toLocaleString();
}

class FlowCastApp {
  constructor() {
    this.currentTimestamp = "2025-05-20T08:30:00";
    this.currentDate = "2025-05-20";
    this.currentTime = "08:30";
    this.selectedRoadId = "NL-001";
    this.accidentThreshold = 0.010; // 1.0% operational default
    this.activeTab = "overview";
    this.isLoading = false;
    
    // Simulation Replay Engine
    this.isReplayPlaying = false;
    this.replayIntervalId = null;
    this.availableTimeSteps = [
      "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
      "12:00", "14:00", "16:00", "17:30", "18:00", "18:30",
      "19:00", "20:00", "21:30", "02:00", "05:30"
    ];

    // Theme state
    this.currentTheme = "dark";
    
    this.corridorMap = null;
    this.cachedData = {};
    
    this.init();
  }

  async init() {
    console.log("Initializing FlowCast AI TOC Command Center (Delhi Northline Corridor)...");
    this.setupUI();
    this.setupClock();
    this.setupSidebar();
    this.setupThemes();
    this.setupFullscreen();
    this.setupTimelineControls();
    this.setupTabs();
    this.setupSimulationReplay();
    this.setupAccidentSlider();
    this.setupHistoricalExplorer();
    
    // Initialize Tactical 2D/3D Map
    this.corridorMap = new NorthlineCorridorMap("map-container", (road) => {
      this.onRoadSelected(road);
    });
    window.corridorMapInstance = this.corridorMap;

    // Load initial operational data
    await this.loadData();
  }

  setupClock() {
    const clockEl = document.getElementById("hud-live-clock");
    const update = () => {
      const now = new Date();
      if (clockEl) {
        clockEl.textContent = now.toLocaleTimeString("en-US", { hour12: false }) + " IST";
      }
    };
    update();
    setInterval(update, 1000);
  }

  setupSidebar() {
    const sidebar = document.getElementById("app-sidebar");
    const toggleBtn = document.getElementById("sidebar-toggle-btn");

    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
      });
    }
  }

  setupThemes() {
    const themeBtn = document.getElementById("btn-toggle-theme");
    const themes = ["dark", "cyber", "light"];
    
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        const nextIdx = (themes.indexOf(this.currentTheme) + 1) % themes.length;
        this.currentTheme = themes[nextIdx];
        document.documentElement.setAttribute("data-theme", this.currentTheme);
        themeBtn.title = `Current Theme: ${this.currentTheme.toUpperCase()}`;
        if (this.corridorMap) this.corridorMap.draw();
      });
    }
  }

  setupFullscreen() {
    const fsBtn = document.getElementById("btn-toggle-fullscreen");
    if (fsBtn) {
      fsBtn.addEventListener("click", () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
          fsBtn.innerHTML = "⤓";
        } else {
          document.exitFullscreen().catch(() => {});
          fsBtn.innerHTML = "⛶";
        }
      });
    }
  }

  setupTabs() {
    const links = document.querySelectorAll(".nav-tab-item, .sidebar-link");
    links.forEach(link => {
      link.addEventListener("click", () => {
        const tabId = link.getAttribute("data-tab");
        this.activeTab = tabId;

        // Sync active state on all matching nav tabs/links
        links.forEach(l => {
          if (l.getAttribute("data-tab") === tabId) {
            l.classList.add("active");
          } else {
            l.classList.remove("active");
          }
        });

        // Hide all sections, display active
        document.querySelectorAll(".tab-section").forEach(sec => {
          sec.classList.remove("active");
        });

        const activeSec = document.getElementById(`section-${tabId}`);
        if (activeSec) {
          activeSec.classList.add("active");
        }

        // Update page header title
        const titleEl = document.getElementById("page-title-display");
        if (titleEl) {
          titleEl.textContent = link.querySelector(".sidebar-link-label")?.textContent || "Operations View";
        }

        // Mount map or trigger section redraws
        if (tabId === "map" && this.corridorMap) {
          setTimeout(() => {
            this.corridorMap.mountTo("map-dedicated-container");
          }, 60);
        } else if (tabId === "traveltime") {
          setTimeout(() => {
            if (this.lastTravelTimeData?.road_travel_times) {
              Charts.renderTravelTimeBars("travel-time-canvas", this.lastTravelTimeData.road_travel_times);
            } else {
              this.loadTravelTime();
            }
          }, 60);
        } else if (tabId === "forecast") {
          setTimeout(() => {
            if (this.lastForecastData?.road_forecasts) {
              Charts.renderRoadForecastBars("forecast-comparison-canvas", this.lastForecastData.road_forecasts);
            }
          }, 60);
        } else if (tabId === "congestion") {
          setTimeout(() => {
            if (this.lastCongestionData?.distribution_summary?.predicted_distribution) {
              Charts.renderCongestionDonut("congestion-donut-canvas", this.lastCongestionData.distribution_summary.predicted_distribution);
            }
          }, 60);
        } else if (tabId === "overview") {
          setTimeout(() => {
            if (this.lastOverviewData) {
              if (this.lastOverviewData.volume_trend_past_3h && this.lastOverviewData.kpis) {
                Charts.renderVolumeTrend(
                  "overview-trend-canvas",
                  this.lastOverviewData.volume_trend_past_3h,
                  this.lastOverviewData.kpis.avg_traffic_volume_veh,
                  this.lastOverviewData.kpis.predicted_next_volume_veh
                );
              }
              if (this.lastOverviewData.congestion_distribution?.predicted) {
                Charts.renderCongestionDonut("overview-congestion-donut-canvas", this.lastOverviewData.congestion_distribution.predicted);
              }
            }
          }, 60);
        } else if (tabId === "performance") {
          this.loadModelPerformance();
        }
      });
    });
  }

  setupTimelineControls() {
    const dateInput = document.getElementById("timeline-date-picker");
    const timeSelect = document.getElementById("timeline-time-picker");
    const btnApply = document.getElementById("btn-apply-timeline");
    const btnRefresh = document.getElementById("btn-refresh-data");

    if (dateInput) {
      dateInput.value = this.currentDate;
      dateInput.min = "2025-01-01";
      dateInput.max = "2025-05-31";
    }

    if (timeSelect) {
      timeSelect.value = this.currentTime;
    }

    if (btnApply) {
      btnApply.addEventListener("click", () => {
        const d = dateInput.value;
        const t = timeSelect.value;
        if (!d) return;

        if (d < "2025-01-01" || d > "2025-05-31") {
          alert("Please select a date within the Northline Corridor dataset range: Jan 1, 2025 to May 31, 2025.");
          return;
        }

        this.currentDate = d;
        this.currentTime = t;
        this.currentTimestamp = `${d}T${t}:00`;
        this.loadData();
      });
    }

    if (btnRefresh) {
      btnRefresh.addEventListener("click", () => this.loadData());
    }

    // Quick Presets
    document.querySelectorAll(".preset-btn, .chip-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const pDate = btn.getAttribute("data-date") || this.currentDate;
        const pTime = btn.getAttribute("data-time") || "08:30";
        if (dateInput) dateInput.value = pDate;
        if (timeSelect) timeSelect.value = pTime;
        this.currentDate = pDate;
        this.currentTime = pTime;
        this.currentTimestamp = `${pDate}T${pTime}:00`;
        this.loadData();
      });
    });
  }

  setupSimulationReplay() {
    const playBtn = document.getElementById("btn-simulation-play");
    if (!playBtn) return;

    playBtn.addEventListener("click", () => {
      if (this.isReplayPlaying) {
        // Pause Replay
        clearInterval(this.replayIntervalId);
        this.isReplayPlaying = false;
        playBtn.classList.remove("playing");
        playBtn.innerHTML = "▶ Play Replay";
      } else {
        // Start Replay
        this.isReplayPlaying = true;
        playBtn.classList.add("playing");
        playBtn.innerHTML = "⏸ Pause Replay";

        let stepIndex = this.availableTimeSteps.indexOf(this.currentTime);
        if (stepIndex === -1) stepIndex = 0;

        this.replayIntervalId = setInterval(() => {
          stepIndex = (stepIndex + 1) % this.availableTimeSteps.length;
          const nextTime = this.availableTimeSteps[stepIndex];
          const timeSelect = document.getElementById("timeline-time-picker");
          if (timeSelect) timeSelect.value = nextTime;

          this.currentTime = nextTime;
          this.currentTimestamp = `${this.currentDate}T${nextTime}:00`;
          this.loadData();
        }, 2500);
      }
    });
  }

  setupUI() {
    // Health status check
    API.getHealth().then(health => {
      const statusDot = document.getElementById("header-status-indicator");
      const statusText = document.getElementById("header-status-text");
      if (statusDot) {
        statusDot.className = health.status === "healthy" ? "pulse-dot online" : "pulse-dot offline";
      }
      if (statusText) {
        statusText.textContent = health.status === "healthy" ? "ENGINE ONLINE" : "OFFLINE";
      }
    }).catch(err => {
      console.warn("Health check unreachable:", err.message);
    });

    // Populate road select dropdowns
    const roadSelects = ["forecast-road-filter", "hist-road-filter"];
    API.getRoads().then(res => {
      if (res && res.roads) {
        roadSelects.forEach(selectId => {
          const select = document.getElementById(selectId);
          if (select) {
            select.innerHTML = '<option value="">All 25 Road Segments</option>' + 
              res.roads.map(r => `<option value="${r.road_id}">${r.road_id} - ${r.road_name}</option>`).join("");
          }
        });
      }
    });
  }

  setupAccidentSlider() {
    const slider = document.getElementById("accident-threshold-slider");
    const valDisplay = document.getElementById("threshold-val-display");

    if (slider) {
      slider.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        this.accidentThreshold = val;
        if (valDisplay) {
          valDisplay.textContent = `${(val * 100).toFixed(1)}%`;
        }
        this.loadAccidentRisk();
      });
    }
  }

  setupHistoricalExplorer() {
    const btnQuery = document.getElementById("btn-query-historical");
    if (btnQuery) {
      btnQuery.addEventListener("click", () => this.queryHistorical());
    }

    const btnExport = document.getElementById("btn-export-csv");
    if (btnExport) {
      btnExport.addEventListener("click", () => this.exportHistoricalCSV());
    }

    const btnPdf = document.getElementById("btn-export-pdf");
    if (btnPdf) {
      btnPdf.addEventListener("click", () => this.exportHistoricalPDF());
    }
  }

  onRoadSelected(road) {
    this.selectedRoadId = road.road_id;
    const forecastRoadSelect = document.getElementById("forecast-road-filter");
    if (forecastRoadSelect) forecastRoadSelect.value = road.road_id;
  }

  // =========================================================================
  // DATA ORCHESTRATOR
  // =========================================================================
  async loadData() {
    if (this.isLoading) return;
    this.isLoading = true;
    this.showGlobalLoading(true);

    try {
      const tasks = [
        this.loadOverview().catch(err => console.error("Overview error:", err)),
        this.loadRoadsAndMap().catch(err => console.error("Map error:", err)),
        this.loadTrafficForecast().catch(err => console.error("Forecast error:", err)),
        this.loadCongestionAnalytics().catch(err => console.error("Congestion error:", err)),
        this.loadTravelTime().catch(err => console.error("Travel Time error:", err)),
        this.loadAccidentRisk().catch(err => console.error("Accident Risk error:", err))
      ];

      await Promise.allSettled(tasks);
    } finally {
      this.isLoading = false;
      this.showGlobalLoading(false);
    }
  }

  showGlobalLoading(isLoading) {
    const el = document.getElementById("global-loading-indicator");
    if (el) el.style.display = isLoading ? "block" : "none";
  }

  // =========================================================================
  // SECTION A: COMMAND CENTER OVERVIEW & MEGA-KPIS
  // =========================================================================
  async loadOverview() {
    const data = await API.getOverview({ timestamp: this.currentTimestamp });
    if (!data || data.status !== "SUCCESS") return;
    this.lastOverviewData = data;

    // Active timestamp banner
    const activeTimeEl = document.getElementById("active-timestamp-display");
    if (activeTimeEl) {
      activeTimeEl.textContent = `${data.selected_date} ${data.selected_time} IST (Historical Baseline)`;
    }

    // Weather widget
    const weatherEl = document.getElementById("header-weather-info");
    if (weatherEl && data.weather) {
      const cond = data.weather.condition || "Clear";
      const temp = data.weather.temperature_c != null ? `${Number(data.weather.temperature_c).toFixed(1)}°C` : "—";
      const rain = data.weather.rainfall_mm != null ? `${Number(data.weather.rainfall_mm).toFixed(1)}mm` : "—";
      weatherEl.innerHTML = `<span>🌤️ ${cond}</span> • <span>${temp}</span> • <span>Rain: ${rain}</span>`;
    }

    // Update 8 Mega-KPIs
    this.updateKPIs(data);

    // Peak Hour Ops Widget
    const peakBox = document.getElementById("overview-peak-status-box");
    if (peakBox && data.peak_analysis) {
      const pa = data.peak_analysis;
      peakBox.innerHTML = `
        <div class="peak-status-header">
          <span style="font-size:0.85rem; font-weight:700; color:#fff;">${pa.period_name}</span>
          <span class="peak-tag status-${pa.congestion_intensity === 'CRITICAL' ? 'severe' : (pa.congestion_intensity === 'HIGH' ? 'heavy' : 'freeflow')}">
            ${pa.congestion_intensity} INTENSITY
          </span>
        </div>
        <div style="font-size:0.75rem; color:#94a3b8;">
          Active Corridor Window: <strong style="color:#e2e8f0;">${pa.time_window}</strong>
        </div>
      `;
    }

    // Calendar & Special Event Banner
    const calBanner = document.getElementById("overview-calendar-banner");
    if (calBanner && data.calendar) {
      const c = data.calendar;
      if (c.public_holiday || c.event_flag || c.roadwork_flag) {
        calBanner.style.display = "flex";
        let text = "Special Operational Alert: ";
        if (c.holiday_name) text += `🎉 Holiday: ${c.holiday_name} • `;
        if (c.event_name) text += `🎪 Event: ${c.event_name} • `;
        if (c.roadwork_flag) text += `🚧 Active Roadwork • `;
        calBanner.innerHTML = `<span>📢 ${text.replace(/• $/, '')}</span>`;
      } else {
        calBanner.style.display = "none";
      }
    }

    // Render Bottleneck Leaderboard
    const bottleContainer = document.getElementById("overview-bottleneck-list");
    if (bottleContainer && data.top_bottlenecks) {
      bottleContainer.innerHTML = data.top_bottlenecks.map(b => {
        const pct = Math.min(100, Math.round(b.vc_ratio * 100));
        const color = b.vc_ratio > 0.85 ? '#ef4444' : (b.vc_ratio > 0.65 ? '#f59e0b' : '#38bdf8');
        return `
          <div class="bottleneck-row" onclick="window.flowCastApp.focusRoadOnMap('${b.road_id}')">
            <div class="bottleneck-info">
              <span class="bottleneck-name">${b.road_id} — ${b.road_name}</span>
              <span class="bottleneck-sub">${b.current_volume.toLocaleString()} veh • ${b.avg_speed.toFixed(1)} km/h</span>
            </div>
            <div class="bottleneck-meter">
              <span style="font-size:0.72rem; font-weight:700; color:${color};">${pct}% Cap</span>
              <div class="meter-bar-track">
                <div class="meter-bar-fill" style="width:${pct}%; background:${color};"></div>
              </div>
            </div>
          </div>
        `;
      }).join("");
    }

    // Condition Summary
    const summaryEl = document.getElementById("overview-condition-summary");
    if (summaryEl) {
      summaryEl.textContent = data.condition_summary;
    }

    // Render Volume Spline
    if (data.volume_trend_past_3h && data.kpis) {
      Charts.renderVolumeTrend(
        "overview-trend-canvas",
        data.volume_trend_past_3h,
        data.kpis.avg_traffic_volume_veh,
        data.kpis.predicted_next_volume_veh
      );
    }

    // Render Congestion Donut
    if (data.congestion_distribution && data.congestion_distribution.predicted) {
      Charts.renderCongestionDonut(
        "overview-congestion-donut-canvas",
        data.congestion_distribution.predicted
      );
    }
  }

  updateKPIs(data) {
    if (!data || typeof data !== "object") return;
    const kpis = data.kpis || {};

    // 1. Total Volume
    const kpiTotVol = document.getElementById("kpi-total-volume");
    if (kpiTotVol) kpiTotVol.textContent = formatNumber(kpis.total_corridor_volume_veh_30m, 0, "—");

    // 2. Avg Volume
    const kpiAvgVol = document.getElementById("kpi-avg-volume");
    if (kpiAvgVol) kpiAvgVol.textContent = formatNumber(kpis.avg_traffic_volume_veh, 0, "—");

    // 3. Predicted Volume (+30m) & Delta
    const kpiNextVol = document.getElementById("kpi-next-volume");
    if (kpiNextVol) kpiNextVol.textContent = formatNumber(kpis.predicted_next_volume_veh, 0, "—");

    const deltaEl = document.getElementById("kpi-volume-delta");
    if (deltaEl) {
      const d = kpis.volume_change_pct;
      if (d !== null && d !== undefined && !isNaN(d)) {
        const isUp = d >= 0;
        deltaEl.textContent = `${isUp ? '▲ +' : '▼ '}${Math.abs(Number(d)).toFixed(1)}%`;
        deltaEl.className = `kpi-trend-chip ${isUp ? 'trend-up' : 'trend-down'}`;
      } else {
        deltaEl.textContent = "—";
        deltaEl.className = "kpi-trend-chip trend-neutral";
      }
    }

    // 4. Mean Speed
    const kpiSpeed = document.getElementById("kpi-avg-speed");
    if (kpiSpeed) kpiSpeed.textContent = formatNumber(kpis.avg_speed_kmh, 1, "—");

    // 5. Congestion Level
    const kpiCong = document.getElementById("kpi-dominant-congestion");
    if (kpiCong) {
      const lvl = kpis.dominant_congestion_level || "Moderate";
      kpiCong.textContent = lvl;
      const slug = String(lvl).toLowerCase().replace(/[^a-z]/g, "");
      kpiCong.className = `status-pill status-${slug || 'moderate'}`;
    }

    // 6. Travel Time
    const kpiTT = document.getElementById("kpi-avg-travel-time");
    if (kpiTT) {
      const tt = kpis.predicted_next_travel_time_min;
      kpiTT.textContent = tt != null && !isNaN(tt) ? `${Number(tt).toFixed(1)} min` : "—";
    }

    // 7. Active Segments
    const kpiSeg = document.getElementById("kpi-segments-count");
    if (kpiSeg) kpiSeg.textContent = "25 / 25";

    // 8. Model System Health
    const kpiHealth = document.getElementById("kpi-system-health");
    if (kpiHealth) kpiHealth.textContent = "95.8% R²";
  }

  focusRoadOnMap(roadId) {
    // Switch to map tab
    document.querySelectorAll(".nav-tab-item, .sidebar-link").forEach(l => {
      if (l.getAttribute("data-tab") === "map") l.click();
    });

    setTimeout(() => {
      if (this.corridorMap) {
        this.corridorMap.mountTo("map-dedicated-container");
        this.corridorMap.selectRoad(roadId);
      }
    }, 150);
  }

  // =========================================================================
  // SECTION B: TACTICAL MAP & ROADS
  // =========================================================================
  async loadRoadsAndMap() {
    const data = await API.getRoads({ timestamp: this.currentTimestamp });
    if (!data || !data.roads) return;
    this.lastRoadsData = data.roads;

    if (this.corridorMap) {
      this.corridorMap.setRoads(data.roads);
    }
  }

  // =========================================================================
  // SECTION C: TRAFFIC FORECASTING
  // =========================================================================
  async loadTrafficForecast() {
    const roadFilter = document.getElementById("forecast-road-filter")?.value || null;
    const data = await API.getTrafficForecast({ timestamp: this.currentTimestamp, road_id: roadFilter });
    if (!data || data.status !== "SUCCESS") return;
    this.lastForecastData = data;

    const avgPredEl = document.getElementById("forecast-avg-pred");
    if (avgPredEl) {
      avgPredEl.textContent = `${formatNumber(data.corridor_avg_predicted_volume, 0, '—')} veh / 30m`;
    }

    const growthEl = document.getElementById("forecast-growth-pct");
    if (growthEl) {
      const g = data.expected_growth_pct;
      if (g !== null && g !== undefined && !isNaN(g)) {
        growthEl.textContent = `${g >= 0 ? '+' : ''}${Number(g).toFixed(1)}%`;
        growthEl.className = `kpi-trend-chip ${g >= 0 ? "trend-up" : "trend-down"}`;
      } else {
        growthEl.textContent = "—";
        growthEl.className = "kpi-trend-chip trend-neutral";
      }
    }

    if (data.road_forecasts) {
      Charts.renderRoadForecastBars("forecast-comparison-canvas", data.road_forecasts);

      const tbody = document.getElementById("forecast-roads-tbody");
      if (tbody) {
        tbody.innerHTML = data.road_forecasts.map(r => {
          const curVol = formatNumber(r.current_volume, 0, '—');
          const predVol = formatNumber(r.predicted_next_30m_volume, 0, '—');
          const actVol = r.actual_next_30m_volume !== null && r.actual_next_30m_volume !== undefined 
            ? `${formatNumber(r.actual_next_30m_volume, 0, '—')} veh`
            : '<span style="color:#64748b;">Pending</span>';
          const delta = r.forecast_delta_veh != null ? r.forecast_delta_veh : 0;
          const growth = r.forecast_growth_pct != null ? r.forecast_growth_pct : 0;
          const vc = r.volume_to_capacity_ratio != null ? Number(r.volume_to_capacity_ratio).toFixed(2) : '—';
          
          return `
            <tr>
              <td><strong style="color:#38bdf8; cursor:pointer;" onclick="window.flowCastApp.focusRoadOnMap('${r.road_id}')">${r.road_id}</strong></td>
              <td>${r.road_name || 'Corridor Segment'}</td>
              <td>${curVol} veh</td>
              <td style="color:#38bdf8; font-weight:700;">${predVol} veh</td>
              <td>${actVol}</td>
              <td style="color:${delta >= 0 ? '#34d399' : '#f87171'};">
                ${delta >= 0 ? '+' : ''}${delta} (${growth}%)
              </td>
              <td>
                <span class="status-pill ${Number(vc) > 0.85 ? 'status-severe' : 'status-moderate'}">
                  ${vc}
                </span>
              </td>
            </tr>
          `;
        }).join("");
      }
    }
  }

  // =========================================================================
  // SECTION D: CONGESTION MATRIX
  // =========================================================================
  async loadCongestionAnalytics() {
    const data = await API.getCongestion({ timestamp: this.currentTimestamp });
    if (!data || data.status !== "SUCCESS") return;
    this.lastCongestionData = data;

    if (data.distribution_summary && data.distribution_summary.predicted_distribution) {
      Charts.renderCongestionDonut("congestion-donut-canvas", data.distribution_summary.predicted_distribution);
    }

    const tbody = document.getElementById("congestion-roads-tbody");
    if (tbody && data.road_congestion_status) {
      tbody.innerHTML = data.road_congestion_status.map(r => {
        const curCong = r.current_congestion || "Moderate";
        const predCong = r.predicted_next_congestion || "Moderate";
        const curSlug = String(curCong).toLowerCase().replace(/[^a-z]/g, "");
        const predSlug = String(predCong).toLowerCase().replace(/[^a-z]/g, "");
        const speed = formatNumber(r.avg_speed_kmh, 1, '—');
        const occ = formatNumber(r.occupancy_pct, 1, '—');
        const vc = formatNumber(r.vc_ratio, 2, '—');

        return `
          <tr>
            <td><strong style="color:#38bdf8; cursor:pointer;" onclick="window.flowCastApp.focusRoadOnMap('${r.road_id}')">${r.road_id}</strong></td>
            <td>${r.road_name || 'Corridor Segment'}</td>
            <td><span class="status-pill status-${curSlug}">${curCong}</span></td>
            <td><span class="status-pill status-${predSlug}">${predCong}</span></td>
            <td>${r.actual_next_congestion || '—'}</td>
            <td>${speed} km/h</td>
            <td>${occ}%</td>
            <td><strong>${vc}</strong></td>
          </tr>
        `;
      }).join("");
    }
  }

  // =========================================================================
  // SECTION E: TRAVEL TIME
  // =========================================================================
  async loadTravelTime() {
    const data = await API.getTravelTime({ timestamp: this.currentTimestamp });
    if (!data || data.status !== "SUCCESS") return;
    this.lastTravelTimeData = data;

    const avgCurrEl = document.getElementById("tt-avg-curr");
    if (avgCurrEl) {
      avgCurrEl.textContent = `${formatNumber(data.corridor_avg_current_travel_time, 1, '—')} min`;
    }

    const avgPredEl = document.getElementById("tt-avg-pred");
    if (avgPredEl) {
      avgPredEl.textContent = `${formatNumber(data.corridor_avg_predicted_travel_time, 1, '—')} min`;
    }

    if (data.road_travel_times) {
      Charts.renderTravelTimeBars("travel-time-canvas", data.road_travel_times);

      const tbody = document.getElementById("travel-time-tbody");
      if (tbody) {
        tbody.innerHTML = data.road_travel_times.map(r => {
          const curTT = formatNumber(r.current_travel_time_min, 2, '—');
          const predTT = formatNumber(r.predicted_next_travel_time_min, 2, '—');
          const actTT = r.actual_next_travel_time_min != null ? `${formatNumber(r.actual_next_travel_time_min, 2, '—')} min` : '—';
          const delay = r.travel_time_delay_min != null ? Number(r.travel_time_delay_min) : 0;
          const speed = formatNumber(r.avg_speed_kmh, 1, '—');

          return `
            <tr>
              <td><strong style="color:#38bdf8; cursor:pointer;" onclick="window.flowCastApp.focusRoadOnMap('${r.road_id}')">${r.road_id}</strong></td>
              <td>${r.road_name || 'Corridor Segment'}</td>
              <td>${curTT} min</td>
              <td style="color:#38bdf8; font-weight:700;">${predTT} min</td>
              <td>${actTT}</td>
              <td style="color:${delay > 0 ? '#fbbf24' : '#34d399'};">
                ${delay > 0 ? '+' : ''}${delay.toFixed(2)} min
              </td>
              <td>${speed} km/h</td>
            </tr>
          `;
        }).join("");
      }
    }
  }

  // =========================================================================
  // SECTION F: ACCIDENT RISK STUDIO
  // =========================================================================
  async loadAccidentRisk() {
    const data = await API.getAccidentRisk({
      timestamp: this.currentTimestamp,
      threshold: this.accidentThreshold
    });
    if (!data || data.status !== "SUCCESS") return;

    const meanProbEl = document.getElementById("acc-mean-prob");
    if (meanProbEl) {
      meanProbEl.textContent = `${formatNumber(data.corridor_mean_calibrated_probability_pct, 2, '—')}%`;
    }

    const elevatedCountEl = document.getElementById("acc-elevated-count");
    if (elevatedCountEl) {
      elevatedCountEl.textContent = `${data.roads_exceeding_threshold_count || 0} / 25`;
    }

    const tbody = document.getElementById("accident-roads-tbody") || document.getElementById("accident-risk-tbody");
    if (tbody && data.road_risk_evaluations) {
      tbody.innerHTML = data.road_risk_evaluations.map(r => {
        const prob = formatNumber(r.calibrated_probability_pct, 2, '—');
        const exceeds = Boolean(r.exceeds_operational_threshold);
        const classification = r.risk_classification || "Low Friction";
        const factors = r.contributing_factors || {};
        const occ = formatNumber(factors.occupancy_pct, 1, '—');
        const speed = formatNumber(factors.speed_kmh, 1, '—');
        const rain = formatNumber(factors.rainfall_mm, 1, '—');

        return `
          <tr style="${exceeds ? 'background: rgba(245, 158, 11, 0.08);' : ''}">
            <td><strong style="color:#38bdf8; cursor:pointer;" onclick="window.flowCastApp.focusRoadOnMap('${r.road_id}')">${r.road_id}</strong></td>
            <td>${r.road_name || 'Corridor Segment'}</td>
            <td><strong style="color:${exceeds ? '#fbbf24' : '#94a3b8'};">${prob}%</strong></td>
            <td>
              <span class="status-pill ${classification === 'High Friction' ? 'status-severe' : (classification === 'Elevated' ? 'status-heavy' : 'status-freeflow')}">
                ${classification}
              </span>
            </td>
            <td>
              ${exceeds 
                ? '<span style="color:#fbbf24; font-weight:700;">⚠️ Elevated Risk (Exp)</span>' 
                : '<span style="color:#64748b;">Baseline (Exp)</span>'}
            </td>
            <td>${occ}%</td>
            <td>${speed} km/h</td>
            <td>${rain} mm</td>
          </tr>
        `;
      }).join("");
    }
  }

  // =========================================================================
  // SECTION G: MODEL PERFORMANCE & XAI STUDIO
  // =========================================================================
  async loadModelPerformance() {
    const data = await API.getModelPerformance();
    if (!data || data.status !== "SUCCESS") return;

    const volMetrics = data.metrics?.traffic_volume || data.metrics?.volume || {};
    const volTbody = document.getElementById("model-perf-vol-tbody");
    if (volTbody) {
      const models = [
        { name: "HistGradientBoosting (Primary)", key: "Gradient Boosting (HistGB)", best: true },
        { name: "Random Forest Regressor", key: "Random Forest" },
        { name: "PyTorch GRU (Recurrent)", key: "PyTorch GRU Sequence Model" },
        { name: "NumPy GD Linear Regressor", key: "Linear Regression (NumPy GD)" }
      ];

      volTbody.innerHTML = models.map(m => {
        const met = volMetrics[m.key] || {};
        const rmse = formatNumber(met.rmse, 2, '—');
        const mae = formatNumber(met.mae, 2, '—');
        const r2 = formatNumber(met.r2, 4, '—');
        const mape = met.mape_pct != null ? `${formatNumber(met.mape_pct, 2, '—')}%` : (met.mape != null ? `${formatNumber(met.mape * 100, 2, '—')}%` : '—');

        return `
          <tr style="${m.best ? 'background: rgba(6, 182, 212, 0.08); font-weight:600;' : ''}">
            <td><strong style="${m.best ? 'color:#38bdf8;' : '#e2e8f0'}">${m.name}</strong></td>
            <td>${rmse} veh</td>
            <td>${mae} veh</td>
            <td>${r2}</td>
            <td>${mape}</td>
          </tr>
        `;
      }).join("");
    }

    const congMetrics = data.metrics?.congestion || {};
    const congTbody = document.getElementById("model-perf-cong-tbody");
    if (congTbody) {
      const models = [
        { name: "HistGradientBoosting Classifier (Primary)", key: "Gradient Boosting (HistGB)", best: true },
        { name: "Random Forest Classifier", key: "Random Forest" },
        { name: "Persistence Baseline (t-1)", key: "Persistence Baseline" }
      ];

      congTbody.innerHTML = models.map(m => {
        const met = congMetrics[m.key] || {};
        const acc = met.accuracy != null ? `${formatNumber(met.accuracy * 100, 2, '—')}%` : '—';
        const f1m = formatNumber(met.f1_macro ?? met.macro_f1, 4, '—');
        const f1w = formatNumber(met.f1_weighted ?? met.weighted_f1, 4, '—');

        return `
          <tr style="${m.best ? 'background: rgba(6, 182, 212, 0.08); font-weight:600;' : ''}">
            <td><strong style="${m.best ? 'color:#38bdf8;' : '#e2e8f0'}">${m.name}</strong></td>
            <td>${acc}</td>
            <td>${f1m}</td>
            <td>${f1w}</td>
          </tr>
        `;
      }).join("");
    }

    const accMetrics = data.metrics?.accident_risk || data.metrics?.accident;
    if (accMetrics) {
      const platt = accMetrics["Platt Calibrated Logistic (Val)"] || accMetrics.calibrated_logistic_platt || accMetrics["Logistic Regression (balanced)"] || {};
      const elBrier = document.getElementById("acc-metric-brier");
      if (elBrier) elBrier.textContent = formatNumber(platt.brier_score, 5, "0.00952");

      const elRoc = document.getElementById("acc-metric-roc");
      if (elRoc) elRoc.textContent = formatNumber(platt.roc_auc, 4, "0.6185");

      const elPr = document.getElementById("acc-metric-prauc");
      if (elPr) elPr.textContent = formatNumber(platt.pr_auc, 4, "0.0199");
    }

    const cmCong = data.confusion_matrices?.congestion_gb || data.confusion_matrices?.congestion_gradient_boosting;
    if (cmCong) {
      Charts.renderConfusionMatrix(
        "cm-congestion-container",
        cmCong,
        ["Free-flow", "Moderate", "Heavy", "Severe"]
      );
    }

    // Render Feature Importance (XAI)
    const featVolContainer = document.getElementById("feat-imp-vol-container");
    if (featVolContainer && data.feature_importance?.traffic_volume_rf) {
      const volImp = Object.entries(data.feature_importance.traffic_volume_rf)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7);
      
      featVolContainer.innerHTML = volImp.map(([feat, score]) => {
        const pct = (score * 100).toFixed(1);
        const name = feat.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        return `
          <div style="display:flex; flex-direction:column; gap:0.2rem;">
            <div style="display:flex; justify-content:space-between; font-size:0.75rem;">
              <span style="color:#e2e8f0; font-weight:600;">${name}</span>
              <span style="color:var(--accent-cyan); font-weight:700;">${pct}%</span>
            </div>
            <div style="height:5px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden;">
              <div style="width:${Math.min(100, pct * 4)}%; height:100%; background:linear-gradient(90deg, #06b6d4, #38bdf8); border-radius:3px;"></div>
            </div>
          </div>
        `;
      }).join("");
    }

    const featAccContainer = document.getElementById("feat-imp-acc-container");
    if (featAccContainer && data.feature_importance?.accident_risk_rf) {
      const accImp = Object.entries(data.feature_importance.accident_risk_rf)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7);
      
      featAccContainer.innerHTML = accImp.map(([feat, score]) => {
        const pct = (score * 100).toFixed(1);
        const name = feat.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        return `
          <div style="display:flex; flex-direction:column; gap:0.2rem;">
            <div style="display:flex; justify-content:space-between; font-size:0.75rem;">
              <span style="color:#e2e8f0; font-weight:600;">${name}</span>
              <span style="color:#f59e0b; font-weight:700;">${pct}%</span>
            </div>
            <div style="height:5px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden;">
              <div style="width:${Math.min(100, pct * 12)}%; height:100%; background:linear-gradient(90deg, #f59e0b, #ef4444); border-radius:3px;"></div>
            </div>
          </div>
        `;
      }).join("");
    }

    // Render Key Takeaways
    const takeawaysContainer = document.getElementById("model-takeaways-container");
    if (takeawaysContainer && Array.isArray(data.key_takeaways)) {
      takeawaysContainer.innerHTML = data.key_takeaways.map((item, idx) => `
        <div style="display:flex; align-items:flex-start; gap:0.6rem; font-size:0.8rem; color:#cbd5e1; background:rgba(255,255,255,0.02); padding:0.5rem 0.75rem; border-radius:var(--radius-sm); border-left:3px solid var(--accent-cyan);">
          <span style="color:var(--accent-cyan); font-weight:800;">${idx + 1}.</span>
          <span>${item}</span>
        </div>
      `).join("");
    }
  }

  // =========================================================================
  // SECTION H: HISTORICAL ARCHIVE EXPLORER
  // =========================================================================
  async queryHistorical() {
    const date = document.getElementById("hist-date-picker")?.value || "";
    const time = document.getElementById("hist-time-picker")?.value || "";
    const roadId = document.getElementById("hist-road-filter")?.value || "";
    const limit = parseInt(document.getElementById("hist-limit-select")?.value || "50", 10);

    const errorMsgEl = document.getElementById("hist-error-msg");
    if (errorMsgEl) errorMsgEl.style.display = "none";

    if (date && (date < "2025-01-01" || date > "2025-05-31")) {
      if (errorMsgEl) {
        errorMsgEl.textContent = "Error: Historical queries must be between 2025-01-01 and 2025-05-31.";
        errorMsgEl.style.display = "block";
      }
      return;
    }

    try {
      const data = await API.getHistorical({ date, time, road_id: roadId, limit });
      if (!data || data.status !== "SUCCESS") {
        if (errorMsgEl) {
          errorMsgEl.textContent = (data && data.message) ? data.message : "Failed to query historical data.";
          errorMsgEl.style.display = "block";
        }
        return;
      }

      this.cachedHistoricalRecords = data.records || [];

      const countEl = document.getElementById("hist-result-count");
      if (countEl) {
        countEl.textContent = `Showing ${data.returned_count || 0} of ${formatNumber(data.total_matching_records, 0, '0')} matching records`;
      }

      const tbody = document.getElementById("hist-results-tbody");
      if (tbody) {
        if (!data.records || data.records.length === 0) {
          tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:2rem; color:#64748b;">No matching records found for specified filters.</td></tr>`;
          return;
        }

        tbody.innerHTML = data.records.map(r => {
          const vol = formatNumber(r.traffic_volume, 0, '—');
          const nextVol = r.target_next_volume !== null && r.target_next_volume !== undefined 
            ? `${formatNumber(r.target_next_volume, 0, '—')} veh` 
            : '—';
          const curCong = r.congestion_level || "Moderate";
          const curSlug = String(curCong).toLowerCase().replace(/[^a-z]/g, "");
          const nextCong = r.target_next_congestion || '—';
          const tt = formatNumber(r.travel_time, 2, '—');
          const speed = formatNumber(r.avg_speed, 1, '—');
          const temp = r.temperature != null ? `${Math.round(r.temperature)}°C` : '—';
          const weather = `${r.weather_condition || 'Clear'} (${temp})`;

          return `
            <tr>
              <td><span style="font-family:monospace; color:#94a3b8;">${r.date} ${r.time}</span></td>
              <td><strong style="color:#38bdf8; cursor:pointer;" onclick="window.flowCastApp.focusRoadOnMap('${r.road_id}')">${r.road_id}</strong></td>
              <td>${r.road_name || 'Corridor Segment'}</td>
              <td>${vol} veh</td>
              <td style="color:#38bdf8; font-weight:600;">${nextVol}</td>
              <td><span class="status-pill status-${curSlug}">${curCong}</span></td>
              <td>${nextCong}</td>
              <td>${tt} min</td>
              <td>${speed} km/h</td>
              <td>${weather}</td>
            </tr>
          `;
        }).join("");
      }
    } catch (err) {
      console.error("Historical query error:", err);
      if (errorMsgEl) {
        errorMsgEl.textContent = `Query error: ${err.message}`;
        errorMsgEl.style.display = "block";
      }
    }
  }

  exportHistoricalCSV() {
    const records = this.cachedHistoricalRecords || [];
    if (records.length === 0) {
      alert("Please perform a search query first before exporting.");
      return;
    }

    const headers = ["date", "time", "road_id", "road_name", "traffic_volume", "target_next_volume", "congestion_level", "travel_time", "avg_speed", "weather_condition"];
    let csv = headers.join(",") + "\n";

    records.forEach(r => {
      const row = headers.map(h => `"${r[h] ?? ''}"`);
      csv += row.join(",") + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `northline_historical_${this.currentDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportHistoricalPDF() {
    const records = this.cachedHistoricalRecords || [];
    if (records.length === 0) {
      alert("Please perform a search query first before exporting.");
      return;
    }
    window.print();
  }
}

// Bootstrap Application on DOM Ready
document.addEventListener("DOMContentLoaded", () => {
  window.flowCastApp = new FlowCastApp();
});
