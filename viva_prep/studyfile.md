# ðŸ“˜ STUDYFILE â€” Predictive Maintenance using Unsupervised Machine Learning

> **Purpose:** University viva and presentation preparation guide.  
> **Project:** Predictive Maintenance for Air Compressors using MiniBatchKMeans, Isolation Forest, and PCA on the MetroPT-3 dataset.  
> **Key Rule:** No raw code â€” everything is explained conceptually for confident viva answers.

---

## 1. PROJECT OVERVIEW

### What Is This Project?

This project is an **end-to-end predictive maintenance system** for industrial air compressors. It uses **unsupervised machine learning** to monitor real-time sensor data from a train air production unit (APU) and predict equipment health, detect anomalies, and estimate the **Remaining Useful Life (RUL)** of the compressor â€” all without any labelled failure data.

### Why Is Predictive Maintenance Important?

Industrial equipment failures cause massive downtime, safety hazards, and financial losses. There are three maintenance strategies:

- **Reactive Maintenance:** Fix it after it breaks. Cheapest upfront but causes unplanned downtime, safety risks, and cascading damage. A compressor failure mid-operation can halt an entire metro line.
- **Preventive Maintenance:** Scheduled maintenance at fixed intervals (e.g., every 30 days). Reduces surprise failures but wastes resources â€” you replace parts that still have life, and failures can still occur between intervals.
- **Predictive Maintenance (PdM):** Monitor equipment continuously with sensors, detect early degradation patterns, and schedule maintenance only when needed. This is the most cost-effective and is what this project implements.

**In Simple Words:** Instead of waiting for a machine to break or replacing parts on a schedule, we use sensor data and ML to predict when it will fail and fix it just in time.

### Why Unsupervised Learning?

This is an **unsupervised learning** problem because:

1. **No labelled failure data exists.** The MetroPT-3 dataset has sensor readings but no column saying "this is a failure" or "this is normal." Real industrial data almost never has clean labels because failures are rare and labelling millions of rows is impractical.
2. **Supervised learning requires labels** (e.g., "normal" vs "faulty") for every data point. We do not have that.
3. **Semi-supervised learning** requires at least some labels. We have none.
4. The approach is to let the algorithms **discover natural patterns** in the data â€” clustering finds operational states, and anomaly detection identifies deviations from normal behaviour.

**In Simple Words:** We cannot tell the model "this is broken" because nobody labelled the data. So we let the model figure out what "normal" looks like and flag anything unusual.

### What Is the MetroPT-3 Dataset?

The **MetroPT-3 (Metropolitan Portugal Transport â€” 3rd version)** dataset comes from a real air production unit (APU) installed in a metro train in **Porto, Portugal**. It was published in **Nature Scientific Data, Volume 9, Issue 1, 2022** (DOI: 10.1038/s41597-022-01877-3) and is also available on the **UCI Machine Learning Repository (Dataset ID 791)**. The data is released under the **Creative Commons CC BY 4.0** licence.

### What Is the Nature Scientific Data 2022 Paper?

This peer-reviewed paper documents the data collection methodology, sensor placement, and known failure events for the MetroPT system. It is significant because:
- It provides a rare, real-world, publicly available industrial IoT dataset
- It documents five known air leak failure events with timestamps
- It has been widely cited in predictive maintenance research

### What Is an Air Compressor and Why Monitor It?

An **air compressor** in a metro train produces compressed air for braking systems, door operations, and suspension. If the compressor fails:
- **Brakes may fail** â€” critical safety risk
- **Doors cannot open/close** â€” service disruption
- **The entire train must be taken out of service**

Monitoring the compressor's pressure, temperature, motor current, and oil levels allows early detection of issues like air leaks, overheating, and bearing wear.

---

## 2. DATASET â€” MetroPT-3 DEEP DIVE

### Every Sensor/Column Explained

The dataset has **17 columns** (15 sensor readings + timestamp + index). They are split into **analog** (continuous measurements) and **digital** (binary ON/OFF states):

**Analog Sensors (7):**

| Column | Physical Meaning | Unit |
|--------|-----------------|------|
| **TP2** | Compressor outlet pressure â€” measures pressure at the compressor discharge | bar |
| **TP3** | Pneumatic panel pressure â€” pressure at the distribution panel downstream | bar |
| **H1** | Air drying tower pressure â€” pressure inside the desiccant air dryer | bar |
| **DV_pressure** | Pressure drop across a valve â€” difference indicating valve health | bar |
| **Reservoirs** | Air tank/reservoir pressure â€” stored compressed air pressure | bar |
| **Oil_temperature** | Compressor lubricating oil temperature â€” indicates thermal stress | Â°C |
| **Motor_current** | Electric motor current draw â€” indicates mechanical load | A |

**Digital Sensors (8):**

| Column | Physical Meaning | Unit |
|--------|-----------------|------|
| **COMP** | Compressor motor ON/OFF state | 0/1 |
| **DV_eletric** | Electric discharge valve state | 0/1 |
| **Towers** | Drying towers active/inactive | 0/1 |
| **MPG** | Pressure generator motor state | 0/1 |
| **LPS** | Low Pressure Safety switch â€” triggers when pressure drops dangerously low | 0/1 |
| **Pressure_switch** | Pressure safety switch state | 0/1 |
| **Oil_level** | Oil level sensor â€” binary OK/low | 0/1 |
| **Caudal_impulses** | Air flow impulse counter â€” indicates air is flowing | 0/1 |

### Sampling Rate and Time Resolution

- **Sampling rate:** Approximately **one reading every 10 seconds**
- This is **time-series data** â€” ordered chronologically with a timestamp column
- **Total rows:** Approximately **1,516,948 rows** (~1.5 million)
- **Time period covered:** **213 days** â€” from **2020-02-01 to 2020-09-01** (about 7 months)
- **Missing values:** **0** â€” the dataset has no missing values in the raw form

### Known Failure/Fault Events

The dataset contains **5 documented air leak events**:

| Event ID | Date | Type | Severity | Duration |
|----------|------|------|----------|----------|
| #1a | 2020-04-18 | Air Leak | High | 24 hours |
| #1b | 2020-05-29 | Air Leak | High | 6.5 hours |
| #3 | 2020-06-05 | Air Leak | High | 52 hours |
| #4 | 2020-07-15 | Air Leak | High | 9.5 hours |
| #5 | 2020-07-16 | Air Leak | High | 9.5 hours |

### Was the Full Dataset Used?

Yes, the full ~1.5 million rows were used. The data was split temporally: rows before **2020-06-01** were used for training, and the remainder for testing. This is a time-based split, which is correct for time-series data (no data leakage from the future).

### Is There a Label Column?

No. There is no ground-truth label column in the dataset. The failure events are documented externally in the paper but are not encoded as labels in the CSV. This is precisely why unsupervised methods are used.

---

## 3. FEATURE ENGINEERING â€” WHY AND HOW

### What Features Were Engineered?

Starting from 7 analog sensor columns, the training script creates **33 total features**:

**Original 7 analog values:** TP2, TP3, H1, DV_pressure, Reservoirs, Oil_temperature, Motor_current

**Rolling Mean features (7):** `{sensor}_mean60` for each analog sensor â€” rolling window mean over 6 consecutive readings (~60 seconds of data). These capture the **short-term trend** by smoothing out noise.

**Rolling Standard Deviation features (7):** `{sensor}_std60` for each analog sensor â€” rolling window standard deviation over 6 readings. These capture **short-term volatility** â€” a sudden increase in std means the sensor value is fluctuating, which may indicate instability.

**Rate of Change (ROC) features (7):** `{sensor}_roc` for each analog sensor â€” computed using first-order differencing (current value minus previous value). These capture **how fast** a sensor value is changing. A sudden spike in ROC indicates a rapid change, which is a strong anomaly signal.

**Cross-sensor derived features (5):**
- **pressure_drop** = TP2 - TP3 â€” Pressure difference between compressor outlet and panel. A large drop indicates a leak.
- **pressure_ratio** = TP2 / (TP3 + 0.001) â€” Ratio of pressures. The 0.001 prevents division by zero.
- **temp_rise** = diff(Oil_temperature) â€” Rate of temperature change. Sudden rises indicate overheating.
- **motor_load** = Motor_current Ã— |TP2| â€” Proxy for mechanical load on the motor. High current at high pressure means heavy load.
- **COMP_int** = COMP cast to float â€” The digital compressor ON/OFF signal converted to a continuous feature for the ML pipeline.

### What Is a Rolling Window?

A **rolling window** (also called a sliding window) computes a statistic over the last N data points as you move through the data. Window size = **6 readings** â‰ˆ 60 seconds at 10-second sampling. This was chosen because 60 seconds captures meaningful short-term operational trends without being so long that it smooths out important transient events.

**In Simple Words:** Instead of looking at one reading at a time, look at the last 6 readings together to see trends and variability.

### Why Is Feature Engineering Critical Before Clustering?

Raw sensor values alone don't capture the dynamics of the system. KMeans clusters based on distance â€” if you only give it raw pressure values, it cannot distinguish between "pressure is steady at 9 bar" and "pressure just dropped from 10 to 8 bar in 30 seconds." The rolling stats and rate-of-change features encode this temporal behaviour into the feature space so the clustering algorithm can find meaningful operational states.

### DV_pressure Outlier Clipping

Before feature engineering, **DV_pressure** undergoes **IQR-based outlier clipping**: Q1 and Q3 are computed, IQR = Q3 - Q1, and values are clipped to [Q1 - 1.5Ã—IQR, Q3 + 1.5Ã—IQR]. This removes extreme spikes in the valve pressure drop sensor that could distort the rolling statistics and downstream models.

### Feature Count: Before vs After

- **Before engineering:** 7 analog + 8 digital = 15 sensor columns
- **After engineering:** 33 features used for ML (7 raw + 7 means + 7 stds + 7 ROCs + 5 derived)

### Order of Operations

1. Outlier clipping on DV_pressure
2. Feature engineering (rolling stats, diffs, cross-sensor)
3. Normalization (StandardScaler)
4. Dimensionality reduction (PCA)
5. Clustering & anomaly detection

This order matters: you must engineer features before scaling (so the scaler sees the full feature set), and scale before PCA (PCA is sensitive to scale).

---

## 4. NORMALIZATION â€” StandardScaler

### What Is StandardScaler?

**StandardScaler** transforms each feature to have **mean = 0** and **standard deviation = 1** using the formula:

**z = (x - Î¼) / Ïƒ**

Where Î¼ is the mean of the feature and Ïƒ is the standard deviation, both computed from the training data.

### Why Normalize Before Clustering?

KMeans uses **Euclidean distance** to assign points to clusters. If features have different scales (e.g., Oil_temperature ranges 15â€“89Â°C while Motor_current ranges 0.02â€“9.3A), the algorithm will be dominated by the larger-scale feature. Normalization ensures all features contribute equally to the distance calculation.

**In Simple Words:** If one sensor measures in thousands and another in fractions, the big-number sensor will dominate KMeans completely. Scaling puts them all on equal footing.

### Why StandardScaler and Not Others?

- **MinMaxScaler** scales to [0, 1] â€” sensitive to outliers because a single extreme value stretches the range. StandardScaler is more robust because it uses mean/std.
- **RobustScaler** uses median and IQR â€” good for heavy outliers, but our data has already been cleaned (DV_pressure clipping). StandardScaler is the standard choice for PCA-based pipelines.
- **Normalizer** scales each sample (row) to unit norm â€” this changes the relationship between features within a sample, which is not what we want. We want to scale features (columns) independently.

### Scaler Fitting: Training Data Only

The scaler is fitted **only on training data** (before 2020-06-01) and then used to transform both training and full data. This prevents **data leakage** â€” if you fit on the full dataset, the scaler would "know" statistics from the future test period, which is unrealistic in production.

### Saving and Reloading

The scaler is saved as `scaler.pkl` using **Joblib** and reloaded at inference time so that new data is transformed with the exact same mean and std as the training data.

---

## 5. DIMENSIONALITY REDUCTION â€” PCA

### What Is PCA?

**Principal Component Analysis (PCA)** is a linear dimensionality reduction technique. It finds new axes (called **principal components**) that are linear combinations of the original features, ordered by the amount of **variance** they explain. The first component captures the most variance, the second captures the most remaining variance (orthogonal to the first), and so on.

**In Simple Words:** PCA rotates your data into new coordinates where the first few axes capture most of the "information" (variance). You can then drop the last few axes that carry mostly noise.

### What Is a Principal Component?

A principal component is a new feature that is a weighted sum of the original features. For example, PC1 might be 0.3Ã—TP2 + 0.25Ã—TP3 + 0.2Ã—Oil_temp + ... The weights (called **loadings**) are chosen to maximize the variance captured.

### PCA Configuration in This Project

- **n_components = 12** â€” reduces from 33 features to 12 components
- **Variance retained: ~96%** â€” the 12 components explain about 96% of the total variance
- **random_state = 42** â€” for reproducibility

### Explained Variance Per Component

| Component | Variance (%) | Cumulative (%) |
|-----------|-------------|----------------|
| PC1 | 37.3 | 37.3 |
| PC2 | 16.9 | 54.2 |
| PC3 | 10.6 | 64.8 |
| PC4 | 7.5 | 72.3 |
| PC5 | 6.4 | 78.7 |
| PC6 | 3.5 | 82.2 |
| PC7 | 3.4 | 85.6 |
| PC8 | 3.1 | 88.7 |
| PC9 | 2.4 | 91.1 |
| PC10 | 1.9 | 93.0 |
| PC11 | 1.5 | 94.5 |
| PC12 | 1.3 | 95.8 |

### Why 12 Components and 96% Variance?

- **96% is a strong threshold** â€” it retains almost all meaningful information while discarding the ~4% that is mostly noise.
- **90% would lose too much** â€” some subtle fault signatures in minor components would be lost.
- **99% or 100% would defeat the purpose** â€” you'd keep noise-laden components, increasing dimensionality and hurting clustering quality.
- **12 components** is a significant reduction from 33 features (63% fewer dimensions), which speeds up KMeans and reduces the **curse of dimensionality**.

### What Is the Curse of Dimensionality?

In high-dimensional spaces, distances between points become increasingly similar (everything is "far away"), making distance-based algorithms like KMeans ineffective. PCA reduces dimensions so that Euclidean distance remains meaningful.

### Why PCA After Scaling and Before Clustering?

- PCA must come **after scaling** because PCA maximizes variance. If features have different scales, PCA will be dominated by the high-variance (large-scale) features.
- PCA must come **before clustering** because clustering benefits from the reduced, denoised feature space.

### What Information Is Lost?

The ~4% of variance discarded likely represents sensor noise, minor measurement artifacts, and very low-energy patterns that don't correspond to meaningful operational states. This is actually beneficial â€” removing noise improves clustering quality.

### PCA Object Saved

Saved as `pca_model.pkl` via Joblib. At inference, the same PCA transformation is applied (no refitting) to ensure consistency.

### 2D PCA for Visualization

A separate **PCA with n_components=2** is also fitted for creating 2D scatter plots of the clusters. This is purely for visualization â€” the ML pipeline uses the 12-component PCA.

---

## 6. CLUSTERING â€” MiniBatchKMeans

### What Is KMeans?

**KMeans** is a partitioning algorithm that divides data into K clusters. The algorithm:

1. **Initialize** K cluster centres (centroids) â€” using KMeans++ for smart initialization
2. **Assign** each data point to its nearest centroid (using Euclidean distance)
3. **Update** each centroid to the mean of all points assigned to it
4. **Repeat** steps 2â€“3 until centroids stop moving (convergence) or max iterations reached

### Objective Function

KMeans minimizes **WCSS (Within-Cluster Sum of Squares)**, also called **inertia**: the sum of squared distances from each point to its assigned centroid. Lower inertia = tighter clusters.

### What Is MiniBatchKMeans?

**MiniBatchKMeans** is a variant that does not use the entire dataset in each iteration. Instead, it samples a random **mini-batch** of data points (batch_size=10,000 in this project), performs the assign-update step on that batch, and repeats. This is dramatically faster for large datasets.

### Why MiniBatchKMeans for This Project?

With **~1.5 million rows**, standard KMeans would need to compute distances from every point to every centroid in every iteration â€” extremely memory-intensive and slow. MiniBatchKMeans processes 10,000 rows at a time, making it feasible to train in ~35â€“45 seconds.

### Quality Tradeoff

MiniBatchKMeans produces **slightly less optimal** clusters than standard KMeans (higher inertia) but the difference is typically less than 1%. For 1.5M rows, the speed gain (orders of magnitude faster) far outweighs the marginal quality loss.

### Hyperparameters Used

| Parameter | Value | Why |
|-----------|-------|-----|
| **n_clusters** | 3 | Determined by Elbow Method |
| **random_state** | 42 | Reproducibility â€” ensures same results every run |
| **n_init** | 10 | Run KMeans 10 times with different initial centroids, keep the best (lowest inertia). Reduces sensitivity to initialization. |
| **batch_size** | 10,000 | Number of samples per mini-batch. 10K balances speed and convergence quality. |
| **max_iter** | 300 | Maximum iterations. 300 is generous â€” KMeans usually converges in 50â€“100. |

### KMeans++ Initialization

**KMeans++** is a smart centroid initialization strategy (the default in scikit-learn). Instead of picking K random points, it:
1. Pick the first centroid randomly
2. For each subsequent centroid, pick a point with probability proportional to its squared distance from the nearest existing centroid

This spreads initial centroids apart, leading to faster convergence and better final clusters. Random initialization can lead to poor local minima.

### Elbow Method

The **Elbow Method** plots K (number of clusters) on the x-axis against **inertia** (WCSS) on the y-axis.

| K | Silhouette | Davies-Bouldin | Calinski-Harabasz | Inertia |
|---|-----------|----------------|-------------------|---------|
| 2 | 0.608 | 1.0535 | 27,851.8 | 1,017,029 |
| 3 | **0.6117** | 1.1267 | 20,023.9 | **879,642** |
| 4 | 0.4205 | 1.1712 | 20,684.9 | 706,703 |
| 5 | 0.2593 | 1.2531 | 16,442.6 | 684,282 |
| 6 | 0.4362 | 1.2031 | 19,283.1 | 545,666 |
| 7 | 0.4492 | 0.9318 | 19,288.5 | 477,833 |
| 8 | 0.3350 | 1.1942 | 16,797.8 | 472,667 |

The "elbow" appears at **K=3** â€” a sharp decrease in inertia from K=2 to K=3, then diminishing returns. K=3 also has the **highest Silhouette Score (0.6117)**, confirming 3 is optimal.

- **K=2** has a slightly lower Silhouette (0.608) and much higher inertia â€” it merges two distinct states into one.
- **K=4+** shows dropping Silhouette scores (0.42, 0.26) â€” splitting too finely, creating artificial sub-clusters.

### What Do the 3 Clusters Represent?

The clusters are **named automatically** by the code based on sensor characteristics:

1. **NORMAL** â€” Lowest oil temperature. The compressor is running within normal operating parameters. Most data points fall here.
2. **IDLE** â€” Moderate oil temperature, higher TP2. The compressor is in a standby/idle state with minimal load.
3. **HIGH-STRESS** â€” High oil temperature, high motor current. The compressor is under heavy load, possibly approaching a fault condition.

The naming logic sorts clusters by mean Oil_temperature (lowest = NORMAL), then differentiates the remaining two by mean TP2 pressure.

### Limitations of KMeans

- **Spherical cluster assumption** â€” KMeans assumes clusters are roughly spherical and equally sized. Non-convex or elongated clusters are poorly handled.
- **Must specify K** â€” You must choose the number of clusters in advance.
- **Outlier sensitivity** â€” Extreme outliers pull centroids. MiniBatch helps mitigate this somewhat.
- **Local minima** â€” Can converge to suboptimal solutions (mitigated by n_init=10).

---

## 7. ANOMALY DETECTION â€” Isolation Forest

### What Is Isolation Forest?

**Isolation Forest** is an unsupervised anomaly detection algorithm based on the idea that **anomalies are few and different**, so they are easier to "isolate" using random splits.

### How It Works

1. Build many **random isolation trees**: at each node, randomly pick a feature and a random split value within the feature's range.
2. Each data point eventually ends up isolated in its own leaf node after some number of splits.
3. **Anomalies require fewer splits** to isolate because they are far from the dense cluster of normal points. Normal points are surrounded by similar points and need many splits.
4. The **anomaly score** is based on the average path length (number of splits) across all trees. Shorter path = more anomalous.

**In Simple Words:** Imagine randomly cutting a pizza. If a piece of pepperoni is alone in a corner, one or two cuts isolate it. If it's in the middle of a crowd of pepperoni, you need many cuts. Anomalies are the loners.

### Hyperparameters Used

| Parameter | Value | Why |
|-----------|-------|-----|
| **n_estimators** | 200 | Number of isolation trees in the forest. 200 gives a stable, reliable anomaly score. 100 is the default but can be noisy; 200 provides smoother scores without excessive compute. 500+ adds little benefit. |
| **contamination** | 0.05 (5%) | Expected fraction of anomalies. 5% is a standard choice for industrial data â€” it means roughly 1 in 20 readings is expected to be anomalous. This sets the decision threshold. |
| **random_state** | 42 | Reproducibility |
| **n_jobs** | -1 | Use all CPU cores for parallel tree construction â€” critical for speed with 1.5M rows |
| **max_samples** | 'auto' | Defaults to min(256, n_samples). Each tree is built on a subsample of 256 points, which is sufficient for isolation and keeps trees shallow. |

### Anomaly Score Range

In scikit-learn, `score_samples()` returns negative values. More negative = more anomalous. In this project, scores range from approximately **-0.71 (most anomalous)** to **-0.34 (most normal)**.

### Alert Thresholds

- **NORMAL:** score â‰¥ -0.45
- **WARNING:** -0.55 â‰¤ score < -0.45
- **CRITICAL:** score < -0.55

### Why Isolation Forest Over Other Methods?

- **LOF (Local Outlier Factor):** Computes local density ratios â€” requires computing distances to K nearest neighbours for every point. With 1.5M rows this is computationally prohibitive (O(nÂ²) in the worst case). Also LOF is better for local anomalies; our anomalies are global.
- **One-Class SVM:** Learns a boundary around normal data. Training time is O(nÂ² to nÂ³) â€” completely infeasible for 1.5M rows. Also sensitive to kernel choice and parameters.
- **DBSCAN:** A density-based clustering algorithm, not designed for scoring individual anomalies. It marks "noise" points but does not produce a continuous anomaly score. Also struggles with varying density and high dimensions.
- **Autoencoder:** A deep learning approach â€” trains a neural network to reconstruct normal data, then uses reconstruction error as anomaly score. Effective but requires careful architecture design, hyperparameter tuning, GPU resources, and more training time. Overkill for this tabular data problem.
- **Elliptic Envelope:** Assumes data follows a multivariate Gaussian distribution. Industrial sensor data rarely follows a clean Gaussian, so this assumption is violated.

### Relationship with KMeans

Isolation Forest is **independent** of KMeans in the ML pipeline. Both operate on different representations:
- KMeans uses the **PCA-reduced features** (12 components) for clustering
- Isolation Forest uses the **scaled features** (33 features after StandardScaler) for anomaly scoring

Their outputs are **combined** in the health score formula (see Section 8). The cluster label provides the "operational state" context, while the anomaly score provides the "how unusual is this specific reading" assessment.

### What Faults Does This Detect?

- **Air Leaks:** Pressure drops (TP2, TP3) while motor current increases as the compressor works harder. The anomaly score drops significantly.
- **Overheating:** Oil temperature rises above normal range, indicating friction, lubrication failure, or excessive load.
- **Bearing Wear:** Motor current increases while pressures remain stable â€” the motor is drawing more power to overcome mechanical resistance.
- **Pressure Drops:** Sudden loss of reservoir pressure indicating valve failures or system leaks.

### Model Saved

Saved as `isolation_forest.pkl` (~2 MB) via Joblib.

---

## 8. HEALTH SCORE / ANOMALY SCORING SYSTEM

### How Is the Health Score Computed?

The health score is a **composite metric from 0 to 100** combining three risk factors:

**Health Score = 100 Ã— (1 - clamp(cluster_risk + anomaly_risk + temperature_risk, 0, 1))**

**1. Cluster Risk (cr):**
| Cluster | Risk Value |
|---------|-----------|
| NORMAL | 0.00 |
| IDLE | 0.15 |
| HIGH-STRESS | 0.70 |

**2. Anomaly Risk (ar):**
`ar = clamp((-anomaly_score - 0.34) / 0.37, 0, 1) Ã— 0.25`

This normalizes the anomaly score to a 0â€“1 range and scales it to contribute up to 25% of total risk. The constants -0.34 and 0.37 are derived from the observed score range.

**3. Temperature Risk (tr):**
`tr = clamp((Oil_temperature - 62.64) / 26.41, 0, 1) Ã— 0.05`

This adds up to 5% risk when oil temperature exceeds the mean (62.64Â°C). The denominator 26.41 is the observed range.

### What Does the Score Mean?

- **100** = Perfect health â€” NORMAL cluster, no anomalies, normal temperature
- **85â€“100** = Healthy operation
- **30â€“85** = Warning zone â€” elevated risk from cluster state or anomaly score
- **0â€“30** = Critical â€” HIGH-STRESS with strong anomalies

### RUL (Remaining Useful Life) Estimation

**Base RUL** depends on cluster:
| Cluster | Base RUL (hours) |
|---------|-----------------|
| NORMAL | 720 (30 days) |
| IDLE | 360 (15 days) |
| HIGH-STRESS | 48 (2 days) |

**Penalty:** `penalty = max(0, (-anomaly_score - 0.45) / 0.26) Ã— 48`

**Final RUL = max(1, round(base - penalty))**

### Recommendation System

Based on cluster and RUL:
- **ðŸ”´ EMERGENCY:** HIGH-STRESS cluster or RUL â‰¤ 24 hours â†’ "Inspect compressor immediately"
- **ðŸŸ  URGENT:** RUL â‰¤ 72 hours â†’ "Schedule maintenance within X hours"
- **ðŸŸ¡ MONITOR:** IDLE cluster or RUL â‰¤ 168 hours â†’ "Inspect within X days"
- **âœ… HEALTHY:** Normal operation â†’ "Next check in ~X days"

### Inference Pipeline (Real-Time)

When a new sensor reading arrives:
1. **Feature engineering** â€” compute rolling stats, diffs, derived features (for single row: mean = value itself, std = 0, roc = 0)
2. **Scale** â€” transform using the saved StandardScaler (no refitting)
3. **PCA** â€” transform using the saved PCA model (no refitting)
4. **KMeans predict** â€” assign to nearest cluster centroid
5. **Isolation Forest score** â€” compute anomaly score on the scaled (not PCA-reduced) features
6. **Compute health score** â€” combine cluster risk + anomaly risk + temperature risk
7. **Compute RUL** â€” base hours minus anomaly penalty
8. **Generate recommendation** â€” based on cluster and RUL

---

## 9. MODEL EVALUATION â€” Every Metric

### Why Can't We Use Accuracy, Precision, Recall, or F1?

These are **supervised metrics** that require ground-truth labels. Since this is an unsupervised problem with no labels, we cannot compute any of them. There is no "correct answer" to compare against. This is the fundamental challenge of evaluating unsupervised models.

**In Simple Words:** You cannot grade a test if you do not have an answer key. We have no answer key, so we use internal quality measures instead.

### Silhouette Score

**What it measures:** For each data point, it compares how close it is to points in its own cluster (cohesion, **a**) versus how close it is to points in the nearest other cluster (separation, **b**).

**Formula:** s(i) = (b(i) - a(i)) / max(a(i), b(i))

- **Range:** -1 to +1
- **+1:** Point is far from other clusters and close to its own cluster (perfect)
- **0:** Point is on the boundary between clusters
- **-1:** Point is assigned to the wrong cluster

**Score in this project: 0.6117** â€” This is an **excellent** score for real-world industrial data. Anything above 0.5 indicates strong cluster structure. Perfect scores (>0.8) are rare in messy real-world data.

A **silhouette diagram** plots the silhouette value for every data point, grouped by cluster, as a horizontal bar chart. Wide, uniform bars indicate good clusters.

Note: The silhouette score was computed on a **sample of 10,000 points** (random_state=42) from the training data for efficiency, since computing it on 1.5M rows would be extremely slow (O(nÂ²) distance computation).

### Davies-Bouldin Index

**What it measures:** The average ratio of within-cluster scatter to between-cluster separation. For each pair of clusters, it computes how "similar" they are (large within-cluster spread + small between-cluster distance = bad).

- **Lower is better.** A score of 0 means perfect separation.
- **Score: 1.1267** â€” This is reasonable. Values around 1 indicate moderate cluster overlap, which is expected in real industrial data where operational states transition smoothly.

### Calinski-Harabasz Index (Variance Ratio Criterion)

**What it measures:** The ratio of between-cluster dispersion to within-cluster dispersion. Higher means tighter, more separated clusters.

- **Higher is better.**
- **Score: 20,024** â€” This is a very high score, indicating strong cluster structure with well-separated centroids relative to intra-cluster spread. The large value is partly due to the large sample size.

### Why Use All 3 Metrics Together?

Each metric captures different aspects:
- **Silhouette** measures per-point quality (closest to intuitive "how well assigned is each point")
- **Davies-Bouldin** is sensitive to the worst pair of clusters (catches merging issues)
- **Calinski-Harabasz** measures global separation vs compactness

A model with high Silhouette, low Davies-Bouldin, and high Calinski-Harabasz is well-validated. If only one metric is good and others are bad, the clustering may have issues.

### What Would Bad Clustering Look Like?

- Silhouette near 0 or negative â€” points assigned to wrong clusters
- Davies-Bouldin above 2â€“3 â€” clusters heavily overlapping
- Calinski-Harabasz below 100 â€” no meaningful separation

---

## 10. TRAINING PIPELINE â€” End to End

### Exact Sequence of Steps in train.py

1. **Load CSV** â€” Read MetroPT3(AirCompressor).csv using Pandas, parse timestamps, sort by time
2. **Feature engineering** â€” Apply the `engineer()` function to create 33 features (rolling stats, diffs, cross-sensor features)
3. **Train/test split** â€” Temporal split at 2020-06-01
4. **Extract feature matrices** â€” Select the 33 feature columns, fill NaN with 0, convert to NumPy arrays
5. **StandardScaler** â€” Fit on training data, transform both train and full data
6. **PCA (12 components)** â€” Fit on training data, transform both. Log variance retained.
7. **MiniBatchKMeans (K=3)** â€” Fit on PCA-reduced training data. Predict labels for full data.
8. **Cluster naming** â€” Automatically name clusters (NORMAL, IDLE, HIGH-STRESS) based on Oil_temperature and TP2 means
9. **Isolation Forest** â€” Fit on scaled training data (not PCA-reduced). Score the full data.
10. **Health scores & RUL** â€” Compute composite health score and RUL for every row using vectorized NumPy operations
11. **PCA 2D** â€” Fit a separate 2-component PCA on scaled full data for scatter plot visualization
12. **Save models** â€” Dump scaler, PCA, KMeans, IsolationForest, cluster name map, and feature column list as .pkl files
13. **Save labelled Parquet** â€” Write the full dataframe with all new columns to metropt_labelled.parquet
14. **Evaluation** â€” Compute Silhouette Score on a 10K sample of training data

### Training Time

The entire pipeline runs in **~35â€“45 seconds** on commodity hardware. This speed is achieved through:
- MiniBatchKMeans (not full KMeans)
- Vectorized NumPy operations (no Python loops for health score computation)
- Efficient Pandas operations
- IsolationForest with n_jobs=-1 (parallel)

### Files Saved After Training

| File | Size | Purpose |
|------|------|---------|
| scaler.pkl | ~1.4 KB | StandardScaler object â€” mean/std for each of 33 features |
| pca_model.pkl | ~4.7 KB | PCA transformation matrix (12 components) |
| kmeans_model.pkl | ~3.4 MB | MiniBatchKMeans model (3 centroids + metadata) |
| isolation_forest.pkl | ~2 MB | 200 isolation trees |
| cluster_name_map.pkl | ~52 bytes | Dictionary mapping cluster integers to names |
| feature_cols.pkl | ~516 bytes | Ordered list of 33 feature column names |
| metropt_labelled.parquet | ~167 MB | Full dataset with all predictions and engineered features |

### Why Parquet and Not CSV?

**Parquet** is a columnar binary storage format:
- **5â€“10Ã— smaller** than CSV due to column-wise compression
- **10â€“100Ã— faster** to read than CSV (no parsing overhead)
- **Preserves data types** â€” no type inference needed (timestamps stay as timestamps, floats stay as floats)
- **Column-level access** â€” can read only specific columns without loading the entire file

The raw CSV is ~218 MB; the labelled Parquet is ~167 MB despite having more columns, demonstrating Parquet's compression efficiency.

### What Is Joblib?

**Joblib** is a Python library for efficiently serializing (saving) Python objects to disk. It is the recommended way to save scikit-learn models because:
- It handles NumPy arrays efficiently (uses memory-mapped files)
- It compresses large objects better than Python's built-in pickle
- It is the standard in the scikit-learn ecosystem

### What Is Vectorized Processing?

**Vectorized processing** means performing operations on entire arrays at once using NumPy, rather than looping through elements. For example, computing the health score for 1.5M rows is done as a single NumPy array operation, not with a Python for-loop. NumPy operations are implemented in optimized C/Fortran code, making them 100â€“1000Ã— faster than Python loops.

---

## 11. INFERENCE / PREDICTION PIPELINE

### What Happens at Runtime?

When a new sensor reading arrives (either from the upload API, single-prediction API, or WebSocket IoT stream):

1. **Load models once** â€” scaler, PCA, KMeans, IsolationForest, cluster map, feature columns are loaded into memory at server startup and cached
2. **Feature engineering** â€” The `_engineer()` function computes rolling stats, diffs, and derived features. For a single reading, rolling mean = the value itself, rolling std = 0, roc = 0.
3. **Build feature vector** â€” Extract the 33 features in the correct column order
4. **Scale** â€” Transform using the saved StandardScaler (NOT refit â€” the same mean/std from training)
5. **PCA transform** â€” Transform using the saved PCA (NOT refit â€” the same components from training)
6. **KMeans predict** â€” Assign to nearest centroid â†’ get cluster label
7. **IsolationForest score** â€” Score on the scaled (pre-PCA) features â†’ get anomaly score
8. **Compute health/RUL/alert/recommendation** â€” Using the formulas from Section 8

### Why Not Refit at Runtime?

Refitting would mean the scaler, PCA, and models would change with every new data point, causing inconsistent predictions. The models represent the "learned normal behaviour" from training data. New data should be evaluated against that fixed baseline.

### Inference Speed

Inference for a single reading is nearly instantaneous (<1 ms) because:
- All models are pre-loaded in memory (no disk I/O)
- The computation is just matrix multiplication (PCA), distance computation (KMeans), and tree traversal (IsolationForest)
- No training or fitting occurs

### API Output

Each prediction returns:
- **cluster**: NORMAL / IDLE / HIGH-STRESS
- **anomaly_score**: float (e.g., -0.4132)
- **health_score**: 0â€“100
- **alert_level**: NORMAL / WARNING / CRITICAL
- **rul_hours**: integer hours
- **recommendation**: human-readable maintenance advice

---

## 12. BACKEND TECHNICAL CONCEPTS

### What Is FastAPI?

**FastAPI** is a modern, high-performance Python web framework for building APIs. In this project it serves as the bridge between the trained ML models and the frontend dashboard. It provides:
- REST API endpoints for dashboard data (overview, clusters, anomalies, sensors, model performance)
- WebSocket endpoints for real-time streaming (historical playback, synthetic simulation, IoT sensor data)
- File upload/download for batch predictions
- Authentication (login/logout with session tokens)

### Key ML-Related API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /api/overview | GET | Pre-computed dashboard summary (health, alerts, clusters, timeline) |
| /api/clusters | GET | Cluster profiles, PCA scatter plot data, weekly trends |
| /api/anomalies | GET | Daily anomaly counts, score distribution, failure windows |
| /api/sensors | GET | Sensor time-series trends (5-min resampled), correlations, statistics |
| /api/model-performance | GET | All 3 clustering metrics, PCA variance, algorithm comparison |
| /api/predict-single | POST | Single-reading real-time prediction |
| /api/upload | POST | Batch CSV upload and prediction |
| /ws/live | WebSocket | Historical scenario playback (healthy, pre-failure, active failure) |
| /ws/synthetic | WebSocket | Synthetic fault injection simulation |
| /ws/iot-sensor | WebSocket | Phone accelerometer â†’ ML prediction pipeline |

### What Is Caching and Why Pre-Compute?

At startup, the backend calls `_precompute_cache()` which runs ALL heavy data aggregations once and stores results in a Python dictionary (`_cache`). This includes:
- Resampling 1.5M rows to 5-minute intervals for sensor trends
- Computing daily anomaly counts
- Building score histograms
- Computing correlation matrices
- Generating cluster profiles

This takes about 10â€“15 seconds at startup but makes every subsequent API call return **instantly** (dictionary lookup instead of re-processing 1.5M rows).

**In Simple Words:** Instead of crunching 1.5 million rows every time someone opens the dashboard, we crunch once at startup and serve the cached result forever.

### WebSocket for Live Streaming

**WebSocket** is a protocol that maintains a persistent, bidirectional connection between server and client. Unlike HTTP (request â†’ response â†’ done), WebSocket allows the server to push data continuously. This is used for:
- **Historical playback:** Streaming historical sensor readings one-by-one to simulate real-time monitoring
- **Synthetic simulation:** Generating fake sensor readings with injectable faults (air_leak, overheat, pressure_drop, bearing_wear) and streaming ML predictions
- **IoT sensor data:** Phone sends accelerometer data every 500ms, server responds with ML predictions

### What Is Uvicorn?

**Uvicorn** is an ASGI (Asynchronous Server Gateway Interface) server that runs the FastAPI application. It handles HTTP/WebSocket connections efficiently using async I/O. The project uses HTTPS (SSL) with self-signed certificates for IoT sensor access (Chrome blocks DeviceMotion API on plain HTTP).

### Model Loading at Startup

The `@app.on_event("startup")` decorator runs `startup()` when the server starts. This function calls `get_models()` which loads all 6 .pkl files into the `_models` dictionary, and `get_df()` which loads the Parquet file into a Pandas DataFrame. Both are cached globally â€” subsequent calls return the cached objects immediately.


---

## 13. ALGORITHM COMPARISON â€” WHY NOT OTHERS

| Algorithm | What It Is | Why NOT Chosen |
|-----------|-----------|---------------|
| **DBSCAN** | Density-based clustering that groups points in dense regions and marks sparse points as noise. No need to specify K. | Cannot handle varying densities well. With 1.5M rows, the epsilon neighbourhood search is very slow. Produces noise labels, not continuous anomaly scores. Sensitive to epsilon and min_samples parameters. |
| **Hierarchical/Agglomerative Clustering** | Bottom-up merging of clusters based on linkage criteria (ward, complete, average). Produces a dendrogram. | Requires O(nÂ²) memory for the distance matrix â€” for 1.5M rows that is ~18 TB of RAM. Completely infeasible. |
| **Gaussian Mixture Models (GMM)** | Probabilistic clustering assuming data is generated from a mixture of Gaussian distributions. Assigns soft probabilities. | Assumes Gaussian-shaped clusters. Industrial sensor data with operational state transitions is not cleanly Gaussian. EM algorithm is slower than KMeans. Covariance estimation on 33 features with 1.5M rows is expensive. |
| **Fuzzy C-Means** | Like KMeans but each point has a membership degree (0â€“1) for each cluster rather than a hard assignment. | More computationally expensive than KMeans. The soft memberships add complexity without clear benefit here â€” we need a definitive operational state label for the health score formula. |
| **OPTICS** | Ordered density-based clustering similar to DBSCAN but handles varying densities. Produces a reachability plot. | O(n log n) at best with spatial indexing, but still very slow for 1.5M rows in 33 dimensions. Spatial indexing degrades in high dimensions. |
| **Spectral Clustering** | Uses eigenvalues of a similarity matrix to reduce dimensionality before clustering. Good for non-convex clusters. | Requires computing and decomposing an nÃ—n similarity matrix. For 1.5M rows, this matrix would be ~9 TB. Completely infeasible. |
| **t-SNE** | Nonlinear dimensionality reduction that preserves local neighbourhood structure. Excellent for 2D/3D visualization. | Not a clustering algorithm â€” only for visualization. Non-parametric (cannot transform new data). Very slow for large datasets. Does not preserve global structure. |
| **UMAP** | Faster nonlinear dimensionality reduction similar to t-SNE with better global structure preservation. | Non-deterministic, harder to interpret than PCA. Cannot easily apply the learned transformation to new data at inference time (unlike PCA which is a simple matrix multiply). PCA is sufficient here since the data structure is largely linear. |
| **Autoencoders** | Neural networks trained to reconstruct input; reconstruction error serves as anomaly score. | Requires deep learning framework (PyTorch/TensorFlow), GPU for reasonable training time, extensive hyperparameter tuning (layers, neurons, learning rate, epochs). Overkill for tabular data where Isolation Forest performs well. |
| **One-Class SVM** | Learns a decision boundary around "normal" data in kernel space. | Training complexity is O(nÂ² to nÂ³). For 1.5M rows this would take hours to days. Also very sensitive to kernel choice and gamma parameter. |
| **LOF (Local Outlier Factor)** | Computes local density ratio â€” a point is anomalous if its local density is much lower than its neighbours. | Requires computing K-nearest-neighbour distances for every point â€” O(nÂ²) for 1.5M rows. Also, LOF does not generalize to new data easily (needs the full training set at inference). |

---

## 14. KEY CONCEPTS â€” CONCEPTUAL QUESTIONS

### What Is Unsupervised Learning?

**Unsupervised learning** finds hidden patterns in data **without labels**. The algorithm receives only input features (X) with no target variable (y). It discovers structure through clustering, dimensionality reduction, or anomaly detection. In contrast, **supervised learning** requires labelled examples (input â†’ known output) and learns a mapping function.

### What Is Clustering vs Anomaly Detection?

- **Clustering** groups similar data points together â€” it answers "what are the natural groups in this data?"
- **Anomaly detection** identifies individual points that deviate from the norm â€” it answers "which specific readings are unusual?"

They are complementary: clustering tells us the operational state (NORMAL/IDLE/HIGH-STRESS), anomaly detection tells us how unusual a reading is within or across states.

### What Is Semi-Supervised Learning?

**Semi-supervised learning** uses a small number of labelled examples alongside a large amount of unlabelled data. It was not used here because we have **zero** labels â€” not even a small labelled subset.

### Why Is Labelled Data Hard to Get?

- Failures are **rare events** â€” a compressor might fail 5 times in 7 months out of 1.5M readings
- **Expert annotation** is expensive â€” an engineer must review each reading and decide if it's a fault
- **Ambiguity** â€” the boundary between "degrading" and "normal" is often unclear
- **Retrospective labelling** â€” you only know something was a fault after it happens

### Bias-Variance Tradeoff in Clustering

- **Too few clusters (K=1 or K=2):** High bias â€” underfits, merges distinct operational states
- **Too many clusters (K=10):** High variance â€” overfits, creates artificial distinctions that don't generalize
- **K=3 is the sweet spot** â€” captures the three real operational states without overfitting

### Can KMeans Overfit?

Yes, in two ways:
1. Choosing too many clusters splits real groups into meaningless sub-clusters
2. Training on unrepresentative data (e.g., only summer data) produces centroids that don't generalize to winter conditions

### Outlier vs Anomaly

- **Outlier:** A data point that is statistically extreme (far from the mean). May be a measurement error or a rare but valid value.
- **Anomaly:** A data point that deviates from expected behaviour in a meaningful way â€” often indicates a real problem.

In practice, they overlap significantly. In this project, Isolation Forest detects anomalies (contextually unusual readings), while the DV_pressure IQR clipping removes outliers (probable measurement errors).

### What Is Concept Drift?

**Concept drift** occurs when the statistical properties of the data change over time. For example, if the compressor is replaced with a newer model, the "normal" operating ranges change, and the existing model's clusters and anomaly thresholds become invalid.

### What Is Model Drift and Retraining?

**Model drift** is when the model's predictions become less accurate over time due to concept drift. In production, you would:
1. Monitor prediction distributions (are more points suddenly "anomalous"?)
2. Periodically retrain on recent data (e.g., every 3â€“6 months)
3. Compare new cluster metrics with historical baselines

---

## 15. ANYTHING ELSE FOUND IN THE CODE

### fillna(0) for Feature Matrix
All NaN values in the feature matrix are filled with 0 before scaling. This handles edge cases where rolling stats produce NaN at the beginning of the time series (first few rows have insufficient history for the rolling window). Using 0 is a neutral choice â€” the scaler will normalize it.

### min_periods=1 in Rolling Window
The rolling window uses `min_periods=1`, meaning it computes the statistic even if fewer than 6 values are available (e.g., the first 5 rows). Without this, the first 5 rows would be NaN for all rolling features.

### Division Safety: +0.001
The pressure_ratio feature divides TP2 by (TP3 + 0.001). The 0.001 prevents division-by-zero errors if TP3 is ever exactly 0.

### Temporal Train/Test Split
The split at 2020-06-01 is a hard date boundary. This is correct for time-series: using random splits would leak future information into training (a reading from July could appear in training while its neighbour from July appears in testing).

### Cluster Naming Logic
The automatic naming algorithm: (1) sort clusters by mean Oil_temperature, (2) the lowest-temperature cluster = NORMAL, (3) among the remaining two, the one with higher mean TP2 = IDLE, the other = HIGH-STRESS. This avoids hardcoding cluster indices which change between training runs.

### Risk Weights in Health Score
The weights (cluster_risk up to 0.70, anomaly_risk up to 0.25, temperature_risk up to 0.05) sum to 1.0 maximum. Cluster state contributes the most (70%) because being in HIGH-STRESS is inherently dangerous regardless of anomaly score. The anomaly score is the secondary signal (25%), and temperature provides a small additional penalty (5%).

### Normalization Constants in Health Score
The values -0.34, 0.37, 62.64, 26.41 are derived from the observed data distribution: -0.34 is approximately the maximum (most normal) anomaly score, 0.37 is the range, 62.64Â°C is the mean oil temperature, and 26.41 is the range to the maximum.

### Synthetic Fault Simulation
The backend generates synthetic sensor data with four fault types, each with specific sensor signatures per step:
- **air_leak:** TP2 drops (-0.18/step), oil temp rises slightly, motor current increases
- **overheat:** Oil temperature rises sharply (+0.55/step), motor current increases
- **pressure_drop:** Both TP2 and TP3 drop, motor current increases sharply
- **bearing_wear:** Oil temperature rises moderately, motor current rises sharply (+0.30/step)

Fault intensity ramps linearly from 0 to 1 over 60 steps.

### Normal State Mean Reversion
In synthetic normal mode, sensor values use exponential smoothing: `state[k] = state[k] * 0.97 + random_normal(mu, sig) * 0.03`. The 0.97/0.03 weighting causes values to slowly revert toward their normal means, simulating a stable operating system.

### IoT Token System
One-time-use tokens (generated via `secrets.token_urlsafe(16)`) authenticate phone connections. Tokens expire after 5 minutes if unused, and are deleted after use/disconnection. This prevents unauthorized access to the ML pipeline.

### Telegram Alert Integration
Critical anomalies trigger Telegram notifications using the Bot API. A **30-second cooldown** prevents alert flooding. Sending runs in a background thread to avoid blocking the main async event loop.

### 5-Minute Resampling for Sensor Trends
Raw data at 10-second intervals produces ~1.8M data points for the sensor trends chart â€” too much for the frontend. The backend resamples to 5-minute intervals using pandas `.resample('5min').mean()`, reducing data volume by ~30Ã— while preserving trends.

### Sensor Correlation Matrix
The backend computes `df[ANALOG].corr()` â€” a 7Ã—7 Pearson correlation matrix between analog sensors. This reveals relationships like TP2-TP3 correlation (both measure pressure at different points) and Oil_temperature-Motor_current correlation (higher current generates more heat).

### Score Histogram
Anomaly scores are binned into 60 bins using `np.histogram()` to create a distribution chart. This shows that most readings cluster around -0.40 (normal) with a long tail toward -0.70 (anomalous).

### WebSocket Timeout (15 seconds)
IoT phone connections use a 15-second receive timeout (`asyncio.wait_for(..., timeout=15.0)`). If the phone stops sending data for 15 seconds, the server treats it as disconnected and cleans up resources.

### History Buffer (500 entries)
IoT reading history is capped at 500 entries using a simple list with `pop(0)` when exceeding the limit. This provides a sliding window of recent readings without unbounded memory growth.

### CORS Middleware
`allow_origins=["*"]` permits requests from any domain. This is necessary in development (frontend on localhost:5173 calling backend on localhost:8000). In production, this would be restricted.

### SSL Certificate Generation
The `generate_cert.py` script creates self-signed SSL certificates required for HTTPS. This is needed because Chrome/Safari block the DeviceMotion API (phone accelerometer) on non-secure origins. The certificate includes local IP addresses in the SAN (Subject Alternative Name) field so phones on the same WiFi can connect.

### PyArrow Library
Listed in requirements.txt â€” this is the engine Pandas uses to read/write Parquet files. Without PyArrow, the `pd.read_parquet()` and `df.to_parquet()` calls would fail.

### python-multipart Library
Required by FastAPI for handling file uploads (`UploadFile`). Without it, the `/api/upload` endpoint would fail.

---

## 16. PREDICTED VIVA QUESTIONS & ANSWERS

**Q1: What is this project about?**
A: This is an unsupervised machine learning system for predictive maintenance of air compressors in metro trains. It uses MiniBatchKMeans for behaviour segmentation and Isolation Forest for anomaly detection on the MetroPT-3 dataset.

**Q2: Why is this unsupervised and not supervised?**
A: The MetroPT-3 dataset has no labelled failure column. Labelling 1.5M sensor readings is impractical, and failures are rare events. Unsupervised methods discover patterns without labels.

**Q3: What is the MetroPT-3 dataset?**
A: A real-world IoT dataset from the Porto Metro air production unit in Portugal, published in Nature Scientific Data 2022. It contains ~1.5M rows of sensor readings sampled every ~10 seconds over 213 days (Febâ€“Sep 2020).

**Q4: Why did you choose KMeans and not DBSCAN?**
A: DBSCAN requires O(nÂ²) neighbourhood searches, making it infeasible for 1.5M rows. It also struggles with varying density and cannot easily produce cluster labels for new data at inference time. KMeans is efficient, well-understood, and produces clean cluster assignments.

**Q5: Why MiniBatchKMeans instead of regular KMeans?**
A: Standard KMeans computes distances from all 1.5M points to centroids in every iteration â€” very slow and memory-intensive. MiniBatchKMeans processes random batches of 10,000 rows, achieving nearly identical quality in a fraction of the time (~35 seconds vs potentially hours).

**Q6: How did you choose K=3?**
A: Using the Elbow Method â€” plotting inertia vs K from 2 to 8. K=3 showed the sharpest decrease in inertia. It also had the highest Silhouette Score (0.6117). K=2 was too coarse; K=4+ showed degraded cluster quality.

**Q7: What do the 3 clusters represent physically?**
A: NORMAL = standard operating conditions (lowest oil temperature), IDLE = standby/low-load state (moderate temperature, higher TP2), HIGH-STRESS = heavy load conditions (highest oil temperature and motor current, potential fault precursor).

**Q8: Why PCA? Why not just use all 33 features?**
A: PCA reduces the curse of dimensionality â€” in 33 dimensions, distance-based algorithms like KMeans lose effectiveness because all points become equidistant. PCA also removes noise by discarding low-variance components, improving clustering quality.

**Q9: Why 12 PCA components?**
A: 12 components retain ~96% of total variance â€” capturing virtually all meaningful signal while discarding the ~4% that is noise. This is a standard threshold in practice; 90% would lose too much, 99% would keep noise.

**Q10: What is PCA doing in simple terms?**
A: PCA finds new axes (directions) in the data that capture the most variation. The first axis captures the most, the second captures the most of what's left, and so on. It is like rotating your viewpoint to see the most important patterns first.

**Q11: Why StandardScaler and not MinMaxScaler?**
A: StandardScaler is robust to outliers (uses mean/std), while MinMaxScaler is distorted by extreme values. Since PCA requires centred data (mean=0), StandardScaler is the natural preprocessing choice.

**Q12: What is Isolation Forest and how does it work?**
A: It builds random trees that isolate data points using random splits. Anomalies are isolated in fewer splits because they are "different" from the majority. The anomaly score is based on the average number of splits needed â€” fewer splits = more anomalous.

**Q13: Why Isolation Forest instead of One-Class SVM?**
A: One-Class SVM has O(nÂ²â€“nÂ³) training complexity â€” infeasible for 1.5M rows. Isolation Forest scales linearly with sample size and is specifically designed for large-scale anomaly detection.

**Q14: What is the contamination parameter?**
A: It tells the model what fraction of data points are expected to be anomalous. Set to 0.05 (5%) in this project â€” meaning roughly 1 in 20 readings is treated as anomalous. This sets the decision threshold for the anomaly score.

**Q15: What is the Silhouette Score? Is 0.6117 good?**
A: It measures how well each point fits its cluster vs the nearest other cluster, ranging from -1 to +1. A score of 0.6117 is excellent for real-world industrial data â€” anything above 0.5 indicates strong cluster structure.

**Q16: What is the Davies-Bouldin Index?**
A: It measures the ratio of within-cluster scatter to between-cluster separation. Lower is better. Our score of 1.1267 indicates moderate but acceptable cluster overlap, expected in continuous industrial processes.

**Q17: What is the Calinski-Harabasz Index?**
A: It measures between-cluster dispersion divided by within-cluster dispersion. Higher is better. Our score of 20,024 indicates well-separated, compact clusters.

**Q18: Why can't you use accuracy or F1 score?**
A: These require ground-truth labels. Our data has no labels â€” it is purely unsupervised. We use internal metrics (Silhouette, Davies-Bouldin, Calinski-Harabasz) that measure cluster quality without labels.

**Q19: How is the health score computed?**
A: It combines three risk factors: cluster risk (0â€“70%, based on operational state), anomaly risk (0â€“25%, from Isolation Forest score), and temperature risk (0â€“5%, from oil temperature). Health = 100 Ã— (1 - total_risk).

**Q20: What is RUL and how is it estimated?**
A: Remaining Useful Life in hours. Each cluster has a base RUL (NORMAL=720h, IDLE=360h, HIGH-STRESS=48h). The anomaly score applies a penalty that reduces RUL further. Final RUL = max(1, base - penalty).

**Q21: Can you explain the elbow method?**
A: Plot the number of clusters (K) on x-axis vs inertia (within-cluster sum of squares) on y-axis. As K increases, inertia decreases. The "elbow" is where the rate of decrease sharply changes â€” adding more clusters beyond this point gives diminishing returns.

**Q22: What is feature engineering and why is it needed?**
A: Creating new features from raw sensor data to capture temporal dynamics (rolling statistics, rate of change) and cross-sensor relationships (pressure drop, motor load). Without this, KMeans would only see instantaneous values and miss trends and patterns.

**Q23: What is a rolling window?**
A: A fixed-size window (6 readings â‰ˆ 60 seconds) that slides through the time series, computing statistics (mean, std) at each position. It captures short-term trends and variability.

**Q24: What would happen if you skipped PCA?**
A: KMeans would cluster on 33 features, suffering from the curse of dimensionality â€” distances become less meaningful in high dimensions. Noise in minor features would distort cluster assignments. Training would also be slower.

**Q25: What would happen if you skipped normalization?**
A: Features with larger scales (Oil_temperature: 15â€“89) would completely dominate KMeans distance calculations over smaller-scale features (Motor_current: 0.02â€“9.3). Clusters would essentially be based only on temperature.

**Q26: What are the limitations of your model?**
A: (1) KMeans assumes spherical clusters, (2) fixed anomaly threshold may not adapt to seasonal changes, (3) no concept drift detection, (4) health score weights are empirically chosen not optimized, (5) single-row inference loses rolling statistics context.

**Q27: How would this work in a real factory?**
A: Sensors on the compressor stream data to the server. The trained models run inference in real-time (<1ms per reading). Dashboard shows health status. When anomaly scores drop below thresholds, alerts are sent via Telegram. Maintenance is scheduled before failure occurs.

**Q28: How did you train on 1.5M rows so fast?**
A: MiniBatchKMeans (10K batch size instead of full data), vectorized NumPy operations (no Python loops), IsolationForest with parallel tree construction (n_jobs=-1), and efficient Pandas operations. Total: ~35â€“45 seconds.

**Q29: What is the difference between anomaly detection and clustering?**
A: Clustering groups similar points together (segmentation). Anomaly detection identifies individual points that deviate from normal patterns (outlier scoring). They answer different questions and are used together in this pipeline.

**Q30: How do you know your model is working if you have no labels?**
A: Three internal metrics confirm cluster quality (Silhouette=0.6117, DB=1.1267, CH=20,024). The model's anomaly scores spike during the 5 documented failure events, validating detection capability. Domain experts confirm the cluster interpretations are physically meaningful.

**Q31: What is the difference between KMeans and MiniBatchKMeans?**
A: Standard KMeans uses all data points in every iteration; MiniBatchKMeans samples a batch (10,000) each iteration. MiniBatch is much faster with slightly lower quality (typically <1% difference in inertia).

**Q32: What would you improve with more time?**
A: (1) Add concept drift detection and automatic retraining triggers, (2) experiment with deep learning autoencoders for anomaly detection, (3) implement temporal attention mechanisms for better sequence modelling, (4) add more fault types beyond air leaks, (5) optimize health score weights using domain expert feedback.

**Q33: What is the math behind StandardScaler?**
A: z = (x - Î¼) / Ïƒ, where Î¼ is the training set mean and Ïƒ is the training set standard deviation for each feature. This centres data at 0 and scales variance to 1.

**Q34: What does the cumulative variance graph show?**
A: X-axis = number of PCA components, Y-axis = cumulative explained variance (%). It shows how much total information is captured as you add components. At 12 components we reach ~96%, meaning those 12 components explain 96% of all variation in the original 33 features.

**Q35: What is the curse of dimensionality?**
A: As dimensions increase, the volume of the space grows exponentially. Points become increasingly equidistant, making distance-based algorithms (KMeans, KNN) ineffective. PCA combats this by reducing to a lower-dimensional space where distances are meaningful.

**Q36: Could you use deep learning for this?**
A: Yes â€” autoencoders could detect anomalies via reconstruction error, and LSTM/Transformer models could capture long-term temporal dependencies. However, these require GPU resources, more training time, and careful tuning. For this tabular dataset, classical methods (KMeans + Isolation Forest) achieve strong results with simpler infrastructure.

**Q37: How does the IoT phone sensor integration work?**
A: The phone's accelerometer (ax, ay, az) sends data over WebSocket every 500ms. The backend maps accelerometer magnitude and vibration to the MetroPT-3 sensor space (TP2, TP3, Oil_temperature, etc.) using calibrated scaling functions, then runs the full ML pipeline and returns health predictions.

**Q38: What is Parquet and why use it?**
A: Parquet is a columnar binary storage format â€” 5â€“10Ã— smaller than CSV, 10â€“100Ã— faster to read, and preserves data types. It is the standard for large dataset storage in data science.

---

## ðŸ“š Quick Reference Glossary

| Term | Definition |
|------|-----------|
| **Unsupervised Learning** | ML without labelled data; discovers hidden patterns |
| **Supervised Learning** | ML with labelled data; learns inputâ†’output mapping |
| **Semi-Supervised Learning** | ML with few labels + much unlabelled data |
| **Clustering** | Grouping similar data points into clusters |
| **Anomaly Detection** | Identifying data points that deviate from normal patterns |
| **KMeans** | Partitioning algorithm that minimizes within-cluster distances |
| **MiniBatchKMeans** | KMeans variant using random subsets per iteration for speed |
| **KMeans++** | Smart initialization that spreads initial centroids apart |
| **Isolation Forest** | Tree-based anomaly detector; anomalies isolated in fewer splits |
| **PCA** | Linear dimensionality reduction maximizing retained variance |
| **Principal Component** | New axis (linear combination of features) capturing maximum variance |
| **Explained Variance Ratio** | Fraction of total variance captured by each PCA component |
| **StandardScaler** | Scales features to zero mean and unit variance |
| **Inertia / WCSS** | Within-Cluster Sum of Squares â€” KMeans objective function |
| **Elbow Method** | Technique to find optimal K by plotting inertia vs K |
| **Silhouette Score** | Cluster quality metric: cohesion vs separation (-1 to +1) |
| **Davies-Bouldin Index** | Cluster quality metric: within-scatter vs between-separation (lower = better) |
| **Calinski-Harabasz Index** | Variance ratio criterion: between/within dispersion (higher = better) |
| **Contamination** | Expected fraction of anomalies in Isolation Forest |
| **RUL** | Remaining Useful Life â€” estimated hours until maintenance needed |
| **Health Score** | Composite 0â€“100 metric combining cluster risk, anomaly risk, and temperature risk |
| **Feature Engineering** | Creating new informative features from raw data |
| **Rolling Window** | Fixed-size sliding window for computing temporal statistics |
| **Rate of Change (ROC)** | First-order difference; captures speed of change |
| **Curse of Dimensionality** | Distance metrics become meaningless in very high dimensions |
| **Concept Drift** | Data distribution changes over time, degrading model performance |
| **Parquet** | Columnar binary file format; fast and compact for large datasets |
| **Joblib** | Python library for serializing scikit-learn models to disk |
| **FastAPI** | High-performance Python web framework for REST APIs |
| **Uvicorn** | ASGI server that runs FastAPI applications |
| **WebSocket** | Persistent bidirectional communication protocol for real-time data |
| **CORS** | Cross-Origin Resource Sharing â€” browser security policy for cross-domain requests |
| **ASGI** | Asynchronous Server Gateway Interface â€” Python async web server standard |
| **IQR** | Interquartile Range = Q3 - Q1; used for outlier detection |
| **Vectorized Operations** | NumPy array operations executed in optimized C code, not Python loops |
| **Exponential Smoothing** | Weighted average giving more weight to recent values for mean reversion |
| **SAN** | Subject Alternative Name â€” SSL certificate field listing valid hostnames/IPs |
| **MetroPT-3** | Public IoT dataset from Porto Metro air compressors (Nature 2022) |
| **APU** | Air Production Unit â€” the compressor system monitored in this project |
| **LOF** | Local Outlier Factor â€” density-based anomaly detection (O(nÂ²)) |
| **DBSCAN** | Density-Based Spatial Clustering of Applications with Noise |
| **GMM** | Gaussian Mixture Model â€” probabilistic soft clustering |
| **t-SNE** | t-distributed Stochastic Neighbor Embedding â€” nonlinear visualization |
| **UMAP** | Uniform Manifold Approximation and Projection â€” nonlinear dim reduction |
| **Autoencoder** | Neural network that learns to reconstruct input; anomaly = high reconstruction error |
| **One-Class SVM** | SVM variant that learns a boundary around normal data |
| **PyArrow** | Python library for reading/writing Parquet files |
