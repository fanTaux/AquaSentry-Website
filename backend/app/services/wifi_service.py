import re
import subprocess

active_wifi_config = {
    "ssid": "wahh",
    "status": "Terhubung",
    "ip": "192.168.1.100",
    "rssi": -57
}

def scan_real_wifi_networks():
    """Scans real physical Wi-Fi networks nearby using Windows netsh API."""
    networks = []
    seen_ssids = set()

    # 1. First check current connected interface
    try:
        if_out = subprocess.check_output("netsh wlan show interfaces", shell=True, text=True, errors="ignore")
        curr_ssid = None
        curr_rssi = -55
        curr_auth = "WPA2"
        for line in if_out.splitlines():
            line = line.strip()
            if line.startswith("SSID") and ":" in line and not line.startswith("BSSID"):
                curr_ssid = line.split(":", 1)[1].strip()
            elif line.startswith("Rssi") and ":" in line:
                try:
                    curr_rssi = int(line.split(":", 1)[1].strip())
                except Exception:
                    pass
            elif line.startswith("Signal") and ":" in line:
                try:
                    pct = int(line.split(":", 1)[1].strip().replace("%", ""))
                    curr_rssi = -100 + int(pct / 2)
                except Exception:
                    pass
            elif line.startswith("Authentication") and ":" in line:
                curr_auth = line.split(":", 1)[1].strip()
        if curr_ssid:
            networks.append({
                "ssid": curr_ssid,
                "rssi": curr_rssi,
                "security": curr_auth or "WPA2"
            })
            seen_ssids.add(curr_ssid)
    except Exception:
        pass

    # 2. Get all visible networks from netsh wlan show networks mode=bssid
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
