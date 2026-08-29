"""Application configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Runtime settings for the sensing backend."""

    app_name: str = "Wi-Fi Sensing Dashboard"
    simulation_mode: bool = True
    update_interval_ms: int = 100
    default_room_width: float = 8.0
    default_room_height: float = 6.0

    # Default sensor positions (meters from bottom-left corner)
    router_x: float = 1.0
    router_y: float = 5.5
    receiver_x: float = 7.0
    receiver_y: float = 0.5

    class Config:
        env_prefix = "WIFI_SENSE_"


settings = Settings()
