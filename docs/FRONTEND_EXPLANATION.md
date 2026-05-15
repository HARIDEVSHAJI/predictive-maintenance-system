# Frontend — Complete Technical Explanation
## Industrial Machine Behaviour Segmentation for Predictive Maintenance
### LPU Third Year | Unsupervised Learning Subject

---

> **How to use this file:** Read it top to bottom before your presentation. Every section is written so you can explain it out loud, in your own words, to your evaluator. Code snippets explain the core logic of how the UI works.

---

## TABLE OF CONTENTS

1. [What the Frontend Does — Big Picture](#1-what-the-frontend-does)
2. [Technology Stack](#2-technology-stack)
3. [Folder Structure — Where Everything Lives](#3-folder-structure)
4. [App.jsx — The Core Layout & Navigation](#4-appjsx--the-core-layout)
5. [index.css — The Design System (Dark/Light Mode)](#5-indexcss--the-design-system)
6. [UI Components (`components/ui/index.jsx`)](#6-ui-components)
7. [Page 1: System Overview](#7-system-overview)
8. [Page 2: Live Monitor (WebSockets)](#8-live-monitor)
9. [Page 3: IoT Sensor Monitor (Mobile Integration)](#9-iot-sensor-monitor)
10. [Sending Data to Telegram (Code Walkthrough)](#10-sending-data-to-telegram)
11. [Page 4-7: Analytics Pages](#11-analytics-pages)
12. [Questions Your Evaluator Might Ask](#12-questions-your-evaluator-might-ask)

---

## 1. What the Frontend Does

The frontend is the **face** of the project. While the backend handles the heavy machine learning computations, the frontend translates those numbers into beautiful, understandable graphs and alerts. 

The frontend does four main jobs:
1. **Visualises Complex Data:** Turns millions of rows of data into easy-to-read Recharts graphs (Scatter plots, Line charts, Histograms).
2. **Real-time Live Streaming:** Maintains an open WebSocket connection with the backend to draw live graphs without refreshing the page.
3. **IoT Device Management:** Generates secure links for mobile phones and displays the live accelerometer data.
4. **Instant Action & Export:** Allows users to export sensor data to CSV or instantly alert maintenance teams via Telegram.

---

## 2. Technology Stack

- **React.js (v18):** The core UI library used to build reusable components.
- **Vite:** The incredibly fast build tool that compiles the React code (replaces create-react-app).
- **Recharts:** The charting library used for all the graphs (Scatter, Line, Bar, Pie).
- **Framer Motion:** Used for the smooth page transitions and loading animations.
- **Lucide-React:** Provides all the beautiful, modern SVG icons used in the dashboard.
- **Vanilla CSS:** Custom CSS variables for complete control over the premium Dark/Light mode theme.

---

## 3. Folder Structure

Here is how the React project is organized inside the `frontend/` directory:

```text
frontend/
├── src/
│   ├── main.jsx                 # Entry point, attaches React to the HTML
│   ├── App.jsx                  # Main Layout (Sidebar + Page switching logic)
│   ├── index.css                # Global styles, variables, and dark mode colors
│   ├── components/
│   │   └── ui/index.jsx         # Reusable UI components (Buttons, Health Gauge, etc)
│   └── pages/                   # The individual screens of the dashboard
│       ├── LoginPage.jsx        # JWT Authentication & Password Reset
│       ├── SystemOverview.jsx   # Top-level KPIs
│       ├── LiveMonitor.jsx      # WebSocket live streaming & Fault Injection
│       ├── ClusterAnalysis.jsx  # PCA Scatter plots
│       ├── AnomalyAlerts.jsx    # Alert histograms
│       ├── SensorTrends.jsx     # Correlation matrices
│       ├── ModelPerformance.jsx # ML scoring (Silhouette, DB, CH)
│       ├── DatasetReports.jsx   # Column definitions
│       └── IoTMonitor.jsx       # Mobile phone integration & Telegram
```

---

## 4. App.jsx — The Core Layout

`App.jsx` acts as the master container for the entire dashboard. It is responsible for three things:

1. **Routing (Without React-Router):** Instead of using complex external routing libraries, `App.jsx` simply keeps track of the current page in a React state variable (`const [page, setPage] = useState('overview')`). When you click a sidebar button, it updates the state, and the main window renders the correct component.
2. **The Sidebar:** It draws the left navigation menu and maps over the `NAV` array to create the buttons.
3. **Dark/Light Mode Toggle:** It manages the theme state and applies `data-theme="dark"` to the `<html>` element.

**Key Code Snippet (Dynamic Page Rendering):**
```jsx
// App.jsx
<main style={{ flex: 1, padding: 'var(--content-pad)', overflowY: 'auto' }}>
  {/* The component renders based on the 'page' state */}
  {page === 'overview' && <SystemOverview />}
  {page === 'live' && <LiveMonitor />}
  {page === 'iot' && <IoTMonitor />}
  {/* ... */}
</main>
```

---

## 5. index.css — The Design System

The project uses a highly modern, custom design system built with CSS Variables. This makes switching between light and dark modes completely seamless.

Instead of hardcoding colors like `color: #16161E`, the React components use `color: var(--bg-card)`. 

In `index.css`, we define what `--bg-card` means for both themes:

```css
/* Light Mode Variables */
:root {
  --bg-base:       #F0F2F5;
  --bg-card:       #FFFFFF;
  --text-primary:  #111827;
  --accent:        #E84B2A; /* Industrial Orange */
}

/* Dark Mode Variables (Activated by data-theme="dark") */
[data-theme="dark"] {
  --bg-base:       #0D0D12;
  --bg-card:       #16161E;
  --text-primary:  #F1F1F5;
}
```
When the user clicks the Sun/Moon icon in `App.jsx`, it just sets `data-theme="dark"` on the document, and the entire app recolors itself instantly.

---

## 6. UI Components (`components/ui/index.jsx`)

To keep the codebase clean, we created a file filled with reusable components. If we need a KPI card, we don't write the CSS from scratch; we just import `<KPICard />`.

Important Components:
- **`KPICard`**: The beautiful cards with the top colored accent line.
- **`HealthGauge`**: The circular progress bar that visualizes the machine health score from 0-100. It uses an SVG circle with `strokeDasharray` to draw the percentage.
- **`ClusterBadge`**: A reusable pill-shaped tag that colors itself correctly based on the ML prediction (e.g., Green for NORMAL, Red for HIGH-STRESS).

---

## 7. Page 0: Authentication (`LoginPage.jsx`)

**What it does:** It provides a secure, enterprise-grade gateway to the dashboard. It manages JWT (JSON Web Token) sessions and a robust "Forgot Password" flow.

**How it works:**
1. **Login Flow:** The component checks user credentials via `POST /api/login`. If valid, the backend issues a JWT token which is saved to the browser's `localStorage`.
2. **Telegram OTP Reset:** If an admin forgets their password, clicking "Forgot Password" triggers `POST /api/forgot-password`. 
3. **The Magic:** Instead of setting up a complex, expensive email server (like SendGrid), the backend generates a secure 6-digit OTP code and instantly messages it directly to the Admin's Telegram App via the Telegram Bot API! The admin types the 6-digit code into the React UI to authorize a password change.

---

## 8. Page 1: System Overview (`SystemOverview.jsx`)

**What it does:** It provides a high-level summary of the entire dataset. It fetches data from the backend's `/api/overview` endpoint.

**How it works:**
1. Uses `useEffect` to fetch data when the component loads.
2. Shows a loading spinner until data arrives.
3. Renders the top KPI cards (Total Readings, Overall Health, Warning Alerts).
4. Uses `Recharts` to draw the BarChart showing the distribution of the 3 machine states (NORMAL, IDLE, HIGH-STRESS).

---

## 9. Page 2: Live Monitor (`LiveMonitor.jsx`)

**What it does:** This is the most complex page. It creates a live WebSocket connection to the backend to stream either historical data or synthetic fault injections.

**How it works:**
1. It uses `useRef(null)` to hold the active WebSocket connection.
2. When the user clicks "Start Replay", it connects to `ws://localhost:8000/ws/live`.
3. The server sends JSON data every fraction of a second.
4. The component receives the message and updates a React state array `setHistory(prev => [...prev, newRow])`.
5. Recharts automatically redraws the LineChart every time the state updates, creating a smooth moving animation.

---

## 9. Page 3: IoT Sensor Monitor (`IoTMonitor.jsx`)

**What it does:** Allows the dashboard to monitor a connected smartphone acting as an IoT vibration sensor. 

**How it works:**
1. The user clicks "Generate New Link".
2. The frontend calls `POST /api/iot/generate-token` to get a secure, one-time token.
3. It constructs a URL: `http://localhost:5173/iot?token=xxx` and sets a visible 15-second visual countdown timer.
4. When the phone connects, the dashboard listens to `/ws/iot-dashboard` to receive the live accelerometer data streaming from the phone.

---

## 10. Sending Data to Telegram (Code Walkthrough)

One of the most impressive frontend features is the ability to export the live IoT sensor data directly to a Telegram group. This is done entirely in the browser using the Telegram Bot API.

Here is the exact code in `IoTMonitor.jsx` that handles this, explained:

```javascript
// 1. We fetch the Telegram Token and Chat ID from the backend on load
const { token, chat_id } = telegramConfigRef.current

// 2. We ask the backend for the raw CSV file of the live data
const res = await fetch('/api/iot/export-csv')
const blob = await res.blob() // Convert the response into a binary File Object
      
// 3. We create a "FormData" object. This simulates submitting an HTML form with a file attachment.
const formData = new FormData()
formData.append('chat_id', chat_id)

// We attach the CSV blob and give it a dynamic filename based on the current date
formData.append('document', blob, `iot_sensor_data_${new Date().toISOString()}.csv`)

// Add a nice message to send along with the file
formData.append('caption', '📊 Here is the latest IoT sensor data export.')

// 4. We send an HTTP POST request directly to Telegram's official API servers
const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
  method: 'POST',
  body: formData
})

// 5. Alert the user if successful
if (tgRes.ok) {
  alert("✅ CSV successfully sent to Telegram!")
}
```

**Why this is impressive:** We bypass the need for a complex backend emailing system. By directly interfacing with the Telegram API from the React frontend, we achieve instant, zero-latency mobile notifications for the maintenance team.

---

## 11. Page 4-7: Analytics Pages

- **`ClusterAnalysis.jsx`**: Draws a Scatter Plot using the PCA (Principal Component Analysis) coordinates generated by the backend. This proves visually that our K-Means algorithm successfully grouped the data into 3 distinct operational zones.
- **`AnomalyAlerts.jsx`**: Displays a histogram of the Isolation Forest anomaly scores. Shows the user exactly where the threshold (-0.45) was drawn to trigger alerts.
- **`SensorTrends.jsx`**: Displays a Heatmap/Correlation matrix. It proves to the evaluator that we understand the physics of the machine (e.g., showing that pressure TP2 goes down exactly when Motor Current goes up).
- **`ModelPerformance.jsx`**: Displays the raw academic metrics (Silhouette Score, Davies-Bouldin) to prove the machine learning model is statistically valid.

---

## 12. Questions Your Evaluator Might Ask

**Q: How does the dashboard update without refreshing the page?**
A: We use React State (`useState`) combined with WebSockets. The WebSocket holds an open tunnel to the backend. Every time a new sensor reading comes through the tunnel, we push it into the React state array. React detects the state change and instantly re-renders just the graph component, without touching the rest of the page.

**Q: Why use Recharts instead of Chart.js?**
A: Recharts is built specifically for React. Instead of manually drawing on an HTML canvas, Recharts allows us to use declarative XML tags like `<LineChart>` and `<XAxis>`. It automatically handles responsiveness, animations, and tooltips, which allowed us to build the dashboard much faster.

**Q: How is the light/dark mode so fast?**
A: We don't use Javascript to swap out every single color. We use CSS Custom Properties (Variables). By simply toggling a `data-theme="dark"` attribute on the root HTML tag, the browser's CSS engine instantly swaps all the color variables in milliseconds.

**Q: Where does the Telegram message get sent from?**
A: The React frontend handles it directly. It requests the CSV from our backend, wraps it in a FormData object, and sends an HTTP POST request straight to Telegram's `sendDocument` API endpoint.
