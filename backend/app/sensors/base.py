"""
Abstract sensor interface.

To connect real Wi-Fi CSI hardware:
1. Subclass BaseSensor and implement read_measurement().
2. Parse CSI frames from your device (e.g. Intel 5300, Atheros, ESP32-S3).
3. Return RawMeasurement with source="hardware".
4. Register the hardware sensor in main.py instead of WiFiSimulator.
"""

from abc import ABC, abstractmethod

from app.models import RawMeasurement


class BaseSensor(ABC):
    """Interface for Wi-Fi sensing data sources."""

    @abstractmethod
    async def read_measurement(self) -> RawMeasurement:
        """Read one measurement from the sensor."""
        ...

    @abstractmethod
    async def start(self) -> None:
        """Initialize the sensor (open serial port, start CSI stream, etc.)."""
        ...

    @abstractmethod
    async def stop(self) -> None:
        """Release sensor resources."""
        ...
