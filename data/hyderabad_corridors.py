"""
FlowCast AI - Hyderabad Smart City Corridors & Road Network
Accurate geographic coordinates, structural road profiles, and multi-point road geometries.
Traces real road routes across Hyderabad's key arterials, flyovers, and expressways.
"""

HYDERABAD_CORRIDORS = [
    {
        "id": "HYD-C01",
        "name": "Kukatpally (KPHB - JNTU NH65 Arterial)",
        "zone": "North-West Commercial",
        "type": "Major Urban Arterial",
        "lanes": 4,
        "free_flow_speed": 60.0,
        "length_km": 6.8,
        "capacity_per_lane": 1500,
        "base_accident_factor": 0.12,
        "junction_risk": 0.35,
        "description": "Dense commercial corridor with high pedestrian transit, metro pillar merges, and arterial bus stops.",
        "coords": [
            [17.4610, 78.4310],
            [17.4725, 78.4190],
            [17.4850, 78.4110],
            [17.4938, 78.3984],
            [17.4980, 78.3880],
            [17.5020, 78.3750],
            [17.5085, 78.3680]
        ]
    },
    {
        "id": "HYD-C02",
        "name": "Miyapur (Allwyn X Roads - Metro Hub NH65)",
        "zone": "North-West Transit",
        "type": "Suburban Highway / Arterial",
        "lanes": 3,
        "free_flow_speed": 65.0,
        "length_km": 7.2,
        "capacity_per_lane": 1400,
        "base_accident_factor": 0.10,
        "junction_risk": 0.26,
        "description": "Major inter-city transit interchange with heavy freight, RTC bus departures, and suburban commuters.",
        "coords": [
            [17.5085, 78.3680],
            [17.5020, 78.3610],
            [17.4968, 78.3551],
            [17.5015, 78.3420],
            [17.4985, 78.3310],
            [17.4940, 78.3210],
            [17.4910, 78.3090]
        ]
    },
    {
        "id": "HYD-C03",
        "name": "Hitech City (Cyber Towers - Mindspace Boulevard)",
        "zone": "Cyberabad IT Zone",
        "type": "IT Spine Arterial",
        "lanes": 3,
        "free_flow_speed": 50.0,
        "length_km": 5.4,
        "capacity_per_lane": 1300,
        "base_accident_factor": 0.14,
        "junction_risk": 0.38,
        "description": "Primary IT corridor with massive morning (08:30-10:30) and evening (17:30-20:00) peak surges.",
        "coords": [
            [17.4474, 78.3762],
            [17.4452, 78.3788],
            [17.4410, 78.3825],
            [17.4365, 78.3850],
            [17.4330, 78.3875],
            [17.4285, 78.3910]
        ]
    },
    {
        "id": "HYD-C04",
        "name": "Gachibowli (Bio-Diversity Flyover - ORR Junction)",
        "zone": "Cyberabad IT Zone",
        "type": "Expressway Interchange",
        "lanes": 4,
        "free_flow_speed": 70.0,
        "length_km": 6.5,
        "capacity_per_lane": 1650,
        "base_accident_factor": 0.13,
        "junction_risk": 0.36,
        "description": "Multi-tier interchange connecting Old Mumbai Highway to Outer Ring Road with severe weaving conflict points.",
        "coords": [
            [17.4285, 78.3910],
            [17.4310, 78.3810],
            [17.4360, 78.3670],
            [17.4401, 78.3489],
            [17.4445, 78.3520],
            [17.4240, 78.3650]
        ]
    },
    {
        "id": "HYD-C05",
        "name": "Madhapur (Avasa - Durgam Cheruvu Cable Bridge)",
        "zone": "Cyberabad IT Zone",
        "type": "Urban Arterial / Landmark Bridge",
        "lanes": 3,
        "free_flow_speed": 50.0,
        "length_km": 4.8,
        "capacity_per_lane": 1200,
        "base_accident_factor": 0.11,
        "junction_risk": 0.28,
        "description": "Scenic cable-stayed bridge corridor linking Jubilee Hills to Hitech City; tourist evening slowdowns.",
        "coords": [
            [17.4490, 78.3880],
            [17.4440, 78.3920],
            [17.4399, 78.3908],
            [17.4350, 78.3955],
            [17.4310, 78.4010],
            [17.4270, 78.4050]
        ]
    },
    {
        "id": "HYD-C06",
        "name": "Financial District (Wipro Circle - Waverock - ISB Road)",
        "zone": "Cyberabad IT Zone",
        "type": "Corporate Expressway",
        "lanes": 3,
        "free_flow_speed": 60.0,
        "length_km": 8.2,
        "capacity_per_lane": 1450,
        "base_accident_factor": 0.08,
        "junction_risk": 0.22,
        "description": "Wide, modern corporate arterial serving multinational campuses, SEZs, and residential high-rises.",
        "coords": [
            [17.4156, 78.3427],
            [17.4190, 78.3370],
            [17.4230, 78.3410],
            [17.4120, 78.3480],
            [17.4080, 78.3550],
            [17.4010, 78.3600]
        ]
    },
    {
        "id": "HYD-C07",
        "name": "Jubilee Hills (Road No. 36 - Check Post - Peddamma Temple)",
        "zone": "Central Hills",
        "type": "Commercial Arterial",
        "lanes": 3,
        "free_flow_speed": 50.0,
        "length_km": 5.6,
        "capacity_per_lane": 1250,
        "base_accident_factor": 0.12,
        "junction_risk": 0.32,
        "description": "High-end commercial & dining district with steep gradient slopes, median cuts, and heavy evening shopper traffic.",
        "coords": [
            [17.4270, 78.4050],
            [17.4319, 78.4073],
            [17.4280, 78.4180],
            [17.4255, 78.4230],
            [17.4230, 78.4280],
            [17.4200, 78.4340]
        ]
    },
    {
        "id": "HYD-C08",
        "name": "Mehdipatnam (Mehdipatnam X Roads - PVNR Ramp)",
        "zone": "South-Central Transit",
        "type": "Chokepoint Transit Spine",
        "lanes": 3,
        "free_flow_speed": 55.0,
        "length_km": 6.0,
        "capacity_per_lane": 1200,
        "base_accident_factor": 0.18,
        "junction_risk": 0.44,
        "description": "Vital transit gateway connecting Central Hyderabad to Rajiv Gandhi International Airport via PVNR Expressway.",
        "coords": [
            [17.3916, 78.4400],
            [17.3870, 78.4430],
            [17.3820, 78.4480],
            [17.3780, 78.4510],
            [17.3710, 78.4550]
        ]
    },
    {
        "id": "HYD-C09",
        "name": "Panjagutta (Panjagutta Circle - Nagarjuna Circle)",
        "zone": "Core Urban",
        "type": "Urban Core Arterial",
        "lanes": 3,
        "free_flow_speed": 45.0,
        "length_km": 5.1,
        "capacity_per_lane": 1150,
        "base_accident_factor": 0.15,
        "junction_risk": 0.40,
        "description": "Historic central retail and business hub with multi-level flyovers and heavy bus lane conflicts.",
        "coords": [
            [17.4210, 78.4480],
            [17.4265, 78.4516],
            [17.4300, 78.4540],
            [17.4340, 78.4580],
            [17.4375, 78.4480],
            [17.4420, 78.4650]
        ]
    },
    {
        "id": "HYD-C10",
        "name": "Secunderabad (Paradise - Clock Tower - Railway Spine)",
        "zone": "Twin Cities East",
        "type": "Transit Collector",
        "lanes": 3,
        "free_flow_speed": 45.0,
        "length_km": 4.5,
        "capacity_per_lane": 1100,
        "base_accident_factor": 0.16,
        "junction_risk": 0.38,
        "description": "Dense heritage commercial zone around Secunderabad Railway Station with mixed two-wheelers and auto-rickshaws.",
        "coords": [
            [17.4411, 78.4983],
            [17.4435, 78.5005],
            [17.4460, 78.5020],
            [17.4395, 78.5045],
            [17.4480, 78.5060],
            [17.4520, 78.5080]
        ]
    },
    {
        "id": "HYD-C11",
        "name": "Banjara Hills (Road No. 12 - Masab Tank Arterial)",
        "zone": "Central Hills",
        "type": "Hilly Urban Collector",
        "lanes": 2,
        "free_flow_speed": 45.0,
        "length_km": 5.8,
        "capacity_per_lane": 1000,
        "base_accident_factor": 0.14,
        "junction_risk": 0.34,
        "description": "Rolling elevation corridor linking Masab Tank to Banjara Hills; frequent VIP movements and hospital ambulances.",
        "coords": [
            [17.4010, 78.4480],
            [17.4050, 78.4450],
            [17.4080, 78.4420],
            [17.4120, 78.4380],
            [17.4156, 78.4350],
            [17.4200, 78.4300]
        ]
    },
    {
        "id": "HYD-C12",
        "name": "Nehru Outer Ring Road (ORR Gachibowli - Shamshabad Link)",
        "zone": "Outer Expressway Ring",
        "type": "Access-Controlled Expressway",
        "lanes": 4,
        "free_flow_speed": 100.0,
        "length_km": 24.5,
        "capacity_per_lane": 1900,
        "base_accident_factor": 0.07,
        "junction_risk": 0.14,
        "description": "8-lane access-controlled ring expressway linking the western IT corridor directly to Shamshabad Airport (RGIA).",
        "coords": [
            [17.4200, 78.3300],
            [17.4010, 78.3600],
            [17.3850, 78.3650],
            [17.3600, 78.3700],
            [17.3200, 78.3850],
            [17.2600, 78.4300]
        ]
    }
]
