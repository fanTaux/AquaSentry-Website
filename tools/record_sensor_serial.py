import os
import re
import sys
import time
import csv
from datetime import datetime

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    print("[ERROR] Package 'pyserial' belum terinstal. Jalankan: pip install pyserial")
    sys.exit(1)

def get_default_port():
    """Detect default port or fallback to COM20."""
    if len(sys.argv) > 1 and not sys.argv[1].isdigit():
        return sys.argv[1]
    
    ports = [p.device for p in serial.tools.list_ports.comports()]
    if "COM20" in ports:
        return "COM20"
    elif ports:
        return ports[0]
    return "COM20"

def select_ground_truth_label():
    """Prompt user to choose ground truth label for recording session."""
    print("\n" + "=" * 70)
    print(" 🏷️  PILIH LABEL GROUND TRUTH SAMPEL UNTUK REKAMAN INI:")
    print("=" * 70)
    print("  [1] Low Risk      (Air Bersih / Aman)")
    print("  [2] Moderate Risk (Air Waspada / Sedang)")
    print("  [3] High Risk     (Air Keruh / Berisiko Tinggi)")
    print("  [4] Custom Label  (Ketik manual)")
    print("-" * 70)
    
    choice = input(" Masukkan pilihan [1-4] (Default: 1): ").strip()
    
    if choice == "2":
        return "Moderate Risk"
    elif choice == "3":
        return "High Risk"
    elif choice == "4":
        custom = input(" Masukkan nama label custom: ").strip()
        return custom if custom else "Low Risk"
    else:
        return "Low Risk"

def main():
    port = get_default_port()
    baudrate = 115200

    print("=" * 70)
    print(" 📡 AQUASENTRY SERIAL SENSOR DATA RECORDER (WITH GROUND TRUTH LABEL)")
    print("=" * 70)
    print(f"[+] Target Port Serial: {port}")
    print(f"[+] Baud Rate        : {baudrate}")
    
    # List available COM ports
    available_ports = [p.device for p in serial.tools.list_ports.comports()]
    print(f"[+] Port Tersedia    : {available_ports if available_ports else 'Tidak ada port terdeteksi'}")
    
    # Interactive Ground Truth Selection
    ground_truth_label = select_ground_truth_label()
    
    # Safe file key for filename
    label_slug = ground_truth_label.lower().replace(" ", "_")
    output_filename = f"rekaman_sensor_{label_slug}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    print("\n" + "-" * 70)
    print(f"[+] Label Aktif Sesi : {ground_truth_label}")
    print(f"[+] Berkas Output CSV: {output_filename}")
    print("-" * 70)

    # Open serial connection
    try:
        ser = serial.Serial(port, baudrate, timeout=2.0)
        time.sleep(2.0) # Wait for serial connection to stabilize
        print(f"[SUCCESS] Berhasil terhubung ke port {port}!")
    except Exception as e:
        print(f"[ERROR] Gagal membuka port {port}: {e}")
        print("\n[TIPS] Pastikan:")
        print(" 1. ESP32 telah dicolokkan ke laptop via kabel USB Data.")
        print(f" 2. Port {port} tidak sedang dibuka oleh Serial Monitor Arduino IDE / VSCode.")
        print(" 3. Anda bisa menjalankan script dengan port lain, contoh: python record_sensor_serial.py COM3")
        sys.exit(1)

    # Prepare CSV file
    file_exists = os.path.exists(output_filename)
    csv_file = open(output_filename, mode="a", newline="", encoding="utf-8")
    writer = csv.writer(csv_file)

    if not file_exists or os.path.getsize(output_filename) == 0:
        writer.writerow([
            "sample_id",
            "timestamp",
            "tds_mg_l",
            "turbidity_ntu",
            "r_tds",
            "r_turb",
            "ari",
            "ass_score",
            "ground_truth",
            "ml_predicted_risk",
            "led_indicator",
            "com_port"
        ])
        csv_file.flush()

    print(f"\n[RECORDER ACTIVE] Mengumpulkan sampel dengan Label '{ground_truth_label}'... Tekan Ctrl+C untuk berhenti.\n")
    print(f"{'No':<5} | {'Waktu':<12} | {'TDS (mg/L)':<12} | {'Turbidity (NTU)':<15} | {'ARI':<6} | {'ASS':<6} | {'Ground Truth Label':<20} | {'ML Prediction':<15}")
    print("-" * 105)

    count = 0
    pattern = re.compile(
        r"TDS:\s*([\d\.]+)\s*\|\s*Turb:\s*([\d\.]+)\s*\|\s*ARI:\s*([\d\.]+)\s*\|\s*ASS:\s*([\d\.]+)\s*\|\s*Risk:\s*([^\|]+)\s*\|\s*LED:\s*(.+)"
    )

    try:
        while True:
            line_bytes = ser.readline()
            if not line_bytes:
                continue

            try:
                line_str = line_bytes.decode("utf-8", errors="ignore").strip()
            except Exception:
                continue

            if not line_str:
                continue

            timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
            time_only = datetime.now().strftime("%H:%M:%S.%f")[:-3]

            # Parse log pattern
            match = pattern.search(line_str)

            if match:
                tds_val = float(match.group(1))
                turb_val = float(match.group(2))
                ari_val = float(match.group(3))
                ass_val = float(match.group(4))
                ml_pred_cat = match.group(5).strip()
                led_ind = match.group(6).strip()
                
                r_tds = round(tds_val / 300.0, 4)
                r_turb = round(turb_val / 3.0, 4)
            else:
                # Try generic comma/space regex extraction if custom debug string printed
                numbers = re.findall(r"[-+]?\d*\.\d+|\d+", line_str)
                if len(numbers) >= 2:
                    try:
                        tds_val = float(numbers[0])
                        turb_val = float(numbers[1])
                        
                        r_tds = round(tds_val / 300.0, 4)
                        r_turb = round(turb_val / 3.0, 4)
                        ari_val = round(0.5 * r_tds + 0.5 * r_turb, 4)
                        ass_val = round(100.0 / (1.0 + ari_val), 2)
                        
                        max_r = max(r_tds, r_turb)
                        if max_r <= 0.5:
                            ml_pred_cat, led_ind = "Low Risk", "GREEN"
                        elif max_r <= 1.0:
                            ml_pred_cat, led_ind = "Moderate Risk", "YELLOW"
                        else:
                            ml_pred_cat, led_ind = "High Risk", "RED"
                    except Exception:
                        continue
                else:
                    # Non-telemetry log line, display on console
                    print(f" [ESP32 LOG] {line_str}")
                    continue

            count += 1
            sample_id = f"REAL-COM20-{label_slug[:4].upper()}-{count:05d}"

            # Write row to CSV
            writer.writerow([
                sample_id,
                timestamp_str,
                tds_val,
                turb_val,
                r_tds,
                r_turb,
                ari_val,
                ass_val,
                ground_truth_label,
                ml_pred_cat,
                led_ind,
                port
            ])
            csv_file.flush()

            print(f"{count:<5} | {time_only:<12} | {tds_val:<12.2f} | {turb_val:<15.2f} | {ari_val:<6.2f} | {ass_val:<6.1f} | {ground_truth_label:<20} | {ml_pred_cat:<15}")

    except KeyboardInterrupt:
        print("\n" + "=" * 70)
        print(" [STOPPED] Perekaman data dihentikan oleh pengguna.")
    finally:
        csv_file.close()
        try:
            ser.close()
        except Exception:
            pass
        print(f" [OK] Total {count} sampel ber-label '{ground_truth_label}' berhasil direkam ke berkas:\n      {os.path.abspath(output_filename)}")
        print("=" * 70)

if __name__ == "__main__":
    main()
