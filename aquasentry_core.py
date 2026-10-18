import os
import joblib
import numpy as np

class AquaSentryCore:
    def __init__(self, model_path=None):
        self.ref_tds = 300.0   # Standar Permenkes No. 2 Th 2023 (mg/L)
        self.ref_turb = 3.0    # Standar Permenkes No. 2 Th 2023 (NTU)
        self.model = None

        if model_path is None:
            # Cari path model resmi dari direktori training/models
            cur_dir = os.path.dirname(os.path.abspath(__file__))
            candidates = [
                os.path.join(cur_dir, "training", "models", "random_forest.joblib"),
                os.path.join(cur_dir, "..", "training", "models", "random_forest.joblib"),
                os.path.join(cur_dir, "models", "random_forest.joblib"),
                os.path.join(cur_dir, "training", "models", "rf_water_model.joblib")
            ]
            for p in candidates:
                if os.path.exists(p):
                    model_path = p
                    break

        self.model_path = model_path
        if model_path and os.path.exists(model_path):
            try:
                loaded = joblib.load(model_path)
                if isinstance(loaded, dict) and "model" in loaded:
                    self.model = loaded["model"]
                else:
                    self.model = loaded
            except Exception as e:
                print(f"[!] Warning: Gagal memuat model ({e}), menggunakan fallback rule-based.")
                self.model = None

    def calculate_ratios(self, tds: float, turbidity: float):
        r_tds = round(tds / self.ref_tds, 4)
        r_turb = round(turbidity / self.ref_turb, 4)
        return r_tds, r_turb

    def calculate_ari(self, tds: float, turbidity: float) -> float:
        """AquaSentry Risk Index (ARI) = 0.5 * rTDS + 0.5 * rTurb"""
        r_tds, r_turb = self.calculate_ratios(tds, turbidity)
        return round(0.5 * r_tds + 0.5 * r_turb, 4)

    def calculate_ass(self, ari: float) -> float:
        """AquaSentry Screening Score (ASS) = 100 / (1 + ARI)"""
        return round(100.0 / (1.0 + ari), 2)

    def get_worst_ratio_category(self, tds: float, turbidity: float):
        """Rule-based Risk Category & LED Indicator"""
        r_tds, r_turb = self.calculate_ratios(tds, turbidity)
        worst_r = max(r_tds, r_turb)

        if worst_r <= 0.5:
            return "Low Risk", "Hijau", "Kedua parameter jauh di bawah ambang referensi baku mutu"
        elif worst_r <= 1.0:
            return "Moderate Risk", "Kuning", "Mendekati atau berada pada ambang referensi baku mutu"
        else:
            return "High Risk", "Merah", "Melebihi ambang batas referensi baku mutu permenkes"

    def predict_ml_risk(self, tds: float, turbidity: float):
        """
        Klasifikasi Edge AI Random Forest menggunakan 8 fitur jendela statistik:
        [tds_mean, tds_std, tds_min, tds_max, turb_mean, turb_std, turb_min, turb_max]
        """
        if self.model is None:
            rule_cat, _, _ = self.get_worst_ratio_category(tds, turbidity)
            return rule_cat

        # Membentuk 8 fitur statistik representatif
        tds_std = 5.0
        turb_std = 5.0
        features = np.array([[
            tds,
            tds_std,
            max(0.0, tds - 10.0),
            tds + 10.0,
            turbidity,
            turb_std,
            max(0.0, turbidity - 10.0),
            turbidity + 10.0
        ]])

        try:
            pred = self.model.predict(features)[0]
            label_map = {0: "Low Risk", 1: "Moderate Risk", 2: "High Risk"}
            if isinstance(pred, (int, np.integer)):
                return label_map.get(int(pred), "Unknown")
            elif isinstance(pred, str):
                if pred.lower() == "low":
                    return "Low Risk"
                elif pred.lower() in ["medium", "moderate"]:
                    return "Moderate Risk"
                elif pred.lower() == "high":
                    return "High Risk"
                return pred
            return str(pred)
        except Exception:
            rule_cat, _, _ = self.get_worst_ratio_category(tds, turbidity)
            return rule_cat

    def evaluate_sample(self, tds: float, turbidity: float):
        r_tds, r_turb = self.calculate_ratios(tds, turbidity)
        ari = self.calculate_ari(tds, turbidity)
        ass = self.calculate_ass(ari)
        rule_cat, led, meaning = self.get_worst_ratio_category(tds, turbidity)
        ml_cat = self.predict_ml_risk(tds, turbidity)

        return {
            "TDS (mg/L)": tds,
            "Turbidity (NTU)": turbidity,
            "rTDS": r_tds,
            "rTurb": r_turb,
            "ARI": ari,
            "ASS Score (0-100)": ass,
            "Rule Category": rule_cat,
            "LED Indicator": led,
            "ML Random Forest Category": ml_cat,
            "Meaning": meaning
        }

def main():
    print("=" * 65)
    print(" AQUASENTRY CORE INFERENCE DENGAN DATASET & MODEL RESMI")
    print("=" * 65)

    sentry = AquaSentryCore()

    test_cases = [
        (98.0, 11.0, "Air Bersih (Low Risk)"),
        (248.0, 168.0, "Air Sedang (Medium Risk)"),
        (497.0, 382.0, "Air Tercemar (High Risk)")
    ]

    for tds, turb, desc in test_cases:
        res = sentry.evaluate_sample(tds, turb)
        print(f"\n[+] Uji Sampel: {desc} -> TDS = {tds} mg/L, Turbidity = {turb} NTU")
        print(f"    - rTDS: {res['rTDS']} | rTurb: {res['rTurb']}")
        print(f"    - ARI: {res['ARI']} | ASS (0-100): {res['ASS Score (0-100)']}")
        print(f"    - Rule Category: {res['Rule Category']} (LED: {res['LED Indicator']})")
        print(f"    - ML Random Forest Category: {res['ML Random Forest Category']}")

    print("\n" + "=" * 65)

if __name__ == "__main__":
    main()
