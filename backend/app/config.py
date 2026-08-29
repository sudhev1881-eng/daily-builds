"""Application configuration."""

from pydantic_settings import BaseSettings


class DetectionThresholds(BaseSettings):
    """Configurable detection parameters — override via WIFI_SENSE_DETECTION_ env prefix.

    Detection thresholds are ADAPTIVE: learned from the quiet calibration
    period as percentile * headroom. Values here control the learning, not
    fixed trigger levels.
    """

    calibration_duration_sec: float = 10.0

    # Adaptive threshold learning (percentile of baseline scores * headroom)
    motion_headroom: float = 1.5
    motion_percentile: float = 95.0
    motion_floor: float = 0.03
    presence_headroom: float = 1.35
    presence_percentile: float = 95.0
    presence_floor: float = 0.5

    # Turbulence sliding window (packets; 15 = 1.5 s at 10 Hz)
    turbulence_window: int = 15

    # Hysteresis (consecutive packets at 10 Hz)
    motion_on_samples: int = 3
    motion_off_samples: int = 10
    presence_on_samples: int = 5
    presence_off_samples: int = 30

    # Breathing detection (stationary-human confirmation)
    breathing_window: int = 200
    breathing_ratio_threshold: float = 0.42

    # Position tracking
    position_deadband_m: float = 0.04
    measurement_noise_m: float = 0.18
    settle_frames: int = 25  # extra tracked frames after a person stops (2.5 s averaging)
    trail_min_distance_m: float = 0.25
    environmental_learn_samples: int = 60
    accuracy_mode: str = "high"

    class Config:
        env_prefix = "WIFI_SENSE_DETECTION_"


class Settings(BaseSettings):
    """Runtime settings for the sensing backend."""

    app_name: str = "Wi-Fi Sensing Dashboard"
    simulation_mode: bool = True
    update_interval_ms: int = 100
    default_room_width: float = 8.0
    default_room_height: float = 6.0

    router_x: float = 1.0
    router_y: float = 5.5
    receiver_x: float = 7.0
    receiver_y: float = 0.5

    class Config:
        env_prefix = "WIFI_SENSE_"


settings = Settings()
detection_thresholds = DetectionThresholds()
