import os
import sys

# Ensure parent directory is in sys.path to load aquasentry_core
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from aquasentry_core import AquaSentryCore

# Base directory paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCATIONS_FILE = os.path.join(BASE_DIR, "locations_saved.json")

MAX_HISTORY_SIZE = 50

# Core AI & Rules Engine Instance
sentry = AquaSentryCore()

# MQTT HiveMQ Cloud Broker Configuration (TLS Port 8883)
MQTT_BROKER = os.getenv("MQTT_BROKER", "4ecff5933a704e218192a9a9390c3580.s1.eu.hivemq.cloud")
MQTT_PORT = int(os.getenv("MQTT_PORT", "8883"))
MQTT_USER = os.getenv("MQTT_USER", "Aquasentry")
MQTT_PASS = os.getenv("MQTT_PASS", "admin123")

MQTT_TOPIC_TELEMETRY = "aquasentry/water_quality/telemetry"
MQTT_TOPIC_RESULT = "aquasentry/water_quality/result"
MQTT_TOPIC_STATUS = "aquasentry/status"
MQTT_TOPIC_COMMAND = "aquasentry/command"

# ESP32 Local TCP Socket
ESP_IP = os.getenv("ESP_IP", "192.168.1.27")
ESP_PORT = int(os.getenv("ESP_PORT", "8080"))

