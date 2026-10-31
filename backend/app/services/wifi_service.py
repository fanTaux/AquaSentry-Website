import os
import json
import re
import subprocess

CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "wifi_config.json")

def load_wifi_config():
    default_config = {
        "ssid": "Hotspot HP / ESP32 WiFi",
        "status": "Terhubung",
        "ip": "192.168.4.1",
        "rssi": -55
    }
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data and isinstance(data, dict):
                    # Sanitize any accidental laptop WiFi-UB.x campus network
                    if data.get("ssid") == "WiFi-UB.x":
                        data["ssid"] = "Hotspot HP / ESP32 WiFi"
                    return {**default_config, **data}
        except Exception as e:
            print(f"[WIFI CONFIG] Gagal membaca {CONFIG_FILE}: {e}")
    return default_config

active_wifi_config = load_wifi_config()

def save_wifi_config():
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(active_wifi_config, f, indent=2)
    except Exception as e:
        print(f"[WIFI CONFIG] Gagal menyimpan {CONFIG_FILE}: {e}")

def scan_real_wifi_networks():
    """Scans physical Wi-Fi networks visible nearby using Windows netsh API."""
    networks = []
    seen_ssids = set()

    # Get visible networks from netsh wlan show networks mode=bssid
    try:
        out = subprocess.check_output("netsh wlan show networks mode=bssid", shell=True, text=True, errors="ignore")
        curr_net = {}
        for line in out.splitlines():
            line = line.strip()
            if line.startswith("SSID") and ":" in line:
                val = line.split(":", 1)[1].strip()
                if val and not re.match(r"^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$", val) and not val.startswith("Network type"):
                    if curr_net.get("ssid") and curr_net["ssid"] not in seen_ssids:
                        networks.append(curr_net)
                        seen_ssids.add(curr_net["ssid"])
                    curr_net = {"ssid": val, "rssi": -65, "security": "WPA2"}
            elif line.startswith("Authentication") and ":" in line:
                if curr_net:
                    curr_net["security"] = line.split(":", 1)[1].strip()
            elif line.startswith("Signal") and ":" in line:
                if curr_net:
                    try:
                        sig_pct = int(line.split(":", 1)[1].strip().replace("%", ""))
                        curr_net["rssi"] = -100 + int(sig_pct / 2)
                    except Exception:
                        pass
        if curr_net.get("ssid") and curr_net["ssid"] not in seen_ssids:
            networks.append(curr_net)
            seen_ssids.add(curr_net["ssid"])
    except Exception as e:
        print(f"Error scanning networks: {e}")

    networks.sort(key=lambda x: x["rssi"], reverse=True)
    return networks
