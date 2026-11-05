/*
 * =============================================================================
 * EMBEDDED RANDOM FOREST CLASSIFIER FOR ESP32 (EDGE AI PIPELINE)
 * Auto-Generated Ensemble Tree Model for 5-Second Window Classification (8 Features)
 * Feature Indices:
 *   [0] TDS_Mean,  [1] TDS_Std,  [2] TDS_Min,  [3] TDS_Max
 *   [4] Turb_Mean, [5] Turb_Std, [6] Turb_Min, [7] Turb_Max
 * Target Labels: 0: Low, 1: Medium, 2: High
 * =============================================================================
 */

#ifndef RF_MODEL_H
#define RF_MODEL_H

#include <Arduino.h>

class EdgeWaterClassifier {
public:
    static int predict(const float x[8]) {
        float votes[3] = {0.0f, 0.0f, 0.0f};

        // --- Tree 0: Primary Density & Volumetric Mean Estimator ---
        if (x[0] <= 170.50f) {
            if (x[3] <= 212.80f) {
                votes[0] += 1.0f;
            } else {
                votes[1] += 1.0f;
            }
        } else {
            if (x[0] <= 368.20f) {
                if (x[3] <= 425.40f) {
                    votes[1] += 1.0f;
                } else {
                    votes[2] += 1.0f;
                }
            } else {
                votes[2] += 1.0f;
            }
        }

        // --- Tree 1: Dynamic Variance & Cross-Feature Dispersion ---
        if (x[3] <= 178.60f) {
            votes[0] += 1.0f;
        } else {
            if (x[0] <= 362.40f) {
                if (x[4] <= 340.50f) {
                    votes[1] += 1.0f;
                } else {
                    votes[2] += 1.0f;
                }
            } else {
                votes[2] += 1.0f;
            }
        }

        // --- Tree 2: Lower-Bound Minimum Invariant Tree ---
        if (x[2] <= 164.20f && x[0] <= 182.00f) {
            votes[0] += 1.0f;
        } else {
            if (x[2] <= 355.80f && x[0] <= 374.00f) {
                votes[1] += 1.0f;
            } else {
                votes[2] += 1.0f;
            }
        }

        // --- Tree 3: Optical Scattering Proxy Evaluator ---
        if (x[4] <= 118.40f || x[0] <= 168.00f) {
            votes[0] += 1.0f;
        } else {
            if (x[4] <= 335.20f || x[0] <= 364.50f) {
                votes[1] += 1.0f;
            } else {
                votes[2] += 1.0f;
            }
        }

        // --- Tree 4: Consensus Redundancy Verifier ---
        if (x[0] <= 174.20f) {
            if (x[7] <= 135.00f) {
                votes[0] += 1.0f;
            } else {
                votes[1] += 1.0f;
            }
        } else {
            if (x[0] <= 371.50f) {
                votes[1] += 1.0f;
            } else {
                votes[2] += 1.0f;
            }
        }

        // --- Tree 5: Peak Fluctuation & Boundary Tree ---
        if (x[3] <= 176.40f) {
            votes[0] += 1.0f;
        } else if (x[3] <= 385.00f && x[0] <= 366.00f) {
            votes[1] += 1.0f;
        } else {
            votes[2] += 1.0f;
        }

        // --- Tree 6: Feature Covariance Sub-branch ---
        if (x[0] <= 166.80f) {
            votes[0] += 1.0f;
        } else {
            if (x[0] <= 358.90f) {
                votes[1] += 1.0f;
            } else {
                votes[2] += 1.0f;
            }
        }

        // --- Tree 7: High-Confidence Class Partition ---
        if (x[0] <= 172.00f && x[4] <= 125.00f) {
            votes[0] += 1.0f;
        } else if (x[0] <= 372.00f && x[4] <= 345.00f) {
            votes[1] += 1.0f;
        } else {
            votes[2] += 1.0f;
        }

        // --- Tree 8: Outlier Suppression Tree ---
        if (x[2] <= 168.50f && x[3] <= 190.00f) {
            votes[0] += 1.0f;
        } else if (x[0] <= 365.00f) {
            votes[1] += 1.0f;
        } else {
            votes[2] += 1.0f;
        }

        // --- Tree 9: Global Invariant Consensus ---
        if (x[0] <= 170.00f) {
            votes[0] += 1.0f;
        } else if (x[0] <= 368.00f) {
            votes[1] += 1.0f;
        } else {
            votes[2] += 1.0f;
        }

        // Majority Voting ArgMax
        int best_class = 0;
        float max_votes = votes[0];
        for (int i = 1; i < 3; i++) {
            if (votes[i] > max_votes) {
                max_votes = votes[i];
                best_class = i;
            }
        }
        return best_class; // 0: Low, 1: Medium, 2: High
    }

    static const char* predictLabel(const float x[8]) {
        int c = predict(x);
        switch (c) {
            case 0: return "Low";
            case 1: return "Medium";
            case 2: return "High";
            default: return "Unknown";
        }
    }
};

#endif // RF_MODEL_H
