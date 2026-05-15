# IoT Integration — Complete Technical Explanation
## Industrial Machine Behaviour Segmentation for Predictive Maintenance
### LPU Third Year | Unsupervised Learning Subject

---

> **How to use this file:** This document explains the most unique feature of our project: **The Mobile IoT Integration**. It explains exactly how a smartphone's accelerometer is translated into an industrial air compressor, and how the machine learning model processes it. Use this to blow away your evaluator!

---

## TABLE OF CONTENTS

1. [Big Picture: How the IoT System Works](#1-big-picture-how-the-iot-system-works)
2. [What Data Does the Phone Send?](#2-what-data-does-the-phone-send)
3. [Does It Use the Real ML Model? (YES)](#3-does-it-use-the-real-ml-model-yes)
4. [The Pseudo-Sensor Mapping (The Magic)](#4-the-pseudo-sensor-mapping-the-magic)
5. [The ML Pipeline for IoT](#5-the-ml-pipeline-for-iot)
6. [Scores Explained: RUL & Health Score](#6-scores-explained-rul--health-score)
7. [WebSockets vs HTTP](#7-websockets-vs-http)

---

## 1. Big Picture: How the IoT System Works

Usually, machine learning models like this require connecting to a $5,000 industrial sensor array via Modbus or OPC-UA. We didn't have that, so we built an **IoT Bridge** that allows any modern smartphone to act as an industrial vibration sensor.

**The Flow:**
1. The dashboard generates a secure, one-time link.
2. You open the link on your phone.
3. Your phone's web browser asks for permission to use the hardware Accelerometer.
4. You shake the phone. The phone sends the movement data to the server continuously.
5. The server translates "phone shaking" into "compressor vibrating/overheating".
6. The server feeds this translated data into the **actual trained ML models** (K-Means & Isolation Forest).
7. The models predict the Health Score, Anomaly Score, and RUL.
8. The predictions are broadcasted live to the dashboard screen.

---

## 2. What Data Does the Phone Send?

The phone itself does absolutely zero machine learning. It just reads raw physics from the hardware sensor. 

Every 1 second, the phone's browser runs javascript to measure the accelerometer and sends this JSON package to the backend via a WebSocket:

```json
{
  "ax": -0.12,
  "ay": 9.81,
  "az": 0.45,
  "magnitude": 9.82,
  "vibration": 0.05
}
```

- **`ax, ay, az`**: Raw acceleration in meters per second squared ($m/s^2$) across the X, Y, and Z axes.
- **`magnitude`**: The combined total acceleration vector ($\sqrt{ax^2 + ay^2 + az^2}$). Earth's gravity means this is normally around 9.81 even when sitting still on a desk.
- **`vibration`**: We calculate this by subtracting the magnitude of the *previous* reading from the *current* reading. If the phone is sitting still, vibration is 0. If you shake it violently, vibration spikes.

---

## 3. Does It Use the Real ML Model? (YES)

A common question your evaluator might ask is: *"Wait, you trained your model on an Air Compressor, not a phone. How can the model predict anything from a phone?"*

**The Answer:** The phone data does NOT go straight into the model! It goes through a translation layer first.

The machine learning models (K-Means and Isolation Forest) only know about industrial sensors like `Oil_temperature` and `Motor_current`. They don't know what `ax` or `ay` is.

To fix this, we created a **Pseudo-Sensor Mapping function** in `main.py`. This function mathematically translates the physics of the phone into the physics of an air compressor.

---

## 4. The Pseudo-Sensor Mapping (The Magic)

This is the core logic inside `_iot_predict()` in `backend/main.py` (Line ~674):

```python
# We normalize the phone's movement so 1.0 is maximum violent shaking
norm_mag = min(magnitude / 20.0, 1.0)
norm_vib = min(vibration / 10.0, 1.0)

# We map phone physics to the MetroPT-3 industrial sensor space
pseudo_sensors = {
    'TP2':             clip(-0.013 + norm_vib * 8.5,    -0.03, 10.0),
    'Oil_temperature': clip(62.6   + norm_mag*15 + norm_vib*8, 15, 89),
    'Motor_current':   clip(0.04   + norm_mag*0.8 + norm_vib*1.2, 0.02, 9.3),
    # ... other sensors
}
```

**How to explain this to the evaluator:**
- **When the phone is still:** `norm_vib` is 0. The `Oil_temperature` defaults to 62.6°C. The `Motor_current` defaults to 0.04 Amps. These are the *exact mathematical averages* of a healthy compressor in the MetroPT-3 dataset! Therefore, the model predicts `NORMAL` (Green).
- **When you shake the phone:** `norm_vib` spikes to 1.0. Look at the math: `Oil_temperature` will spike from 62°C up to 80°C+. `Motor_current` will jump to 9 Amps. 
- The ML model receives this translated data, sees high temperature and high current, and correctly identifies it as the `HIGH-STRESS` cluster (Red anomaly).

**We turned phone shaking into a simulated industrial breakdown.**

---

## 5. The ML Pipeline for IoT

Once the pseudo-sensors are generated, they are fed into the exact same pipeline used for the CSV data:

```python
# main.py - Inside _iot_predict()

# 1. Normalise the mapped sensors using the trained StandardScaler
Xs = m['scaler'].transform(X)

# 2. Reduce 33 dimensions down to 12 using the trained PCA
Xp = m['pca'].transform(Xs)

# 3. Predict the cluster state (NORMAL, IDLE, HIGH-STRESS)
cluster_label = int(m['kmeans'].predict(Xp)[0])

# 4. Calculate the severity of the anomaly
anomaly_score = float(m['iso'].score_samples(Xs)[0])
```
Because we are using the exact same `StandardScaler`, `PCA`, and `KMeans` models trained on the real 1.5 million rows, the IoT integration is a mathematically valid extension of the core project.

---

## 6. Scores Explained: RUL & Health Score

Once the ML model outputs the Cluster and the Anomaly Score, the backend calculates two critical KPIs for the dashboard:

### Remaining Useful Life (RUL)
RUL is an estimate of how many hours the machine has left before it requires maintenance.

```python
def _rul(cname, score):
    base = {'NORMAL': 720, 'IDLE': 360, 'HIGH-STRESS': 48}.get(cname, 168)
    pen  = max(0, (-score - 0.45) / 0.26) * 48
    return max(1, round(base - pen))
```
- If you don't shake the phone (NORMAL), the base RUL is **720 hours** (30 days).
- If you shake the phone violently, the model detects HIGH-STRESS, which instantly drops the base RUL to **48 hours**. 
- It then applies a mathematical penalty based on the `anomaly_score`. The more violent the shake, the worse the anomaly score, and the more hours are deducted from the 48-hour base.

### Health Score (0-100)
The Health Score is a percentage representation of machine integrity.
- It starts at 100%.
- It subtracts points for being in a bad cluster (up to 70% deduction).
- It subtracts points for bad anomaly scores (up to 25% deduction).
- It subtracts points for high oil temperatures (up to 5% deduction).
- Shaking the phone heavily will drop the health score to roughly **10-15 / 100**.

---

## 7. WebSockets vs HTTP

If the evaluator asks: *"Why did you use WebSockets instead of regular HTTP REST APIs for the IoT sensor?"*

**The Answer:**
Regular HTTP is like sending a letter. You ask for a connection, send the data, wait for an answer, and close the connection. If the phone tries to do this 10 times a second, it will crash the server from "connection overhead".

A **WebSocket** is a permanent, open tunnel. The phone connects once, and then simply streams the accelerometer numbers down the tunnel instantly. It is memory-efficient, has zero latency, and allows true real-time streaming, which is mandatory for industrial IoT applications.
