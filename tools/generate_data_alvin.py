import os
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

def main():
    print("Memulai pembuatan Data Alvin...")
    
    # Target directory
    base_dir = "data"
    os.makedirs(base_dir, exist_ok=True)
    
    # Seed for reproducibility while preserving variation
    np.random.seed(42)
    random.seed(42)
    
    # 1. Structure definition
    parameters = ["TDS", "Turbidity"]
    risk_levels = ["low risk", "Medium risk", "High risk"]
    
    locations = [
        ("Botol Sampel A", "Sumber Air A"),
        ("Botol Sampel B", "Sumber Air B"),
        ("Botol Sampel C", "Sumber Air C"),
        ("Botol Sampel D", "Sumber Air D"),
        ("Botol Sampel E", "Sumber Air E")
    ]
    
    # Sampling parameters
    sampling_freq_hz = 5  # 5 Hz -> dt = 0.2s
    dt_seconds = 1.0 / sampling_freq_hz
    
    # Generate 5 excel files for each combination (~7000+ rows each)
    row_counts = [7020, 7150, 7200, 7350, 7520]
    
    start_base_time = datetime(2026, 9, 18, 8, 0, 0)
    
    for param in parameters:
        for risk in risk_levels:
            target_dir = os.path.join(base_dir, param, risk)
            os.makedirs(target_dir, exist_ok=True)
            
            for file_idx in range(1, 6):
                file_name = f"data{file_idx}.xlsx"
                file_path = os.path.join(target_dir, file_name)
                
                n_rows = row_counts[file_idx - 1]
                source_name, loc_name = locations[file_idx - 1]
                
                # Base offset for timestamps per file/session
                session_start = start_base_time + timedelta(hours=file_idx*2, minutes=random.randint(0, 30))
                timestamps = [
                    (session_start + timedelta(seconds=i * dt_seconds)).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
                    for i in range(n_rows)
                ]
                
                # Generate realistic continuous sensor physical values with 5 Hz analog noise & drift
                if param == "TDS":
                    if risk == "low risk":
                        base_val = np.random.uniform(50, 140)
                        noise = np.random.normal(0, 2.5, n_rows)
                        drift = np.sin(np.linspace(0, 4*np.pi, n_rows)) * 5
                        values = np.clip(base_val + drift + noise, 30, 149)
                    elif risk == "Medium risk":
                        base_val = np.random.uniform(160, 280)
                        noise = np.random.normal(0, 4.0, n_rows)
                        drift = np.sin(np.linspace(0, 6*np.pi, n_rows)) * 10
                        values = np.clip(base_val + drift + noise, 150, 299)
                    else:  # High risk
                        base_val = np.random.uniform(320, 750)
                        noise = np.random.normal(0, 8.0, n_rows)
                        drift = np.sin(np.linspace(0, 8*np.pi, n_rows)) * 25
                        values = np.clip(base_val + drift + noise, 301, 1000)
                    
                    ratios = np.round(values / 300.0, 4)
                    df = pd.DataFrame({
                        "sample_id": [f"TDS-{risk[:3].upper()}-{file_idx:02d}-{i+1:05d}" for i in range(n_rows)],
                        "timestamp": timestamps,
                        "tds_mg_l": np.round(values, 2),
                        "r_tds": ratios,
                        "risk_category": risk,
                        "source": source_name,
                        "location": loc_name,
                        "sampling_rate_hz": 5
                    })
                    
                else:  # Turbidity
                    if risk == "low risk":
                        base_val = np.random.uniform(0.1, 1.3)
                        noise = np.random.normal(0, 0.05, n_rows)
                        drift = np.sin(np.linspace(0, 4*np.pi, n_rows)) * 0.1
                        values = np.clip(base_val + drift + noise, 0.05, 1.49)
                    elif risk == "Medium risk":
                        base_val = np.random.uniform(1.55, 2.85)
                        noise = np.random.normal(0, 0.08, n_rows)
                        drift = np.sin(np.linspace(0, 6*np.pi, n_rows)) * 0.15
                        values = np.clip(base_val + drift + noise, 1.5, 2.99)
                    else:  # High risk
                        base_val = np.random.uniform(3.1, 8.5)
                        noise = np.random.normal(0, 0.25, n_rows)
                        drift = np.sin(np.linspace(0, 8*np.pi, n_rows)) * 0.6
                        values = np.clip(base_val + drift + noise, 3.01, 15.0)
                    
                    ratios = np.round(values / 3.0, 4)
                    df = pd.DataFrame({
                        "sample_id": [f"TURB-{risk[:3].upper()}-{file_idx:02d}-{i+1:05d}" for i in range(n_rows)],
                        "timestamp": timestamps,
                        "turbidity_ntu": np.round(values, 2),
                        "r_turb": ratios,
                        "risk_category": risk,
                        "source": source_name,
                        "location": loc_name,
                        "sampling_rate_hz": 5
                    })
                
                # Save to Excel
                df.to_excel(file_path, index=False)
                print(f"  [+] Saved {file_path} ({len(df)} rows)")

    # 2. Build Master Data Alvin (data_alvin.csv) with paired TDS & Turbidity for model training (7,520 samples)
    print("\nMembangkitkan Dataset Utama: data_alvin.csv (7,520 sampel)...")
    n_master = 7520
    master_start_time = datetime(2026, 9, 18, 8, 0, 0)
    
    master_timestamps = [
        (master_start_time + timedelta(seconds=i * dt_seconds)).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        for i in range(n_master)
    ]
    
    # Generate balanced paired distribution across all risk zones
    n_per_cluster = n_master // 4
    
    # Cluster 1: Clean water (Low Risk)
    tds_1 = np.clip(np.random.normal(100, 25, n_per_cluster), 30, 145)
    turb_1 = np.clip(np.random.normal(0.6, 0.3, n_per_cluster), 0.1, 1.4)
    
    # Cluster 2: Moderate Risk
    tds_2 = np.clip(np.random.normal(210, 35, n_per_cluster), 140, 290)
    turb_2 = np.clip(np.random.normal(1.8, 0.4, n_per_cluster), 1.0, 2.9)
    
    # Cluster 3: High Risk
    tds_3 = np.clip(np.random.normal(340, 50, n_per_cluster), 280, 500)
    turb_3 = np.clip(np.random.normal(3.5, 0.8, n_per_cluster), 2.2, 5.5)
    
    # Cluster 4: Very High Risk
    tds_4 = np.clip(np.random.normal(650, 120, n_per_cluster), 400, 1100)
    turb_4 = np.clip(np.random.normal(7.0, 2.0, n_per_cluster), 4.5, 14.0)
    
    tds_all = np.concatenate([tds_1, tds_2, tds_3, tds_4])
    turb_all = np.concatenate([turb_1, turb_2, turb_3, turb_4])
    
    # Shuffle indices together
    shuffle_idx = np.random.permutation(n_master)
    tds_all = tds_all[shuffle_idx]
    turb_all = turb_all[shuffle_idx]
    
    # Calculate ratios, ARI, ASS
    r_tds = np.round(tds_all / 300.0, 4)
    r_turb = np.round(turb_all / 3.0, 4)
    ari = np.round(0.5 * r_tds + 0.5 * r_turb, 4)
    ass_score = np.round(100.0 / (1.0 + ari), 2)
    
    # Ground Truth Determination:
    ground_truth = []
    sources = []
    locs = []
    
    for i in range(n_master):
        max_r = max(r_tds[i], r_turb[i])
        
        # Add realistic lab noise (e.g., E. coli / heavy metal lab findings)
        bio_hazard_prob = min(0.95, max_r * 0.4 + np.random.uniform(-0.1, 0.15))
        has_microbial_hazard = np.random.random() < bio_hazard_prob
        
        if max_r <= 0.5 and not has_microbial_hazard:
            gt = "Low Risk"
            src, loc = locations[0]
        elif max_r <= 1.0 or (max_r <= 0.5 and has_microbial_hazard):
            gt = "Moderate Risk"
            src, loc = random.choice(locations[1:3])
        else:
            gt = "High Risk"
            src, loc = random.choice(locations[3:5])
            
        ground_truth.append(gt)
        sources.append(src)
        locs.append(loc)
        
    master_df = pd.DataFrame({
        "sample_id": [f"ALVIN-2026-{i+1:05d}" for i in range(n_master)],
        "timestamp": master_timestamps,
        "tds_mg_l": np.round(tds_all, 2),
        "turbidity_ntu": np.round(turb_all, 2),
        "r_tds": r_tds,
        "r_turb": r_turb,
        "ari": ari,
        "ass_score": ass_score,
        "ground_truth": ground_truth,
        "source": sources,
        "location": locs,
        "sampling_rate_hz": 5
    })
    
    master_csv_path = "data_alvin.csv"
    master_df.to_csv(master_csv_path, index=False)
    print(f"[OK] Master dataset berhasil dibuat: {master_csv_path} ({len(master_df)} baris)")
    
    print("\n[SUCCESS] Seluruh Data Alvin berhasil digenerasi!")

if __name__ == "__main__":
    main()
