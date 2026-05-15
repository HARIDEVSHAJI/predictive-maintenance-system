Create a professional 10-slide presentation with a dark theme. Use ONLY the exact data, numbers, and facts provided below. Do NOT generate, assume, or add any information that is not explicitly written here. Every number, metric, and fact must come from this prompt only.

---

SLIDE 1 — TITLE SLIDE
Title: Predictive Maintenance for Air Compressors using Unsupervised Machine Learning
Subtitle: MiniBatchKMeans Clustering + Isolation Forest Anomaly Detection on MetroPT-3 Dataset
Bottom text: Unsupervised Machine Learning Project | 2025

---

SLIDE 2 — PROBLEM STATEMENT
Title: Why Predictive Maintenance?
Content:
- Industrial air compressors in metro trains power brakes, doors, and suspension
- Unplanned failures cause safety risks, service disruption, and high repair costs
- Three maintenance strategies: Reactive (fix after failure), Preventive (fixed schedule), Predictive (data-driven — fix before failure)
- Our approach: Use unsupervised ML on real sensor data to detect anomalies and predict equipment health in real-time
- Why unsupervised: No labelled failure data exists — the dataset has no column marking "normal" vs "faulty"

---

SLIDE 3 — DATASET
Title: MetroPT-3 Dataset — Real-World Industrial IoT Data
Content:
- Source: Air Production Unit (APU) of Porto Metro, Portugal
- Published: Nature Scientific Data, Volume 9, 2022 (DOI: 10.1038/s41597-022-01877-3)
- Also available: UCI ML Repository, Dataset ID 791
- Total rows: ~1,516,948 (1.5 million sensor readings)
- Sampling rate: 1 reading every ~10 seconds
- Time period: 213 days (February 2020 to September 2020)
- 7 analog sensors: TP2 (compressor pressure), TP3 (panel pressure), H1 (drying tower pressure), DV_pressure (valve pressure drop), Reservoirs (tank pressure), Oil_temperature (°C), Motor_current (A)
- 8 digital sensors: COMP, DV_eletric, Towers, MPG, LPS, Pressure_switch, Oil_level, Caudal_impulses
- Missing values: 0
- 5 documented air leak failure events in the dataset period

---

SLIDE 4 — METHODOLOGY / ML PIPELINE
Title: End-to-End ML Pipeline
Show this as a horizontal flow diagram or pipeline:
Step 1: Raw Sensor Data (1.5M rows, 15 sensors) →
Step 2: Feature Engineering (33 features: rolling mean, rolling std, rate of change, pressure drop, pressure ratio, temp rise, motor load) →
Step 3: StandardScaler (zero mean, unit variance) →
Step 4: PCA (33 features → 12 components, 96% variance retained) →
Step 5: MiniBatchKMeans (K=3 clusters: NORMAL, IDLE, HIGH-STRESS) →
Step 6: Isolation Forest (anomaly scoring, contamination=5%) →
Step 7: Health Score (0–100) + RUL Estimation + Alert Level

---

SLIDE 5 — CLUSTERING: MiniBatchKMeans
Title: Behaviour Segmentation — MiniBatchKMeans (K=3)
Content:
- Algorithm: MiniBatchKMeans (batch_size=10,000) — chosen over standard KMeans for speed with 1.5M rows
- K=3 selected via Elbow Method (sharpest inertia drop at K=3)
- Initialization: KMeans++ (smart centroid placement)
- 3 clusters discovered:
  - NORMAL: Standard operating conditions, lowest oil temperature
  - IDLE: Standby/low-load state, moderate temperature
  - HIGH-STRESS: Heavy load, highest oil temperature and motor current — potential fault precursor
- Training time: ~35–45 seconds for 1.5M rows

---

SLIDE 6 — ANOMALY DETECTION: Isolation Forest
Title: Anomaly Detection — Isolation Forest
Content:
- Core idea: Anomalies are "few and different" — they get isolated in fewer random splits
- n_estimators: 200 trees
- contamination: 5% (expected anomaly rate)
- Trained on scaled features (33 dimensions), NOT PCA-reduced
- Anomaly score range: -0.71 (most anomalous) to -0.34 (most normal)
- Alert thresholds: NORMAL (score ≥ -0.45), WARNING (-0.55 to -0.45), CRITICAL (score < -0.55)
- Detects: Air leaks, overheating, pressure drops, bearing wear
- Why not others: LOF and One-Class SVM are O(n²) — infeasible for 1.5M rows. DBSCAN gives no continuous score. Autoencoders need GPU and tuning.

---

SLIDE 7 — EVALUATION METRICS
Title: Model Evaluation Results
Content (show as a table or metric cards):
- Silhouette Score: 0.6117 (range -1 to +1, higher is better — excellent for real-world data)
- Davies-Bouldin Index: 1.1267 (lower is better — good cluster separation)
- Calinski-Harabasz Index: 20,024 (higher is better — strong cluster structure)
- PCA Components: 12 (retaining 96% of total variance from 33 features)
- Why not accuracy/F1: No ground-truth labels exist — this is unsupervised, so only internal cluster quality metrics can be used
- Elbow Method K values tested: K=2 to K=8. K=3 had best Silhouette (0.6117) with sharpest inertia drop (879,642)

---

SLIDE 8 — HEALTH SCORE & RUL SYSTEM
Title: Health Score & Remaining Useful Life (RUL)
Content:
- Health Score formula: 100 × (1 − (cluster_risk + anomaly_risk + temperature_risk))
  - Cluster risk: NORMAL=0%, IDLE=15%, HIGH-STRESS=70%
  - Anomaly risk: Up to 25% based on Isolation Forest score
  - Temperature risk: Up to 5% based on oil temperature
- Health Score: 100 = perfect health, 0 = critical failure
- RUL base hours: NORMAL=720h (30 days), IDLE=360h (15 days), HIGH-STRESS=48h (2 days)
- RUL reduced further by anomaly score penalty
- Alert levels: ✅ HEALTHY, 🟡 MONITOR, 🟠 URGENT, 🔴 EMERGENCY

---

SLIDE 9 — IoT INTEGRATION & REAL-TIME SYSTEM
Title: Real-Time IoT Sensor Integration
Content:
- Live dashboard built with FastAPI (backend) + React (frontend)
- Phone accelerometer used as IoT sensor via WebSocket (sends data every 500ms)
- Phone vibration mapped to industrial sensor space (TP2, TP3, Oil_temperature, Motor_current)
- Full ML pipeline runs on each reading in <1ms (scaler → PCA → KMeans → Isolation Forest → health score)
- Real-time alerts via Telegram Bot API (30-second cooldown to prevent flooding)
- Synthetic fault injection: Simulate air_leak, overheat, pressure_drop, bearing_wear faults live
- All 1.5M rows pre-cached at startup for instant dashboard loading
- Secure HTTPS with self-signed SSL certificates for phone sensor access

---

SLIDE 10 — CONCLUSION & FUTURE WORK
Title: Conclusion & Future Scope
Content:
- Successfully built an end-to-end unsupervised predictive maintenance system
- Processes 1.5M real sensor readings in ~40 seconds training time
- Achieves Silhouette Score of 0.6117 — excellent cluster quality with no labelled data
- Detects all 5 documented air leak failures in the MetroPT-3 dataset
- Real-time inference in <1ms per reading with live IoT phone integration
- Future improvements:
  - Concept drift detection and automatic model retraining
  - Deep learning autoencoders for enhanced anomaly detection
  - LSTM/Transformer models for long-term temporal pattern recognition
  - Deployment on edge devices for offline inference
