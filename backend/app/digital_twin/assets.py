import copy
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

INITIAL_ASSETS = [
    {
        "machine_id": "Machine-001",
        "name": "High-Precision 5-Axis CNC Mill",
        "category": "CNC_MILL",
        "status": "OPERATIONAL",
        "simulation_profile": "NORMAL",
        "health_score": 98.5,
        "risk_score": 1.5,
        "anomaly_score": 2.1,
        "rpm": 12000.0,
        "operating_hours": 3420.0,
        "components": [
            {"component_id": "M1-SPINDLE", "name": "High-Speed Spindle", "component_type": "Spindle", "health_score": 99.0, "wear_percentage": 12.0},
            {"component_id": "M1-BEARING-F", "name": "Front Hybrid Ceramic Bearing", "component_type": "Bearing", "health_score": 98.0, "wear_percentage": 14.5},
            {"component_id": "M1-DRIVE", "name": "Servo Axis Drive", "component_type": "MotorDrive", "health_score": 99.5, "wear_percentage": 5.0}
        ],
        "sensors": [
            {"sensor_id": "M1-TEMP-01", "sensor_type": "TEMPERATURE", "unit": "°C", "last_value": 42.5, "is_healthy": True, "min_threshold": 10.0, "max_threshold": 80.0},
            {"sensor_id": "M1-VIB-01", "sensor_type": "VIBRATION", "unit": "mm/s", "last_value": 1.2, "is_healthy": True, "min_threshold": 0.0, "max_threshold": 4.5},
            {"sensor_id": "M1-CURR-01", "sensor_type": "CURRENT", "unit": "A", "last_value": 14.2, "is_healthy": True, "min_threshold": 0.0, "max_threshold": 40.0},
            {"sensor_id": "M1-GAS-01", "sensor_type": "GAS", "unit": "ppm", "last_value": 2.1, "is_healthy": True, "min_threshold": 0.0, "max_threshold": 50.0}
        ]
    },
    {
        "machine_id": "Machine-002",
        "name": "Heavy Duty Industrial Lathe & Mill",
        "category": "TURNING_CENTER",
        "status": "WARNING",
        "simulation_profile": "SENSOR_ANOMALY",
        "health_score": 71.4,
        "risk_score": 42.6,
        "anomaly_score": 68.2,
        "rpm": 3200.0,
        "operating_hours": 8940.0,
        "components": [
            {"component_id": "M2-BEARING-B201", "name": "Main Spindle Bearing B-201", "component_type": "Bearing", "health_score": 68.0, "wear_percentage": 62.0},
            {"component_id": "M2-HYDRAULIC-PUMP", "name": "Chuck Clamping Hydraulic Unit", "component_type": "Hydraulics", "health_score": 82.0, "wear_percentage": 35.0},
            {"component_id": "M2-TOOL-TURRET", "name": "12-Station Servo Turret", "component_type": "Turret", "health_score": 90.0, "wear_percentage": 20.0}
        ],
        "sensors": [
            {"sensor_id": "M2-TEMP-01", "sensor_type": "TEMPERATURE", "unit": "°C", "last_value": 78.4, "is_healthy": True, "min_threshold": 10.0, "max_threshold": 85.0},
            {"sensor_id": "M2-VIB-01", "sensor_type": "VIBRATION", "unit": "mm/s", "last_value": 3.85, "is_healthy": True, "min_threshold": 0.0, "max_threshold": 4.5},
            {"sensor_id": "M2-CURR-01", "sensor_type": "CURRENT", "unit": "A", "last_value": 29.8, "is_healthy": True, "min_threshold": 0.0, "max_threshold": 45.0},
            {"sensor_id": "M2-GAS-01", "sensor_type": "GAS", "unit": "ppm", "last_value": 4.6, "is_healthy": True, "min_threshold": 0.0, "max_threshold": 50.0}
        ]
    },
    {
        "machine_id": "Machine-003",
        "name": "Robotic Welding Cell Arc-6",
        "category": "ROBOTIC_CELL",
        "status": "OPERATIONAL",
        "simulation_profile": "NORMAL",
        "health_score": 94.2,
        "risk_score": 5.8,
        "anomaly_score": 4.5,
        "rpm": 0.0,
        "operating_hours": 1820.0,
        "components": [
            {"component_id": "M3-ROBOT-ARM", "name": "6-Axis Articulated Arm", "component_type": "RoboticArm", "health_score": 95.0, "wear_percentage": 10.0},
            {"component_id": "M3-WELD-TORCH", "name": "Water-Cooled MIG Torch", "component_type": "Tooling", "health_score": 92.0, "wear_percentage": 18.0}
        ],
        "sensors": [
            {"sensor_id": "M3-TEMP-01", "sensor_type": "TEMPERATURE", "unit": "°C", "last_value": 38.0, "is_healthy": True, "min_threshold": 10.0, "max_threshold": 75.0},
            {"sensor_id": "M3-VIB-01", "sensor_type": "VIBRATION", "unit": "mm/s", "last_value": 0.8, "is_healthy": True, "min_threshold": 0.0, "max_threshold": 3.0},
            {"sensor_id": "M3-CURR-01", "sensor_type": "CURRENT", "unit": "A", "last_value": 18.5, "is_healthy": True, "min_threshold": 0.0, "max_threshold": 60.0},
            {"sensor_id": "M3-GAS-01", "sensor_type": "GAS", "unit": "ppm", "last_value": 12.4, "is_healthy": True, "min_threshold": 0.0, "max_threshold": 50.0}
        ]
    },
    {
        "machine_id": "Pump-001",
        "name": "Coolant Circulation Centrifugal Pump",
        "category": "PUMP",
        "status": "OPERATIONAL",
        "simulation_profile": "NORMAL",
        "health_score": 91.0,
        "risk_score": 9.0,
        "anomaly_score": 8.2,
        "rpm": 2950.0,
        "operating_hours": 12400.0,
        "components": [
            {"component_id": "P1-IMPELLER", "name": "Bronze Cast Impeller", "component_type": "Impeller", "health_score": 89.0, "wear_percentage": 24.0},
            {"component_id": "P1-MECH-SEAL", "name": "Double Mechanical Seal", "component_type": "Seal", "health_score": 92.0, "wear_percentage": 21.0}
        ],
        "sensors": [
            {"sensor_id": "P1-TEMP-01", "sensor_type": "TEMPERATURE", "unit": "°C", "last_value": 46.2, "is_healthy": True, "min_threshold": 10.0, "max_threshold": 75.0},
            {"sensor_id": "P1-VIB-01", "sensor_type": "VIBRATION", "unit": "mm/s", "last_value": 1.85, "is_healthy": True, "min_threshold": 0.0, "max_threshold": 4.0},
            {"sensor_id": "P1-CURR-01", "sensor_type": "CURRENT", "unit": "A", "last_value": 22.1, "is_healthy": True, "min_threshold": 0.0, "max_threshold": 35.0},
            {"sensor_id": "P1-GAS-01", "sensor_type": "GAS", "unit": "ppm", "last_value": 1.0, "is_healthy": True, "min_threshold": 0.0, "max_threshold": 50.0}
        ]
    },
    {
        "machine_id": "Motor-001",
        "name": "75 kW 3-Phase Induction Main Drive Motor",
        "category": "MOTOR",
        "status": "OPERATIONAL",
        "simulation_profile": "NORMAL",
        "health_score": 96.0,
        "risk_score": 4.0,
        "anomaly_score": 3.0,
        "rpm": 1485.0,
        "operating_hours": 6700.0,
        "components": [
            {"component_id": "MOT1-STATOR", "name": "Copper Stator Windings", "component_type": "Stator", "health_score": 97.0, "wear_percentage": 6.0},
            {"component_id": "MOT1-ROTOR", "name": "Squirrel Cage Rotor", "component_type": "Rotor", "health_score": 95.0, "wear_percentage": 8.0}
        ],
        "sensors": [
            {"sensor_id": "MOT1-TEMP-01", "sensor_type": "TEMPERATURE", "unit": "°C", "last_value": 55.4, "is_healthy": True, "min_threshold": 10.0, "max_threshold": 95.0},
            {"sensor_id": "MOT1-VIB-01", "sensor_type": "VIBRATION", "unit": "mm/s", "last_value": 1.4, "is_healthy": True, "min_threshold": 0.0, "max_threshold": 4.5},
            {"sensor_id": "MOT1-CURR-01", "sensor_type": "CURRENT", "unit": "A", "last_value": 68.0, "is_healthy": True, "min_threshold": 0.0, "max_threshold": 110.0},
            {"sensor_id": "MOT1-GAS-01", "sensor_type": "GAS", "unit": "ppm", "last_value": 0.5, "is_healthy": True, "min_threshold": 0.0, "max_threshold": 50.0}
        ]
    },
    {
        "machine_id": "Compressor-001",
        "name": "Rotary Screw Air Compressor (10 Bar)",
        "category": "COMPRESSOR",
        "status": "OPERATIONAL",
        "simulation_profile": "NORMAL",
        "health_score": 88.0,
        "risk_score": 12.0,
        "anomaly_score": 11.5,
        "rpm": 3600.0,
        "operating_hours": 15600.0,
        "components": [
            {"component_id": "COMP1-AIREND", "name": "Twin Screw Air End", "component_type": "AirEnd", "health_score": 86.0, "wear_percentage": 32.0},
            {"component_id": "COMP1-OIL-SEP", "name": "Coalescing Oil Separator", "component_type": "Separator", "health_score": 90.0, "wear_percentage": 25.0}
        ],
        "sensors": [
            {"sensor_id": "COMP1-TEMP-01", "sensor_type": "TEMPERATURE", "unit": "°C", "last_value": 68.2, "is_healthy": True, "min_threshold": 10.0, "max_threshold": 105.0},
            {"sensor_id": "COMP1-VIB-01", "sensor_type": "VIBRATION", "unit": "mm/s", "last_value": 2.1, "is_healthy": True, "min_threshold": 0.0, "max_threshold": 5.0},
            {"sensor_id": "COMP1-CURR-01", "sensor_type": "CURRENT", "unit": "A", "last_value": 44.5, "is_healthy": True, "min_threshold": 0.0, "max_threshold": 75.0},
            {"sensor_id": "COMP1-GAS-01", "sensor_type": "GAS", "unit": "ppm", "last_value": 3.0, "is_healthy": True, "min_threshold": 0.0, "max_threshold": 50.0}
        ]
    }
]

class AssetRegistry:
    """In-memory thread-safe registry of live Digital Twin assets."""
    _assets: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def initialize(cls):
        if not cls._assets:
            for item in INITIAL_ASSETS:
                cls._assets[item["machine_id"]] = copy.deepcopy(item)

    @classmethod
    def get_all(cls) -> List[Dict[str, Any]]:
        cls.initialize()
        return list(cls._assets.values())

    @classmethod
    def get_by_id(cls, machine_id: str) -> Optional[Dict[str, Any]]:
        cls.initialize()
        return cls._assets.get(machine_id)

    @classmethod
    def register_new_asset(cls, asset_data: Dict[str, Any]) -> Dict[str, Any]:
        cls.initialize()
        m_id = asset_data["machine_id"]
        cls._assets[m_id] = copy.deepcopy(asset_data)
        return cls._assets[m_id]

    @classmethod
    def update_asset(cls, machine_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        cls.initialize()
        if machine_id in cls._assets:
            cls._assets[machine_id].update(updates)
            return cls._assets[machine_id]
        return None
