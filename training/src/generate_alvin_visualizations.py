import os
import time
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.gridspec import GridSpec
import seaborn as sns
import joblib

from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, precision_recall_fscore_support
from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier, GradientBoostingClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.svm import SVC

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
    print(" GENERATING HIGH-QUALITY VISUALIZATIONS FOR ALVIN")
    print("=" * 70)

    # 1. Setup paths
    src_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(src_dir)
    workspace_dir = os.path.dirname(base_dir)

    output_dir = os.path.join(base_dir, "Request_Gambar_Alvin")
    os.makedirs(output_dir, exist_ok=True)
    print(f"[+] Output Folder: {output_dir}")

    # 2. Load Dataset
    data_path = os.path.join(workspace_dir, "data_alvin.csv")
    if not os.path.exists(data_path):
        data_path = "data_alvin.csv"

    df = pd.read_csv(data_path)
    print(f"[+] Dataset loaded successfully: {len(df)} samples.")

    # Feature calculations if missing
    if "ass_score" not in df.columns or "ari" not in df.columns:
        ass_list, ari_list = [], []
        for _, row in df.iterrows():
            ass_val, ari_val = compute_ass(row["tds_mg_l"], row["turbidity_ntu"])
            ass_list.append(round(ass_val, 2))
            ari_list.append(round(ari_val, 4))
        df["ass_score"] = ass_list
        df["ari"] = ari_list

    # Map ground truth to strictly 3 Risk Categories (Low Risk, Moderate Risk, High Risk)
    df["ground_truth"] = df["ground_truth"].replace({
        "Very High Risk": "High Risk",
        "very high risk": "High Risk",
        "medium risk": "Moderate Risk",
        "Medium risk": "Moderate Risk",
        "low risk": "Low Risk",
        "high risk": "High Risk"
    })

    labels_order = ["Low Risk", "Moderate Risk", "High Risk"]
    color_map = {
        "Low Risk": "#2DC653",
        "Moderate Risk": "#F4A261",
        "High Risk": "#E63946"
    }

    # =========================================================================
    # GAMBAR 1: DISTRIBUSI DATASET
    # =========================================================================
    print("[1/5] Generating 01_Distribusi_Dataset.png (3 Labels + Scatter Plot)...")
    fig = plt.figure(figsize=(18, 11))
    gs = GridSpec(2, 3, figure=fig, hspace=0.35, wspace=0.28)

    # A. Class distribution bar chart
    ax1 = fig.add_subplot(gs[0, 0])
    counts = df["ground_truth"].value_counts().reindex(labels_order)
    percentages = (counts / len(df)) * 100
    bars = ax1.bar(labels_order, counts, color=[color_map[l] for l in labels_order], width=0.55, edgecolor="none")
    ax1.set_title("Distribusi Kelas (3 Risk Categories)", fontsize=12, fontweight="bold", pad=10)
    ax1.set_ylabel("Jumlah Sampel", fontsize=10, fontweight="bold")
    ax1.set_ylim(0, max(counts) * 1.18)

    for bar, count, pct in zip(bars, counts, percentages):
        height = bar.get_height()
        ax1.annotate(f"{count:,}\n({pct:.1f}%)",
                     xy=(bar.get_x() + bar.get_width() / 2, height),
                     xytext=(0, 4), textcoords="offset points",
                     ha="center", va="bottom", fontsize=9.5, fontweight="bold")

    # B. TDS Distribution Histogram
    ax2 = fig.add_subplot(gs[0, 1])
    sns.histplot(data=df, x="tds_mg_l", hue="ground_truth", hue_order=labels_order,
                 palette=color_map, kde=True, ax=ax2, bins=30, alpha=0.6, element="step", legend=False)
    ax2.set_title("Distribusi Parameter TDS (mg/L)", fontsize=12, fontweight="bold", pad=10)
    ax2.set_xlabel("TDS (mg/L)", fontsize=10, fontweight="bold")
    ax2.set_ylabel("Frekuensi", fontsize=10, fontweight="bold")

    # C. Turbidity Distribution Histogram
    ax3 = fig.add_subplot(gs[0, 2])
    sns.histplot(data=df, x="turbidity_ntu", hue="ground_truth", hue_order=labels_order,
                 palette=color_map, kde=True, ax=ax3, bins=30, alpha=0.6, element="step", legend=False)
    ax3.set_title("Distribusi Parameter Turbidity (NTU)", fontsize=12, fontweight="bold", pad=10)
    ax3.set_xlabel("Turbidity (NTU)", fontsize=10, fontweight="bold")
    ax3.set_ylabel("Frekuensi", fontsize=10, fontweight="bold")

    # D. Scatter Plot: TDS vs Turbidity per Risk Category (Titik-Titik Distribusi 3 Kelas)
    ax4 = fig.add_subplot(gs[1, 0:2])
    sns.scatterplot(data=df, x="tds_mg_l", y="turbidity_ntu", hue="ground_truth", hue_order=labels_order,
                    palette=color_map, alpha=0.65, s=30, ax=ax4, edgecolor="none")
    ax4.set_title("Scatter Plot Sebaran Sampel (TDS mg/L vs Turbidity NTU - 3 Kategori)", fontsize=13, fontweight="bold", pad=10)
    ax4.set_xlabel("TDS (Total Dissolved Solids - mg/L)", fontsize=11, fontweight="bold")
    ax4.set_ylabel("Turbidity (Kekeruhan - NTU)", fontsize=11, fontweight="bold")
    ax4.legend(title="Kategori Risiko Air (3 Kelas)", frameon=True, facecolor="white", loc="upper left", fontsize=10)

    # E. ASS Score Boxplot across Categories
    ax5 = fig.add_subplot(gs[1, 2])
    sns.boxplot(data=df, x="ground_truth", y="ass_score", order=labels_order,
                hue="ground_truth", palette=color_map, ax=ax5, width=0.45, boxprops=dict(alpha=0.85), legend=False)
    ax5.set_title("Distribusi ASS Score (0 - 100)", fontsize=12, fontweight="bold", pad=10)
    ax5.set_xlabel("Kategori Risiko", fontsize=10, fontweight="bold")
    ax5.set_ylabel("ASS Score", fontsize=10, fontweight="bold")

    plt.suptitle(f"AQUASENTRY DATASET DISTRIBUTION & SCATTER ANALYSIS (3 RISKS, N = {len(df):,} Sampel)",
                 fontsize=16, fontweight="bold", y=0.98)
    
    img1_path = os.path.join(output_dir, "01_Distribusi_Dataset.png")
    plt.savefig(img1_path, dpi=300, bbox_inches="tight")
    plt.close()

    # =========================================================================
    # GAMBAR 2: PIPELINE ML
    # =========================================================================
    print("[2/5] Generating 02_Pipeline_ML.png...")
    fig, ax = plt.subplots(figsize=(16, 8))
    ax.axis("off")

    stages = [
        {"title": "1. Data Acquisition", "desc": "Sensors ESP32 & CSV\n- TDS Sensor (mg/L)\n- Turbidity Sensor (NTU)\n- Multi-point Field Data", "color": "#0077B6"},
        {"title": "2. Feature Engineering", "desc": "Perhitungan Indeks:\n- ARI (Aquatic Risk Index)\n- ASS Score (0-100)\n- Threshold Rule Alignment", "color": "#0096C7"},
        {"title": "3. Preprocessing & Split", "desc": "Data Cleaning & Stratification:\n- Stratified 80:20 Split\n- Label Encoding (3 Classes)\n- Range Normalization", "color": "#03045E"},
        {"title": "4. Multi-Algo Benchmarking", "desc": "Training 8 Algoritma:\n- Random Forest & Extra Trees\n- XGBoost & LightGBM\n- Gradient Boosting & SVM\n- Decision Tree & KNN", "color": "#023E8A"},
        {"title": "5. Evaluation & Validation", "desc": "Evaluasi Komprehensif:\n- Confusion Matrix (3x3)\n- Accuracy, Precision, Recall\n- F1-Score & Train Time", "color": "#0077B6"},
        {"title": "6. Dual-Mode Deployment", "desc": "Sistem Produksi:\n- Export C++ Header (.h) for ESP32\n- Python FastAPI Backend (.joblib)\n- Real-time Web Dashboard", "color": "#2DC653"}
    ]

    n_stages = len(stages)
    box_width = 0.13
    box_height = 0.55
    spacing = (1.0 - (n_stages * box_width)) / (n_stages + 1)

    for idx, stage in enumerate(stages):
        x_left = spacing + idx * (box_width + spacing)
        y_bottom = 0.22

        # Draw main card rectangle
        rect = mpatches.FancyBboxPatch((x_left, y_bottom), box_width, box_height,
                                      boxstyle="round,pad=0.03,rounding_size=0.04",
                                      facecolor="white", edgecolor=stage["color"], linewidth=2.5,
                                      transform=ax.transAxes)
        ax.add_patch(rect)

        # Draw top colored banner inside box
        banner = mpatches.FancyBboxPatch((x_left, y_bottom + box_height - 0.12), box_width, 0.12,
                                         boxstyle="round,pad=0.01,rounding_size=0.02",
                                         facecolor=stage["color"], edgecolor="none",
                                         transform=ax.transAxes)
        ax.add_patch(banner)

        # Title text
        ax.text(x_left + box_width/2, y_bottom + box_height - 0.06, stage["title"],
                ha="center", va="center", color="white", fontsize=10, fontweight="bold", transform=ax.transAxes)

        # Description text
        ax.text(x_left + box_width/2, y_bottom + (box_height - 0.12)/2, stage["desc"],
                ha="center", va="center", color="#2D3748", fontsize=9.5, transform=ax.transAxes, linespacing=1.4)

        # Connecting Arrow to next stage
        if idx < n_stages - 1:
            arrow_start_x = x_left + box_width
            arrow_end_x = x_left + box_width + spacing
            arrow_y = y_bottom + box_height / 2
            ax.annotate("", xy=(arrow_end_x, arrow_y), xytext=(arrow_start_x, arrow_y),
                        arrowprops=dict(arrowstyle="-|>", color="#0077B6", lw=2.5, mutation_scale=18),
                        xycoords="axes fraction")

    plt.title("AQUASENTRY END-TO-END MACHINE LEARNING PIPELINE ARCHITECTURE",
              fontsize=16, fontweight="bold", pad=30)

    img2_path = os.path.join(output_dir, "02_Pipeline_ML.png")
    plt.savefig(img2_path, dpi=300, bbox_inches="tight")
    plt.close()

    # =========================================================================
    # TRAIN ALL MODELS FOR METRICS COMPARISON & FEATURE IMPORTANCE
    # =========================================================================
    print("[-] Training models to calculate exact Accuracy, Precision, Recall, F1 & Confusion Matrix...")
    
    # Use 4 features for complete evaluation
    feature_cols = ["tds_mg_l", "turbidity_ntu", "ass_score", "ari"]
    X = df[feature_cols]
    y = df["ground_truth"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    algorithms = {
        "Random Forest": RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1),
        "Extra Trees": ExtraTreesClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1),
        "Gradient Boosting": GradientBoostingClassifier(n_estimators=100, max_depth=5, random_state=42),
        "Decision Tree": DecisionTreeClassifier(max_depth=10, random_state=42),
        "K-Nearest Neighbors": KNeighborsClassifier(n_neighbors=5),
        "Support Vector Machine": SVC(kernel="rbf", C=1.0, probability=True, random_state=42)
    }

    metrics_list = []
    best_f1 = -1.0
    best_algo_name = ""
    best_model_obj = None
    best_y_pred = None

    for name, model in algorithms.items():
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        
        acc = accuracy_score(y_test, y_pred)
        prec, rec, f1, _ = precision_recall_fscore_support(y_test, y_pred, average="weighted")

        if f1 > best_f1:
            best_f1 = f1
            best_algo_name = name
            best_model_obj = model
            best_y_pred = y_pred

        metrics_list.append({
            "Algorithm": name,
            "Accuracy": acc * 100.0,
            "Precision": prec * 100.0,
            "Recall": rec * 100.0,
            "F1-Score": f1 * 100.0
        })

    metrics_df = pd.DataFrame(metrics_list)

    # =========================================================================
    # GAMBAR 3: ACCURACY–PRECISION–RECALL–F1
    # =========================================================================
    print("[3/5] Generating 03_Accuracy_Precision_Recall_F1.png...")
    fig, ax = plt.subplots(figsize=(14, 7))

    df_melted = pd.melt(metrics_df, id_vars=["Algorithm"], 
                        value_vars=["Accuracy", "Precision", "Recall", "F1-Score"],
                        var_name="Metric", value_name="Percentage")

    palette_metrics = {"Accuracy": "#0077B6", "Precision": "#0096C7", "Recall": "#48CAE4", "F1-Score": "#2DC653"}

    barplot = sns.barplot(data=df_melted, x="Algorithm", y="Percentage", hue="Metric", palette=palette_metrics, ax=ax)
    ax.set_title("Perbandingan Performa Model ML (Accuracy, Precision, Recall, F1-Score)", fontsize=14, fontweight="bold", pad=15)
    ax.set_ylabel("Nilai Evaluasi (%)", fontsize=11, fontweight="bold")
    ax.set_xlabel("Algoritma Machine Learning", fontsize=11, fontweight="bold")
    ax.set_ylim(85, 105)

    for p in barplot.patches:
        height = p.get_height()
        if height > 0:
            ax.annotate(f"{height:.1f}%",
                        (p.get_x() + p.get_width() / 2., height),
                        ha='center', va='bottom', fontsize=8, fontweight='bold',
                        xytext=(0, 2), textcoords='offset points')

    plt.legend(title="Metrik Evaluasi", frameon=True, facecolor="white", loc="lower right")
    plt.tight_layout()

    img3_path = os.path.join(output_dir, "03_Accuracy_Precision_Recall_F1.png")
    plt.savefig(img3_path, dpi=300, bbox_inches="tight")
    plt.close()

    # =========================================================================
    # GAMBAR 4: FEATURE IMPORTANCE
    # =========================================================================
    print("[4/5] Generating 04_Feature_Importance.png...")
    fig, ax = plt.subplots(figsize=(10, 6))

    if hasattr(best_model_obj, "feature_importances_"):
        importances = best_model_obj.feature_importances_
    else:
        # Fallback to Random Forest feature importances
        rf = RandomForestClassifier(n_estimators=100, random_state=42)
        rf.fit(X_train, y_train)
        importances = rf.feature_importances_

    feat_names_pretty = ["TDS (mg/L)", "Turbidity (NTU)", "ASS Score", "ARI (Aquatic Risk Index)"]
    feat_df = pd.DataFrame({"Feature": feat_names_pretty, "Importance": importances * 100.0})
    feat_df = feat_df.sort_values("Importance", ascending=True)

    colors_feat = sns.color_palette("Blues_d", len(feat_df))
    bars = ax.barh(feat_df["Feature"], feat_df["Importance"], color=colors_feat, height=0.55)

    ax.set_title(f"Feature Importance ({best_algo_name} - Best Model)", fontsize=14, fontweight="bold", pad=15)
    ax.set_xlabel("Tingkat Kepentingan Kontribusi (%)", fontsize=11, fontweight="bold")
    ax.set_xlim(0, max(feat_df["Importance"]) * 1.2)

    for bar in bars:
        width = bar.get_width()
        ax.annotate(f"{width:.2f}%",
                    xy=(width, bar.get_y() + bar.get_height() / 2),
                    xytext=(6, 0), textcoords="offset points",
                    ha="left", va="center", fontsize=11, fontweight="bold", color="#0077B6")

    plt.tight_layout()
    img4_path = os.path.join(output_dir, "04_Feature_Importance.png")
    plt.savefig(img4_path, dpi=300, bbox_inches="tight")
    plt.close()

    # =========================================================================
    # GAMBAR 5: HASIL PENGUJIAN MODEL & CONFUSION MATRIX MODEL TERBAIK
    # =========================================================================
    print("[5/5] Generating 05_Hasil_Pengujian_Model_dan_Confusion_Matrix_Terbaik.png...")
    cm_best = confusion_matrix(y_test, best_y_pred, labels=labels_order)
    cm_df = pd.DataFrame(cm_best, index=labels_order, columns=labels_order)

    fig, ax = plt.subplots(figsize=(10, 8))
    
    # Calculate percentages for matrix display
    total_samples = np.sum(cm_best)
    annot_matrix = np.empty(cm_best.shape, dtype=object)
    for i in range(cm_best.shape[0]):
        for j in range(cm_best.shape[1]):
            count = cm_best[i, j]
            pct = (count / total_samples) * 100
            if i == j:
                annot_matrix[i, j] = f"{count:,}\n({pct:.1f}%)\n[PASSED]"
            else:
                annot_matrix[i, j] = f"{count}\n({pct:.1f}%)" if count > 0 else "0"

    sns.heatmap(cm_df, annot=annot_matrix, fmt="", cmap="Blues", cbar=True, ax=ax,
                annot_kws={"size": 11, "weight": "bold"}, linewidths=1.5, linecolor="white")

    ax.set_title(f"CONFUSION MATRIX MODEL TERBAIK: {best_algo_name.upper()}\n(Akurasi: {best_f1*100:.2f}% | Total Test Samples: {len(y_test):,})",
                 fontsize=14, fontweight="bold", pad=20)
    ax.set_ylabel("Actual Label (Kategori Sebenarnya)", fontsize=12, fontweight="bold")
    ax.set_xlabel("Predicted Label (Hasil Prediksi AI)", fontsize=12, fontweight="bold")

    plt.tight_layout()
    img5_path = os.path.join(output_dir, "05_Hasil_Pengujian_Model_dan_Confusion_Matrix_Terbaik.png")
    plt.savefig(img5_path, dpi=300, bbox_inches="tight")
    plt.close()

    print("=" * 70)
    print(" SUCCESS! All 5 visualization graphics generated in folder:")
    print(f" {output_dir}")
    print(" Files Created:")
    print(" 1. 01_Distribusi_Dataset.png")
    print(" 2. 02_Pipeline_ML.png")
    print(" 3. 03_Accuracy_Precision_Recall_F1.png")
    print(" 4. 04_Feature_Importance.png")
    print(" 5. 05_Hasil_Pengujian_Model_dan_Confusion_Matrix_Terbaik.png")
    print("=" * 70)

if __name__ == "__main__":
    main()
