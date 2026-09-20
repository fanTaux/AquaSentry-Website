import os
import sys
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.colors import ListedColormap
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier
import xgboost as xgb

# Set overall seaborn aesthetic
sns.set_theme(style="whitegrid", font_scale=1.0)
plt.rcParams['font.sans-serif'] = 'Segoe UI, DejaVu Sans, Arial'
plt.rcParams['axes.edgecolor'] = '#CCCCCC'
plt.rcParams['axes.linewidth'] = 0.8

def compute_ass(tds, turbidity):
    r_tds = tds / 300.0
    r_turb = turbidity / 3.0
    ari = 0.5 * r_tds + 0.5 * r_turb
    ass = 100.0 / (1.0 + ari)
    return ass, ari

def main():
    print("=" * 70)
    print(" GENERATING STANDALONE FULL SCATTER PLOT & 3-MODEL DECISION BOUNDARY PLOTS")
    print("=" * 70)

    # Setup paths
    src_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(src_dir)
    workspace_dir = os.path.dirname(base_dir)

    output_dir = os.path.join(base_dir, "Request_Gambar_Alvin")
    os.makedirs(output_dir, exist_ok=True)
    results_dir = os.path.join(base_dir, "results")
    os.makedirs(results_dir, exist_ok=True)

    # 1. Load Dataset
    data_path = os.path.join(workspace_dir, "data_alvin.csv")
    if not os.path.exists(data_path):
        data_path = "data_alvin.csv"

    df = pd.read_csv(data_path)
    print(f"[+] Dataset loaded successfully: {len(df)} samples.")

    # Standardize to 3 labels
    df["ground_truth"] = df["ground_truth"].replace({
        "Very High Risk": "High Risk",
        "very high risk": "High Risk",
        "medium risk": "Moderate Risk",
        "Medium risk": "Moderate Risk",
        "low risk": "Low Risk",
        "high risk": "High Risk"
    })

    labels_order = ["Low Risk", "Moderate Risk", "High Risk"]
    color_dict = {
        "Low Risk": "#2DC653",
        "Moderate Risk": "#F4A261",
        "High Risk": "#E63946"
    }

    # Light background colors for decision boundary regions
    boundary_colors = ["#D8F3DC", "#FFE5D9", "#FFCCD5"]
    cmap_boundary = ListedColormap(boundary_colors)

    # Feature extraction & encoding
    X = df[["tds_mg_l", "turbidity_ntu"]]
    y = df["ground_truth"]

    le = LabelEncoder()
    le.fit(labels_order) # Fix encoding order: 0=Low, 1=Moderate, 2=High
    y_encoded = le.transform(y)

    X_train, X_test, y_train, y_test, y_train_enc, y_test_enc = train_test_split(
        X, y, y_encoded, test_size=0.20, random_state=42, stratify=y_encoded
    )

    # Train 3 models
    print("[+] Training 3 Target Models for Decision Boundary Visualizations...")
    
    models = {
        "Random Forest": RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1),
        "XGBoost": xgb.XGBClassifier(n_estimators=100, max_depth=6, random_state=42, eval_metric="mlogloss", n_jobs=-1),
        "Decision Tree (ESP32 TinyML)": DecisionTreeClassifier(max_depth=5, random_state=42)
    }

    trained_models = {}
    model_scores = {}

    for name, model in models.items():
        if "XGBoost" in name:
            model.fit(X_train, y_train_enc)
            pred_enc = model.predict(X_test)
        else:
            model.fit(X_train, y_train_enc)
            pred_enc = model.predict(X_test)

        acc = accuracy_score(y_test_enc, pred_enc)
        prec, rec, f1, _ = precision_recall_fscore_support(y_test_enc, pred_enc, average="weighted")
        
        trained_models[name] = model
        model_scores[name] = {"acc": acc * 100.0, "f1": f1 * 100.0}
        print(f" [+] {name:30s} | Acc: {acc*100:6.2f}% | F1: {f1*100:6.2f}%")

    # Meshgrid resolution for 2D decision boundary rendering
    x_min, x_max = 0, 1100
    y_min, y_max = 0, 15
    xx, yy = np.meshgrid(np.linspace(x_min, x_max, 400),
                         np.linspace(y_min, y_max, 400))
    grid_X = pd.DataFrame(np.c_[xx.ravel(), yy.ravel()], columns=["tds_mg_l", "turbidity_ntu"])

    # =========================================================================
    # GAMBAR A: FULL DEDICATED SCATTER PLOT 3 MODEL DECISION BOUNDARY (1x3 Layout)
    # =========================================================================
    print("[1/2] Generating 3-Model Decision Boundary & Scatter Plot...")
    fig, axes = plt.subplots(1, 3, figsize=(22, 7))

    for idx, (name, model) in enumerate(trained_models.items()):
        ax = axes[idx]
        
        # Predict meshgrid region
        Z_enc = model.predict(grid_X)
        Z = Z_enc.reshape(xx.shape)

        # Draw decision boundary contours
        ax.contourf(xx, yy, Z, levels=[-0.5, 0.5, 1.5, 2.5], cmap=cmap_boundary, alpha=0.75)
        ax.contour(xx, yy, Z, levels=[0.5, 1.5], colors="#888888", linewidths=1.2, linestyles="--")

        # Overlay actual scatter points
        sns.scatterplot(data=df, x="tds_mg_l", y="turbidity_ntu", hue="ground_truth", hue_order=labels_order,
                        palette=color_dict, alpha=0.6, s=28, ax=ax, edgecolor="none")

        acc_val = model_scores[name]["acc"]
        f1_val = model_scores[name]["f1"]

        ax.set_title(f"{name}\n(Akurasi: {acc_val:.2f}% | F1: {f1_val:.2f}%)", fontsize=13, fontweight="bold", pad=12)
        ax.set_xlabel("TDS (Total Dissolved Solids - mg/L)", fontsize=11, fontweight="bold")
        ax.set_ylabel("Turbidity (Kekeruhan - NTU)", fontsize=11, fontweight="bold")
        ax.set_xlim(x_min, x_max)
        ax.set_ylim(y_min, y_max)
        ax.legend(title="Kategori Risiko Air", frameon=True, facecolor="white", loc="upper left", fontsize=9.5)

    plt.suptitle("PERBANDINGAN SEBARAN SCATTER PLOT & BATAS KEPUTUSAN (DECISION BOUNDARY) 3 MODEL ML",
                 fontsize=16, fontweight="bold", y=1.02)
    plt.tight_layout()

    out_file1 = os.path.join(output_dir, "Scatter_Plot_TDS_vs_Turbidity_3_Model.png")
    out_res1 = os.path.join(results_dir, "Scatter_Plot_TDS_vs_Turbidity_3_Model.png")
    plt.savefig(out_file1, dpi=300, bbox_inches="tight")
    plt.savefig(out_res1, dpi=300, bbox_inches="tight")
    plt.close()
    print(f"[+] Saved 3-Model Decision Boundary Scatter Plot:\n    {out_file1}")

    # =========================================================================
    # GAMBAR B: FULL DEDICATED SINGLE SCATTER PLOT (ULTRA HIGH-RES FULLSCREEN)
    # =========================================================================
    print("[2/2] Generating Dedicated Standalone Fullscreen Scatter Plot...")
    fig, ax = plt.subplots(figsize=(14, 8))

    sns.scatterplot(data=df, x="tds_mg_l", y="turbidity_ntu", hue="ground_truth", hue_order=labels_order,
                    palette=color_dict, alpha=0.7, s=45, ax=ax, edgecolor="none")

    ax.set_title(f"Scatter Plot Sebaran Sampel Dataset (TDS mg/L vs Turbidity NTU - 3 Kategori)\nTotal N = {len(df):,} Sampel",
                 fontsize=15, fontweight="bold", pad=15)
    ax.set_xlabel("TDS (Total Dissolved Solids - mg/L)", fontsize=12, fontweight="bold")
    ax.set_ylabel("Turbidity (Kekeruhan - NTU)", fontsize=12, fontweight="bold")
    ax.legend(title="Kategori Risiko Air (3 Kelas)", frameon=True, facecolor="white", loc="upper left", fontsize=11)
    plt.tight_layout()

    out_file2 = os.path.join(output_dir, "01_Scatter_Plot_Full_TDS_vs_Turbidity.png")
    out_res2 = os.path.join(results_dir, "01_Scatter_Plot_Full_TDS_vs_Turbidity.png")
    plt.savefig(out_file2, dpi=300, bbox_inches="tight")
    plt.savefig(out_res2, dpi=300, bbox_inches="tight")
    plt.close()
    print(f"[+] Saved Full Standalone Scatter Plot:\n    {out_file2}")

    print("=" * 70)
    print(" SUCCESS! Both full-size scatter plot graphics created successfully!")
    print("=" * 70)

if __name__ == "__main__":
    main()
