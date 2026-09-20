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
