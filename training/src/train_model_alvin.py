import os
import time
import pickle
import joblib
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, precision_recall_fscore_support

# Import Multiple ML Algorithms
from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier, GradientBoostingClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.svm import SVC
import xgboost as xgb
import lightgbm as lgb

def get_file_size_kb(filepath):
    if os.path.exists(filepath):
        return round(os.path.getsize(filepath) / 1024.0, 2)
    return 0.0

def main():
    print("="*70)
    print(" BENCHMARK & MULTI-ALGORITHM TRAINING SYSTEM (DATA ALVIN)")
    print("="*70)
    
    # 1. Setup paths
    src_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(src_dir)
    workspace_dir = os.path.dirname(base_dir)
    
    model_dir = os.path.join(base_dir, "model")
    results_dir = os.path.join(base_dir, "results")
    
    os.makedirs(model_dir, exist_ok=True)
    os.makedirs(results_dir, exist_ok=True)
    
    # 2. Load Dataset
    data_path = os.path.join(workspace_dir, "data_alvin.csv")
    if not os.path.exists(data_path):
        data_path = "data_alvin.csv"
        
    df = pd.read_csv(data_path)
    print(f"[+] Loaded Dataset: {data_path} ({len(df)} sampel)")
    
    feature_cols = ["tds_mg_l", "turbidity_ntu"]
    target_col = "ground_truth"
    
    X = df[feature_cols]
    y = df[target_col]
    
    # Label Encoder for XGBoost & LightGBM numeric targets
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)
    
    labels = ["Low Risk", "Moderate Risk", "High Risk"]
    
    # Stratified Train-Test Split
    X_train, X_test, y_train, y_test, y_train_enc, y_test_enc, idx_train, idx_test = train_test_split(
        X, y, y_encoded, df.index, test_size=0.20, random_state=42, stratify=y
    )
    
    print(f"[+] Data Split: {len(X_train)} Train, {len(X_test)} Test Samples.")
    
    # 3. Define Algorithms List
    algorithms = {
        "Random Forest": RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1),
        "Extra Trees": ExtraTreesClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1),
        "XGBoost": xgb.XGBClassifier(n_estimators=100, max_depth=6, random_state=42, eval_metric="mlogloss", n_jobs=-1),
        "LightGBM": lgb.LGBMClassifier(n_estimators=100, max_depth=6, random_state=42, n_jobs=-1, verbose=-1),
        "Gradient Boosting": GradientBoostingClassifier(n_estimators=100, max_depth=5, random_state=42),
        "K-Nearest Neighbors": KNeighborsClassifier(n_neighbors=5, n_jobs=-1),
        "Decision Tree": DecisionTreeClassifier(max_depth=10, random_state=42),
        "Support Vector Machine": SVC(kernel="rbf", C=1.0, probability=True, random_state=42)
    }
    
    benchmark_results = []
    confusion_matrices = {}
    predictions_dict = {}
    
    best_f1 = -1.0
    best_algo_name = ""
    best_model_obj = None
    
    print("\n" + "-"*70)
    print(" MENJALANKAN TRAINING & BENCHMARK UNTUK 8 ALGORITMA ML")
    print("-"*70)
    
    for algo_name, model in algorithms.items():
        # Clean file key name
        file_key = algo_name.lower().replace(" ", "_").replace("-", "_")
        
        # Train & Measure Time
        start_time = time.time()
        
        if algo_name in ["XGBoost", "LightGBM"]:
            model.fit(X_train, y_train_enc)
            pred_enc = model.predict(X_test)
            y_pred = le.inverse_transform(pred_enc)
        else:
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            
        train_time_sec = round(time.time() - start_time, 4)
        
        # Metrics
        acc = accuracy_score(y_test, y_pred)
        prec, rec, f1, _ = precision_recall_fscore_support(y_test, y_pred, average="weighted")
        
        # Save Model Artifacts (.joblib & .pkl)
        joblib_file = os.path.join(model_dir, f"{file_key}.joblib")
        pkl_file = os.path.join(model_dir, f"{file_key}.pkl")
        
        joblib.dump(model, joblib_file)
        with open(pkl_file, "wb") as f:
            pickle.dump(model, f)
            
        size_joblib_kb = get_file_size_kb(joblib_file)
        size_pkl_kb = get_file_size_kb(pkl_file)
        
        # Confusion Matrix
        cm = confusion_matrix(y_test, y_pred, labels=labels)
        confusion_matrices[algo_name] = cm
        predictions_dict[algo_name] = y_pred
        
        is_best = False
        if f1 > best_f1:
            best_f1 = f1
            best_algo_name = algo_name
            best_model_obj = model
            
        benchmark_results.append({
            "Algorithm": algo_name,
            "Accuracy (%)": round(acc * 100.0, 2),
            "Precision": round(prec, 4),
            "Recall": round(rec, 4),
            "F1-Score": round(f1, 4),
            "Train Time (sec)": train_time_sec,
            "Model Size Joblib (KB)": size_joblib_kb,
            "Model Size PKL (KB)": size_pkl_kb,
            "File Key": file_key
        })
        
        print(f" [+] {algo_name:22s} | Acc: {acc*100:6.2f}% | F1: {f1:.4f} | Time: {train_time_sec:6.3f}s | Size: {size_joblib_kb:7.2f} KB")

    # Mark Best Model
    for item in benchmark_results:
        item["Is Best Model"] = "YES" if item["Algorithm"] == best_algo_name else "NO"

    # Save Best Model to Standard File Name
    best_file_key = best_algo_name.lower().replace(" ", "_").replace("-", "_")
    master_joblib = os.path.join(model_dir, "model_aquasentry_alvin.joblib")
    master_pkl = os.path.join(model_dir, "model_aquasentry_alvin.pkl")
    root_joblib = os.path.join(workspace_dir, "model_aquasentry_alvin.joblib")
    
    joblib.dump(best_model_obj, master_joblib)
    joblib.dump(best_model_obj, root_joblib)
    with open(master_pkl, "wb") as f:
        pickle.dump(best_model_obj, f)

    # 4. Save Results Artifacts
    print("\n" + "-"*70)
    print(" MENYIMPAN HASIL COMPARISON & VISUALISASI DI results/")
    print("-"*70)

    # A. CSV Comparison Table
    results_df = pd.DataFrame(benchmark_results)
    csv_comp_path = os.path.join(results_dir, "algorithm_comparison_alvin.csv")
    results_df.to_csv(csv_comp_path, index=False)
    print(f"[+] Saved Comparison CSV: {csv_comp_path}")

    # B. Visual Chart PNG (Accuracy & Model Size & Train Time)
    fig, axes = plt.subplots(1, 3, figsize=(18, 5))
    
    sns.barplot(data=results_df, x="Accuracy (%)", y="Algorithm", hue="Algorithm", ax=axes[0], palette="Blues_r", legend=False)
    axes[0].set_title("Perbandingan Akurasi Algoritma ML (%)", fontsize=12, fontweight="bold")
    axes[0].set_xlim(80, 100)
    for p in axes[0].patches:
        width = p.get_width()
        if width > 0:
            axes[0].annotate(f"{width:.2f}%", (width - 3.5, p.get_y() + p.get_height()/2.),
                             ha='center', va='center', color='white', fontweight='bold')

    sns.barplot(data=results_df, x="Model Size Joblib (KB)", y="Algorithm", hue="Algorithm", ax=axes[1], palette="Greens_r", legend=False)
    axes[1].set_title("Ukuran File Model (KB)", fontsize=12, fontweight="bold")
    for p in axes[1].patches:
        width = p.get_width()
        if width > 0:
            axes[1].annotate(f"{width:.1f} KB", (width + 50, p.get_y() + p.get_height()/2.),
                             ha='left', va='center', fontsize=9)

    sns.barplot(data=results_df, x="Train Time (sec)", y="Algorithm", hue="Algorithm", ax=axes[2], palette="Oranges_r", legend=False)
    axes[2].set_title("Waktu Training (detik)", fontsize=12, fontweight="bold")
    for p in axes[2].patches:
        width = p.get_width()
        if width > 0:
            axes[2].annotate(f"{width:.3f}s", (width + 0.01, p.get_y() + p.get_height()/2.),
                             ha='left', va='center', fontsize=9)

    plt.tight_layout()
    chart_png_path = os.path.join(results_dir, "algorithm_comparison_chart.png")
    plt.savefig(chart_png_path, dpi=300)
    plt.close()
    print(f"[+] Saved Comparison Chart Plot: {chart_png_path}")

    # C. Grid of Confusion Matrices Plot (8 Subplots)
    fig, axes = plt.subplots(2, 4, figsize=(20, 10))
    axes = axes.flatten()
    
    for idx, (algo_name, cm) in enumerate(confusion_matrices.items()):
        cm_df = pd.DataFrame(cm, index=labels, columns=labels)
        sns.heatmap(cm_df, annot=True, fmt="d", cmap="YlGnBu", ax=axes[idx], cbar=False)
        axes[idx].set_title(f"{algo_name}", fontsize=11, fontweight="bold")
        axes[idx].set_ylabel("Actual")
        axes[idx].set_xlabel("Predicted")
        
    plt.suptitle("Grid Confusion Matrix Seluruh Algoritma ML", fontsize=15, fontweight="bold", y=1.02)
    plt.tight_layout()
    grid_cm_png = os.path.join(results_dir, "confusion_matrices_all_algos.png")
    plt.savefig(grid_cm_png, dpi=300, bbox_inches="tight")
    plt.close()
    print(f"[+] Saved Grid Confusion Matrix Plot: {grid_cm_png}")

    # D. Misclassified Samples for Best Model & All Algorithms Summary CSV
    best_pred = predictions_dict[best_algo_name]
    test_df = df.loc[idx_test].copy()
    test_df["actual_ground_truth"] = y_test
    test_df["predicted_risk"] = best_pred
    test_df["is_correct"] = test_df["actual_ground_truth"] == test_df["predicted_risk"]
    
    misclassified_df = test_df[~test_df["is_correct"]].sort_values("sample_id")
    misclass_csv = os.path.join(results_dir, f"misclassified_samples_{best_file_key}.csv")
    misclassified_df.to_csv(misclass_csv, index=False)
    print(f"[+] Saved Misclassified CSV (Best Model {best_algo_name}): {misclass_csv} ({len(misclassified_df)} baris)")

    # E. Detailed Evaluation Summary Text
    summary_txt = os.path.join(results_dir, "evaluation_summary_alvin.txt")
    with open(summary_txt, "w", encoding="utf-8") as f:
        f.write("========================================================================\n")
        f.write("        AQUASENTRY DATA ALVIN - MULTI ALGORITHM EVALUATION REPORT       \n")
        f.write("========================================================================\n\n")
        f.write(f"JUARA ALGORITMA TERBAIK: {best_algo_name.upper()}\n")
        f.write(f"Akurasi Teruji: {results_df.loc[results_df['Algorithm']==best_algo_name, 'Accuracy (%)'].values[0]:.2f}%\n")
        f.write(f"F1-Score: {results_df.loc[results_df['Algorithm']==best_algo_name, 'F1-Score'].values[0]:.4f}\n\n")
        
        f.write("TABEL PERBANDINGAN ALGORITMA:\n")
        f.write("-" * 80 + "\n")
        f.write(results_df.to_string(index=False) + "\n")
        f.write("-" * 80 + "\n\n")
        
        f.write("PENJELASAN ALGORITMA & KATEGORI:\n")
        f.write("1. Ensemble Tree (Bagging): Random Forest, Extra Trees\n")
        f.write("2. Ensemble Tree (Boosting): XGBoost, LightGBM, Gradient Boosting\n")
        f.write("3. Single Decision Tree: Decision Tree Classifier\n")
        f.write("4. Distance / Geometry Based: K-Nearest Neighbors (KNN)\n")
        f.write("5. Kernel Margin Based: Support Vector Machine (SVM)\n\n")
        
        f.write(f"REKAP SAMPEL MISCLASSIFIED UNTUK {best_algo_name.upper()}:\n")
        f.write(f"Total Sampel Uji: {len(X_test)}\n")
        f.write(f"Total Sampel Gagal Prediksi (Salah): {len(misclassified_df)}\n\n")
        
        f.write("CLASSIFICATION REPORT UNTUK MODEL TERBAIK:\n")
        f.write(classification_report(y_test, best_pred) + "\n")

    print(f"[+] Saved Comprehensive Evaluation Report TXT: {summary_txt}")
    
    print("\n" + "="*70)
    print(f" [WINNER] Algoritma Terbaik: {best_algo_name} (F1: {best_f1:.4f})")
    print(" [OK] Seluruh 8 Model & Berkas Hasil Evaluasi Berhasil Disimpan!")
    print("="*70)

if __name__ == "__main__":
    main()
