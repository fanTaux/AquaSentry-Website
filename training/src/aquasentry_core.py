import os
import joblib
import pandas as pd

class AquaSentryCore:
    def __init__(self, model_path=None):
        self.ref_tds = 300.0  # Permenkes No. 2 Th 2023 (mg/L)
        self.ref_turb = 3.0   # Permenkes No. 2 Th 2023 (NTU)
        
        # Check standard model paths
        possible_paths = [
            model_path,
            os.path.join(os.path.dirname(__file__), "..", "model", "model_aquasentry_alvin.joblib"),
            os.path.join(os.path.dirname(__file__), "..", "model", "model_aquasentry_alvin.pkl"),
            "model_aquasentry_alvin.joblib",
            "training/model/model_aquasentry_alvin.joblib"
        ]
        
        self.model = None
        for path in possible_paths:
            if path and os.path.exists(path):
                try:
                    self.model = joblib.load(path)
                    self.model_path = path
                    break
                except Exception:
                    pass

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
            return "Low Risk", "Hijau", "Kedua parameter jauh di bawah ambang referensi"
        elif worst_r <= 1.0:
            return "Moderate Risk", "Kuning", "Mendekati atau berada pada ambang referensi"
        else:
            return "High Risk", "Merah", "Melebihi ambang batas referensi"

    def predict_ml_risk(self, tds: float, turbidity: float):
        """Random Forest Model Prediction"""
        if self.model is None:
            return "Model Not Loaded"
        
        features = pd.DataFrame([[tds, turbidity]], columns=["tds_mg_l", "turbidity_ntu"])
        prediction = self.model.predict(features)[0]
        return prediction

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
    print("="*60)
    print(" AQUASENTRY CORE INFERENCE & SKORING DEMO (DATA ALVIN)")
    print("="*60)
    
    sentry = AquaSentryCore()
    
    test_cases = [
        (100.0, 0.5),   # Clean water
        (180.0, 2.0),   # Moderate
        (350.0, 2.0),   # High (TDS exceeds ambang)
        (800.0, 7.0),   # Very High
        (120.0, 4.5)    # Turbidity exceeds ambang
    ]
    
    for tds, turb in test_cases:
        res = sentry.evaluate_sample(tds, turb)
        print(f"\n[+] Sample Input: TDS = {tds} mg/L, Turbidity = {turb} NTU")
        print(f"    - rTDS: {res['rTDS']} | rTurb: {res['rTurb']}")
        print(f"    - ARI: {res['ARI']} | ASS (0-100): {res['ASS Score (0-100)']}")
        print(f"    - Rule Category: {res['Rule Category']} (LED: {res['LED Indicator']})")
        print(f"    - ML Random Forest Prediction: {res['ML Random Forest Category']}")
        print(f"    - Meaning: {res['Meaning']}")
        
    print("\n" + "="*60)

if __name__ == "__main__":
    main()
