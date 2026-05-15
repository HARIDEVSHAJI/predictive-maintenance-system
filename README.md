---
title: Predictive Maintenance
emoji: 🏭
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
app_port: 7860
---

# 🏭 Predictive Maintenance Dashboard — MetroPT-3

[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-1.3+-F7931E?logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)
[![Hugging Face](https://img.shields.io/badge/Deployed%20on-Hugging%20Face-FFD21E?logo=huggingface&logoColor=black)](https://huggingface.co/)

**🚀 Live Demo:** [https://haridev888-predictive-maintenance.hf.space](https://haridev888-predictive-maintenance.hf.space)

An **end-to-end unsupervised machine learning system** for industrial predictive maintenance, trained on the **MetroPT-3 air compressor dataset**. It features a modern React dashboard, a high-performance FastAPI backend, and real-time live sensor streaming (including a mobile IoT mode).

> **Academic Context:** Developed for a university project. Based on the Nature Scientific Data 2022 publication (DOI: 10.1038/s41597-022-01877-3).

---

## ✨ Key Features

- **Unsupervised ML Pipeline:** MiniBatchKMeans (behavioral clustering) + Isolation Forest (anomaly detection).
- **Extremely Fast Training:** Vectorized operations, rolling windows, and MiniBatch processing train 1.5M rows in **~40 seconds**.
- **Real-Time Live Monitor:** View simulated sensor behavior, inject faults (air leaks, overheating), or use manual sliders to test edge cases.
- **IoT Mobile Integration:** Connect your smartphone as a live sensor! Send accelerometer data via WebSockets for real-time analysis, complete with secure one-time-use tokens and CSV data export.
- **Secure Authentication:** Enterprise-grade login portal with session management and Telegram-based password resets via 6-digit OTP codes.
- **Telegram Alerting:** Instant notifications for critical sensor anomalies and password reset requests via a Telegram Bot.
- **Production Ready:** Built-in token garbage collection, robust WebSocket handling, cached API responses, and Docker containerization.

---

## 🛠️ Tech Stack

- **Frontend:** React, Vite, Tailwind CSS, Recharts, Framer Motion, Lucide Icons.
- **Backend:** FastAPI, Uvicorn, WebSockets, Python `time` & `asyncio`.
- **Machine Learning:** Pandas, NumPy, Scikit-learn, PyArrow, Joblib.
- **Deployment:** Docker (optimized for Hugging Face Spaces).

---

## 📂 Project Structure

```text
├── backend/
│   ├── data/                 # Raw CSV and processed Parquet files
│   ├── models/               # Serialized ML models (.pkl files)
│   ├── main.py               # FastAPI server and WebSocket handlers
│   ├── train.py              # ML training and feature engineering pipeline
│   ├── generate_cert.py      # SSL certificate generator for IoT HTTPS
│   └── requirements.txt      # Python dependencies
├── frontend/
│   ├── src/                  # React components, pages, and hooks
│   ├── public/               # Static assets
│   ├── package.json          # Node dependencies
│   └── vite.config.js        # Vite bundler configuration
├── Dockerfile                # Multi-stage Docker build for Hugging Face
└── README.md                 # Project documentation
```

---

## 🚀 Quick Start (Local Development)

### 1. Place the Dataset
Download the MetroPT-3 dataset and place the CSV file at:
```text
backend/data/MetroPT3(AirCompressor).csv
```

### 2. Setup the Backend & Train
The training script reads the 1.5M row dataset, runs feature engineering, trains the models, and saves a highly-compressed Parquet file for the server.

```bash
cd backend
python -m venv venv
venv\Scripts\activate      # On Windows
# source venv/bin/activate # On Mac/Linux
pip install -r requirements.txt
python train.py
```
*Output should confirm completion in ~40s with a Silhouette Score > 0.60.*

### 3. Start the Backend Server
```bash
# Inside the backend directory:
uvicorn main:app --host 0.0.0.0 --port 8000
```
*(Note: The server pre-computes cache on startup, which takes ~15-20 seconds. Once started, all API requests are nearly instant).*

### 4. Start the Frontend Dashboard
Open a **new terminal**:
```bash
cd frontend
npm install
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser to view the dashboard!

---

## 📱 IoT Phone Sensor Setup (Local Testing)

To use your mobile phone as a live sensor on your local network, the phone requires a secure (`HTTPS`) connection to access device motion sensors.

1. Generate a self-signed certificate:
   ```bash
   cd backend
   python generate_cert.py
   ```
2. Start the backend with SSL enabled:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --ssl-keyfile key.pem --ssl-certfile cert.pem
   ```
3. Open the dashboard, navigate to the **IoT Sensor** tab, and generate a secure link. **Replace `localhost` with your PC's local IP address** (e.g., `192.168.1.5`) when typing the link into your phone.

*(Note: When deployed to Hugging Face, HTTPS is automatically provided, and links work out-of-the-box).*

---

## 🧠 ML Architecture

| Step | Algorithm | Processing Time |
|------|-----------|------|
| **Feature Engineering** | Pandas rolling windows + diffs | ~2s |
| **Normalization** | StandardScaler | ~3s |
| **Dimensionality Reduction** | PCA (12 components, 96% variance) | ~1s |
| **Clustering** | MiniBatchKMeans (K=3) | ~3s |
| **Anomaly Detection** | Isolation Forest (n=200, `max_samples='auto'`) | ~15s |
| **Score Computation** | Vectorized NumPy processing | ~1s |

**Verified Evaluation Metrics:**
- **Silhouette Score:** `0.6117` (Excellent boundary separation)
- **Davies-Bouldin:** `1.1267`
- **Calinski-Harabasz:** `20,024`

---

## 🤖 Telegram Bot & Admin Configuration

To enable instant Telegram alerts and **Secure Admin Login** password resets, create a `.env` file in the `backend/` directory:
```env
# Required for Telegram notifications and Password Resets
TELEGRAM_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Default Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```
*(Note: Ensure your `TELEGRAM_TOKEN` key matches exactly as defined in `main.py`).*

---

## 🐳 Deployment (Hugging Face / Docker)

This repository is configured out-of-the-box for **Hugging Face Spaces (Docker SDK)**. 
When pushed, Hugging Face automatically:
1. Reads the YAML metadata at the top of this file.
2. Builds the `Dockerfile` (installs Node.js, builds React frontend, installs Python dependencies).
3. Exposes port `7860`.

---
*Built with ❤️ for Industrial AI Analytics.*
