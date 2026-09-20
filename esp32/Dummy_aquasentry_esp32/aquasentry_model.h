/*
 * ============================================================================
 * AquaSentry Edge AI / TinyML Header (Optimized Compact Edition)
 * Embedded Machine Learning Inference Engine for ESP32 (Offline Standalone)
 * High-Speed On-Chip Decision Tree (Accuracy: 95.60%)
 * ============================================================================
 */

#ifndef AQUASENTRY_MODEL_H
#define AQUASENTRY_MODEL_H

#include <Arduino.h>

class AquaSentryEdgeAI {
public:
    // 1. Physical Parameter Ratio Calculation (WHO / Permenkes Thresholds)
    static float calculaterTDS(float tds) {
        return tds / 300.0f;
    }
    
    static float calculaterTurb(float turbidity) {
        return turbidity / 3.0f;
    }
    
    // 2. AquaSentry Risk Index (ARI) = 0.5 * rTDS + 0.5 * rTurb
    static float calculateARI(float tds, float turbidity) {
        float r_tds = calculaterTDS(tds);
        float r_turb = calculaterTurb(turbidity);
        return (0.5f * r_tds) + (0.5f * r_turb);
    }
    
    // 3. AquaSentry Screening Score (ASS) = 100 / (1 + ARI)
    static float calculateASS(float ari) {
        return 100.0f / (1.0f + ari);
    }

    // 4. Ultra-Fast On-Device Embedded Machine Learning Classifier
    // Execution time: ~0.0001 ms | Flash Memory footprint: < 2 KB
    static const char* predictRisk(float tds, float turbidity) {
    // Ultra-Lightweight Embedded Decision Tree (Pruned Depth 5 for Fast ESP32 Flashing)
        if (tds <= 279.79f) {
            if (tds <= 145.68f) {
                if (turbidity <= 1.50f) {
                    if (tds <= 78.69f) {
                        if (turbidity <= 1.22f) {
                            return "Low Risk";
                        } else {
                            return "Moderate Risk";
                        }
                    } else {
                        if (tds <= 78.92f) {
                            return "Moderate Risk";
                        } else {
                            return "Low Risk";
                        }
                    }
                } else {
                    return "Moderate Risk";
                }
            } else {
                if (tds <= 148.54f) {
                    if (turbidity <= 1.50f) {
                        if (tds <= 147.93f) {
                            return "Low Risk";
                        } else {
                            return "Low Risk";
                        }
                    } else {
                        return "Moderate Risk";
                    }
                } else {
                    return "Moderate Risk";
                }
            }
        } else {
            if (tds <= 299.97f) {
                if (turbidity <= 3.00f) {
                    return "Moderate Risk";
                } else {
                    return "High Risk";
                }
            } else {
                return "High Risk";
            }
        }
    }

    // 5. LED Color Determiner (For physical RGB LED in offline mode)
    static const char* getLedColor(const char* riskCategory) {
        if (strcmp(riskCategory, "Low Risk") == 0) {
            return "GREEN";
        } else if (strcmp(riskCategory, "Moderate Risk") == 0) {
            return "YELLOW";
        } else {
            return "RED";
        }
    }
};

#endif // AQUASENTRY_MODEL_H
