# FlowCast AI — Dataset Provenance & Spatial Network Documentation

**Corridor:** Delhi Northline Corridor (25 Monitored Arterial Highway Segments)  
**Temporal Coverage:** January 1, 2025 to May 31, 2025 (5 Full Months, 151 Days)  
**Observation Frequency:** $\Delta t = 30$ minutes (48 intervals per day)  
**Total Telemetry Records:** 176,701 Processed Chronological Records  

---

## 1. Raw Dataset Provenance & Cryptographic Verification

All telemetry originates from three primary raw data sources stored in [`data/raw/`](file:///d:/flowcast/data/raw/). Integrity is mathematically guaranteed via cryptographic SHA-256 hashes:

| Filename | File Size | Record Count | Cryptographic SHA-256 Hash | Integrity Status |
| :--- | :---: | :---: | :--- | :---: |
| **`traffic_sensor_log.csv`** | 31,231,835 B | 178,468 rows | `8f793f3643c891d4fdda7b66c5c4792d24f4db3f26a07cccb8f1d613e254062a` | **UNMODIFIED / INTACT** |
| **`weather_observations.csv`** | 540,212 B | 10,872 rows | `63f3dc54a491dfd5d4663d8bf0602779084c30a1396f0c7b4fd177e132bc8a31` | **UNMODIFIED / INTACT** |
| **`calendar_events.csv`** | 3,114 B | 151 rows | `60d3de6b731486e02f6edaa3515af87c2472231a211b48d94d7a3cad38799b9c` | **UNMODIFIED / INTACT** |

- **Zero Synthetic Datasets:** No synthetic replacement datasets were generated.
- **Derived Feature Store:** `data/processed/northline_traffic_processed.csv` (176,701 records) is strictly compiled by [`data/ingest_raw_data.py`](file:///d:/flowcast/data/ingest_raw_data.py) through deterministic left-joins of sensor logs with spatial weather stations and regional calendar dates.

---

## 2. Delhi Northline Corridor 25 Monitored Road Segments

The corridor spans a contiguous arterial highway grid in North-West Delhi with geographic bounds:
- **Latitude:** $28.560^\circ\text{N}$ to $28.685^\circ\text{N}$
- **Longitude:** $77.100^\circ\text{E}$ to $77.315^\circ\text{E}$

| Road ID | Segment Name | Latitude (°N) | Longitude (°E) | Lane Capacity (veh/30m) | Signal Timing |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **NL-001** | Northline Ave @ 5th | 28.643422 | 77.190412 | 1,800 | 120s Adaptive |
| **NL-002** | Northline Ave @ 9th | 28.598711 | 77.196344 | 1,800 | 120s Adaptive |
| **NL-003** | Harbour Rd Jn | 28.656412 | 77.125134 | 1,600 | 90s Fixed |
| **NL-004** | Harbour Rd @ Mill | 28.682619 | 77.222810 | 1,600 | 90s Fixed |
| **NL-005** | Central Flyover W | 28.618522 | 77.199912 | 2,200 | Grade Separated |
| **NL-006** | Central Flyover E | 28.622310 | 77.258319 | 2,200 | Grade Separated |
| **NL-007** | Kingsway @ Park | 28.647910 | 77.149122 | 1,500 | 100s Actuated |
| **NL-008** | Kingsway @ Depot | 28.642718 | 77.239712 | 1,500 | 100s Actuated |
| **NL-009** | Riverside Dr N | 28.624912 | 77.129310 | 1,400 | 90s Fixed |
| **NL-010** | Riverside Dr S | 28.573519 | 77.268012 | 1,400 | 90s Fixed |
| **NL-011** | Market St Approach | 28.564410 | 77.174719 | 1,500 | 110s Actuated |
| **NL-012** | Market St @ Exchange | 28.671312 | 77.258810 | 1,500 | 110s Actuated |
| **NL-013** | Industrial Link A | 28.648019 | 77.161912 | 1,700 | 100s Fixed |
| **NL-014** | Industrial Link B | 28.594712 | 77.253519 | 1,700 | 100s Fixed |
| **NL-015** | Airport Feeder | 28.626510 | 77.212318 | 2,000 | Coordinated |
| **NL-016** | Airport Underpass | 28.649819 | 77.141012 | 2,000 | Grade Separated |
| **NL-017** | Grand Trunk @ Toll | 28.583912 | 77.193610 | 2,400 | Barrier Toll |
| **NL-018** | Grand Trunk @ Ring | 28.579719 | 77.106612 | 2,400 | Grade Separated |
| **NL-019** | Lakeview Connector | 28.620512 | 77.225219 | 1,400 | 80s Fixed |
| **NL-020** | Lakeview @ Bund | 28.618319 | 77.173110 | 1,400 | 80s Fixed |
| **NL-021** | Old Town Gate | 28.667512 | 77.164519 | 1,300 | 90s Actuated |
| **NL-022** | Old Town @ Clock | 28.674519 | 77.219812 | 1,300 | 90s Actuated |
| **NL-023** | Tech Park Spur | 28.678110 | 77.148819 | 1,800 | 100s Adaptive |
| **NL-024** | Tech Park @ Gate 3 | 28.630312 | 77.312310 | 1,800 | 100s Adaptive |
| **NL-025** | Ring Road Terminus | 28.590919 | 77.238912 | 2,200 | Grade Separated |

---

## 3. Arterial Highway Network Connectivity (28 Connecting Links)

The 25 monitored sensor stations are interconnected by 28 bidirectional highway segments rendered in the GIS engine:

```
[Link 01] NL-001 <--> NL-002    [Link 08] NL-016 <--> NL-003    [Link 15] NL-025 <--> NL-014    [Link 22] NL-023 <--> NL-016
[Link 02] NL-001 <--> NL-007    [Link 09] NL-003 <--> NL-009    [Link 16] NL-014 <--> NL-010    [Link 23] NL-005 <--> NL-015
[Link 03] NL-002 <--> NL-005    [Link 10] NL-009 <--> NL-018    [Link 17] NL-006 <--> NL-008    [Link 24] NL-015 <--> NL-019
[Link 04] NL-005 <--> NL-006    [Link 11] NL-018 <--> NL-011    [Link 18] NL-008 <--> NL-004    [Link 25] NL-019 <--> NL-020
[Link 05] NL-006 <--> NL-012    [Link 12] NL-011 <--> NL-017    [Link 19] NL-004 <--> NL-022    [Link 26] NL-020 <--> NL-005
[Link 06] NL-007 <--> NL-013    [Link 13] NL-017 <--> NL-002    [Link 20] NL-022 <--> NL-021    [Link 27] NL-012 <--> NL-024
[Link 07] NL-013 <--> NL-016    [Link 14] NL-017 <--> NL-025    [Link 21] NL-021 <--> NL-023    [Link 28] NL-024 <--> NL-008
```

---

## 4. Sequence Continuity & Hardware Gap Isolation

In historical inductive detector logs, occasional sensor hardware dropouts occurred. An audit revealed:
- **Total Missing Observation Windows (>30m):** 4,385 instances (4,272 of 60m duration; 113 of 90m duration).
- **Target Generation Fix:** In [`src/features.py`](file:///d:/flowcast/src/features.py), target generation calculates `next_dt = grouped["dt"].shift(-1)`. Targets are assigned **only when** `next_dt == dt + pd.Timedelta(minutes=30)`. Observations preceding gaps are cleanly mapped to `np.nan` and excluded from model target evaluation.
- **Result:** Exactly 172,291 verified consecutive 30-minute pairs are used for supervised model learning.

---

## 5. Ingested Weather & Calendar Integration

- **Weather Observations:** Mapped via geographic station identifier (`weather_station_id`). Enriches every observation with temperature (°C), rainfall (mm), relative humidity (%), surface wind speed (km/h), and visual range (m).
- **Calendar Events:** Mapped via date string (`YYYY-MM-DD`). Enriches records with binary holiday status (`is_holiday`) and special event impact multipliers (`event_impact_score` between 0.0 and 2.5).
