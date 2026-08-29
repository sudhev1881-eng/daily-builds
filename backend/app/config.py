"""Application configuration."""

from pydantic_settings import BaseSettings


class DetectionThresholds(BaseSettings):
    """Configurable detection thresholds — override via WIFI_SENSE_DETECTION_ env prefix."""

    calibration_duration_sec: float = 10.0
    presence_start_threshold: float = 0.65
    presence_stop_threshold: float = 0.40
    movement_start_threshold: float = 0.65
    movement_stop_threshold: float = 0.35
    presence_confirm_samples: int = 15
    movement_confirm_samples: int = 20
    movement_stop_samples: int = 30
    position_deadband_m: float = 0.15
    trail_min_distance_m: float = 0.25
    ema_alpha: float = 0.12
    noise_floor: float = 0.08
    environmental_learn_samples: int = 60
    accuracy_mode: str = "high"  # "standard" or "high"

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
