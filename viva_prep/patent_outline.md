# Project Outline — Predictive Maintenance using Unsupervised Machine Learning

## Title
Predictive Maintenance for Industrial Air Compressors using Unsupervised Machine Learning with Real-Time IoT Integration

## Field
Machine Learning, Industrial IoT, Predictive Maintenance, Anomaly Detection

## Problem
Industrial air compressors in metro trains are critical for brakes, doors, and suspension. Failures cause safety hazards and costly downtime. Traditional maintenance is either reactive (fix after failure) or preventive (fixed schedule). No labelled failure data exists for training supervised models.

## Solution
An end-to-end unsupervised ML system that monitors sensor data, segments operational behaviour into 3 states, detects anomalies, computes a real-time health score (0–100), and estimates Remaining Useful Life (RUL) — all without labelled data. Includes a live IoT integration where a phone's accelerometer serves as a vibration sensor.

## Dataset
- **Name:** MetroPT-3 (Air Compressor)
- **Source:** Air Production Unit, Porto Metro, Portugal
- **Published:** Nature Scientific Data, Vol 9, 2022 | DOI: 10.1038/s41597-022-01877-3
- **Repository:** UCI ML Repository, Dataset ID 791
- **Size:** ~1,516,948 rows, 15 sensor columns
- **Sampling:** Every ~10 seconds over 213 days (Feb–Sep 2020)
- **Sensors:** 7 analog (TP2, TP3, H1, DV_pressure, Reservoirs, Oil_temperature, Motor_current) + 8 digital (COMP, DV_eletric, Towers, MPG, LPS, Pressure_switch, Oil_level, Caudal_impulses)
- **Labels:** None (unsupervised). 5 documented air leak events exist externally.

## ML Pipeline (6 stages)
1. **Feature Engineering** — 15 raw sensors → 33 features (rolling mean/std over 60s window, rate of change, pressure drop, pressure ratio, temperature rise, motor load, compressor state)
2. **Normalization** — StandardScaler (zero mean, unit variance) fitted on training data only
3. **Dimensionality Reduction** — PCA: 33 features → 12 principal components retaining 96% variance
4. **Clustering** — MiniBatchKMeans (K=3, batch_size=10,000, KMeans++ init). Discovers 3 operational states: NORMAL, IDLE, HIGH-STRESS
5. **Anomaly Detection** — Isolation Forest (200 trees, 5% contamination, n_jobs=-1). Produces continuous anomaly score per reading
6. **Health Scoring** — Composite score combining cluster risk (0–70%), anomaly risk (0–25%), temperature risk (0–5%). Plus RUL estimation and alert classification (NORMAL/WARNING/CRITICAL)

## Key Technical Decisions
- MiniBatchKMeans over standard KMeans: handles 1.5M rows in ~40 seconds
- Isolation Forest over LOF/One-Class SVM: scales linearly vs O(n²)
- PCA over t-SNE/UMAP: deterministic, invertible, fast at inference
- Temporal train/test split at 2020-06-01 to prevent data leakage
- IQR-based outlier clipping on DV_pressure before feature engineering

## Evaluation Metrics
| Metric | Value | Interpretation |
|--------|-------|---------------|
| Silhouette Score | 0.6117 | Excellent cluster separation |
| Davies-Bouldin Index | 1.1267 | Good (lower is better) |
| Calinski-Harabasz Index | 20,024 | Strong cluster structure (higher is better) |
| PCA Variance Retained | 96% | Minimal information loss |
| Training Time | ~40 seconds | For 1.5M rows on commodity hardware |

## System Architecture
- **Backend:** FastAPI + Uvicorn (Python). Loads trained models at startup, pre-computes all dashboard data into memory cache
- **Frontend:** React + Vite dashboard with 6 tabs (Overview, Clusters, Anomalies, Sensors, Model Performance, IoT)
- **Real-Time:** WebSocket-based streaming for historical playback, synthetic fault simulation, and live IoT sensor data
- **IoT Integration:** Phone accelerometer → WebSocket → map to industrial sensor space → full ML pipeline → health prediction in <1ms
- **Alerts:** Telegram Bot API integration for critical anomaly notifications
- **Auth:** Token-based session authentication with password reset via Telegram OTP
- **Deployment:** Dockerized. HTTPS via self-signed SSL certificates for phone sensor access

## Models & Files Saved
- scaler.pkl (StandardScaler), pca_model.pkl (PCA 12-component), kmeans_model.pkl (MiniBatchKMeans K=3), isolation_forest.pkl (200 trees), cluster_name_map.pkl, feature_cols.pkl
- metropt_labelled.parquet (full dataset with predictions, ~167 MB)

## Novel Aspects
1. Dual-model unsupervised pipeline: clustering for state segmentation + isolation forest for anomaly scoring, combined into a single health metric
2. Real-time IoT integration using phone accelerometer as a vibration proxy sensor with live ML inference
3. Composite health score formula combining cluster risk, anomaly risk, and temperature risk into a 0–100 scale
4. Synthetic fault injection engine with 4 fault types (air leak, overheat, pressure drop, bearing wear) for live demonstration
5. Complete end-to-end system from raw sensor data to real-time dashboard with alerts — no labelled data required

## Libraries Used
pandas 2.2.2, numpy 1.26.4, scikit-learn 1.4.2, joblib 1.4.2, FastAPI 0.111.0, uvicorn 0.29.0, pyarrow 16.0.0, websockets 12.0, requests 2.31.0
