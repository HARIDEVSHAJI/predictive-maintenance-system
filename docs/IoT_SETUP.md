# IoT Setup Guide — Predictive Maintenance

## Overview

This project uses your **smartphone as an IoT vibration sensor**. The phone's accelerometer reads motion data, sends it to the backend via WebSocket, and the trained ML models (K-Means + Isolation Forest) classify the vibration in real-time.

---

## Step 1: Find Your Laptop IP Address

You need your laptop's local IP so the phone can connect to it.

### Windows (PowerShell or CMD)
```powershell
ipconfig
```
Look for **"Wireless LAN adapter Wi-Fi"** section → find the **IPv4 Address** (e.g., `192.168.1.45`).

> **Tip:** Ignore addresses starting with `127.0.0.1` (that's localhost) or `169.254.x.x` (that means WiFi is disconnected).

---

## Step 2: Generate SSL Certificate (One-Time)

Modern phone browsers (Chrome on Android, Safari on iOS) **block accelerometer access on HTTP**. We need HTTPS. Run this once:

```bash
cd backend
python generate_cert.py
```

This creates `cert.pem` and `key.pem` in the backend folder. You only need to do this **once** — the cert lasts 1 year.

> **Why SSL?** Chrome considers `http://192.168.x.x` as "insecure" and silently blocks the DeviceMotion API. With HTTPS, the browser trusts the page enough to allow sensor access.

---

## Step 3: Start the Backend with HTTPS

```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --ssl-keyfile key.pem --ssl-certfile cert.pem
```

**Important flags:**
- `--host 0.0.0.0` → allows connections from other devices (your phone). Without this, only `localhost` works.
- `--ssl-keyfile key.pem --ssl-certfile cert.pem` → enables HTTPS so the phone sensor works.

---

## Step 4: Start the Frontend

```bash
cd frontend
npm run dev
```

Dashboard opens at `http://localhost:3000`. Navigate to the **"IoT Sensor"** tab (last tab in sidebar).

---

## Step 5: Connect Your Phone

1. Connect your phone to the **same WiFi network** as your laptop
2. Open Chrome on your phone
3. Go to: **`https://YOUR_LAPTOP_IP:8000/iot`**
   - Example: `https://192.168.1.45:8000/iot`
   - **Note:** Use `https://` (not `http://`)
4. **You will see a security warning** — this is normal because we're using a self-signed certificate:
   - On Chrome: Tap **"Advanced"** → **"Proceed to [IP] (unsafe)"**
   - On Safari: Tap **"Show Details"** → **"visit this website"**
5. The sensor diagnostics panel will show whether the accelerometer is working
6. **Shake your phone!**
   - Still phone → **NORMAL** cluster
   - Gentle shake → **IDLE** cluster
   - Hard shake → **HIGH-STRESS** cluster

> **If sensor still shows 0:** Make sure the URL starts with `https://`. If you used `http://`, the sensor will be blocked.

---

## Step 6: Telegram Alerts (Optional but Recommended)

Telegram alerts notify you instantly on your phone when the ML model detects a **CRITICAL** anomaly. Here's how to set it up:

### 6.1 — Create a Telegram Bot

1. Open the **Telegram** app on your phone
2. In the search bar, search for **`@BotFather`** (it has a blue checkmark ✓)
3. Tap on BotFather and press **Start**
4. Type and send: `/newbot`
5. BotFather will ask: **"What name do you want for your bot?"**
   - Type any name, e.g.: `PDM Alert Bot`
6. BotFather will ask: **"Choose a username for your bot"**
   - Must end in `bot`, e.g.: `pdm_alert_2024_bot`
7. BotFather will reply with your **bot token** — it looks like this:
   ```
   7123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw
   ```
   **Copy this token** — you'll need it in Step 6.3.

### 6.2 — Get Your Chat ID

The bot needs to know WHERE to send messages. Your "chat ID" is your unique Telegram user number.

1. **First, send any message to your new bot** (e.g., just type "hello" and send it). This is required — the bot can't message you until you message it first.
2. Open this URL in your laptop browser (replace `YOUR_TOKEN` with the token from step 6.1):
   ```
   https://api.telegram.org/botYOUR_TOKEN/getUpdates
   ```
   For example:
   ```
   https://api.telegram.org/bot7123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw/getUpdates
   ```
3. You'll see a JSON response. Look for the `"chat"` section:
   ```json
   "chat": {
     "id": 987654321,
     "first_name": "Hari",
     "type": "private"
   }
   ```
4. The number after `"id":` is your **chat ID** (e.g., `987654321`). Copy it.

> **If the page shows `{"ok":true,"result":[]}` (empty):** You haven't sent a message to the bot yet. Go to Telegram, find your bot, send "hello", then refresh the URL.

### 6.3 — Set the Token and Chat ID

Open the file **`backend/.env`** in any text editor and paste your values:

```env
# Telegram Bot Configuration
TELEGRAM_TOKEN=7123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw
TELEGRAM_CHAT_ID=987654321
```

Replace the example values with YOUR actual token and chat ID. Save the file.

**That's it.** The backend automatically reads this `.env` file when it starts. No terminal commands, no system settings — the credentials live only inside this project folder.

> **Why a `.env` file?**
> - It stays **inside your project** — doesn't affect your laptop or other projects
> - You don't need to type `set` commands every time you start the server
> - If you make another project with a different bot, each project has its own `.env`
> - The `.env` file is just a text file with `KEY=VALUE` pairs — nothing magical
> - **Don't share this file or push it to GitHub** — it contains your secret token

### 6.4 — Test It

1. Start the backend with the env vars set (as shown above)
2. Open the phone sensor page (`https://YOUR_IP:8000/iot`)
3. **Shake the phone HARD** until it shows "HIGH-STRESS" cluster
4. If the anomaly score drops below -0.55 (CRITICAL), you'll get a Telegram message like:
   ```
   🚨 CRITICAL ALERT — Predictive Maintenance
   📱 IoT Sensor detected abnormal vibration
   🔴 Cluster: HIGH-STRESS
   💊 Health Score: 12/100
   📉 Anomaly Score: -0.61
   ⚠️ EMERGENCY: Inspect compressor immediately.
   ```
5. There's a **30-second cooldown** between messages to prevent spam

---

## Quick Start (Copy-Paste)

### First time setup:
```bash
cd backend
pip install cryptography          # one-time
python generate_cert.py           # one-time (creates cert.pem, key.pem)
python train.py                   # one-time (if not already trained)
# Edit backend/.env with your Telegram token and chat ID (optional)
```

### Every time you run:
```powershell
# Terminal 1 — Backend:
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --ssl-keyfile key.pem --ssl-certfile cert.pem

# Terminal 2 — Frontend:
cd frontend
npm run dev
```

Then on phone: `https://YOUR_IP:8000/iot`

---

## Demo Script for Class Presentation

### Before Class
1. Make sure `cert.pem` and `key.pem` exist in `backend/` (run `python generate_cert.py` if not)
2. Find your laptop IP: `ipconfig`
3. Start backend: `python -m uvicorn main:app --host 0.0.0.0 --port 8000 --ssl-keyfile key.pem --ssl-certfile cert.pem`
4. Start frontend: `cd frontend && npm run dev`

### During Presentation

1. **Show the dashboard** — Walk through all 7 existing tabs briefly
2. **Switch to IoT tab** — Explain the connection setup section
3. **Open phone browser** — Go to `https://YOUR_IP:8000/iot`, accept the security warning
4. **Show diagnostics** — Point out the sensor diagnostics panel (Secure Context: Yes, Sensor Data: Working)
5. **Demonstrate NORMAL** — Hold phone still → NORMAL cluster, high health score
6. **Demonstrate IDLE** — Gently shake → IDLE cluster, medium health
7. **Demonstrate CRITICAL** — Shake hard → HIGH-STRESS cluster, low health, alerts appear
8. **Show dashboard updating** — Switch to laptop, show the live charts, shake intensity bar, alert log
9. **Show Telegram** (if configured) — Hard shake triggers a real Telegram notification

### Key Talking Points
- "The phone accelerometer acts as a vibration sensor, simulating industrial vibration monitoring"
- "Data is sent via WebSocket at 2Hz, mapped to the MetroPT-3 sensor space, and classified by our K-Means + Isolation Forest models"
- "This is a complete IoT pipeline: Sensor → Transport → ML Inference → Dashboard → Alert"

---

## Troubleshooting

### Phone can't connect
- Make sure phone and laptop are on the **same WiFi**
- Use `--host 0.0.0.0` when starting uvicorn
- Try disabling Windows Firewall temporarily
- Make sure port 8000 is not used by another app

### Security warning won't go away
- This is expected with self-signed certificates
- Chrome: **Advanced → Proceed to site**
- If Chrome blocks completely, try typing `thisisunsafe` on the warning page (Chrome secret bypass)

### Sensor shows 0.00 / no data
- Make sure URL starts with **`https://`** (not `http://`)
- Check diagnostics panel: "Secure Context" should show "Yes (HTTPS)"
- If still not working, use the manual simulation toggle button

### Telegram not sending
- Verify env vars are set: `echo %TELEGRAM_TOKEN%` (CMD) or `echo $env:TELEGRAM_TOKEN` (PowerShell)
- Make sure you **messaged the bot first** (send "hello" to your bot in Telegram)
- Shake HARD enough to trigger CRITICAL (anomaly_score < -0.55)
- Check backend console for "Telegram alert sent" or error messages
- There's a 30-second cooldown between messages

### Dashboard not updating
- Check IoT tab shows "Sensors Online: 1" and "WS Status: Live"
- Try refreshing the dashboard page
- Make sure both backend and frontend are running
