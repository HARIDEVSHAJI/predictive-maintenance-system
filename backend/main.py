"""
FastAPI backend — Predictive Maintenance Dashboard
All heavy data is pre-loaded ONCE at startup and cached in memory.
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse
import pandas as pd, numpy as np, joblib, asyncio, io, os, time, json, urllib.request, urllib.parse, threading
from pathlib import Path
from typing import Optional

app = FastAPI(title="Predictive Maintenance API", version="3.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

BASE   = Path(__file__).parent
MODELS = BASE / "models"
DATA   = BASE / "data"
ANALOG  = ['TP2','TP3','H1','DV_pressure','Reservoirs','Oil_temperature','Motor_current']
DIGITAL = ['COMP','DV_eletric','Towers','MPG','LPS','Pressure_switch','Oil_level','Caudal_impulses']
ALL_SENSORS = ANALOG + DIGITAL

# ── GLOBAL CACHE (loaded once at startup) ────────────────────────────────────
_models: dict = {}
_df:     Optional[pd.DataFrame] = None      # full labelled dataframe
_cache:  dict = {}                          # pre-computed API responses

def get_models():
    global _models
    if _models: return _models
    try:
        _models['scaler']  = joblib.load(MODELS/'scaler.pkl')
        _models['pca']     = joblib.load(MODELS/'pca_model.pkl')
        _models['kmeans']  = joblib.load(MODELS/'kmeans_model.pkl')
        _models['iso']     = joblib.load(MODELS/'isolation_forest.pkl')
        _models['cmap']    = joblib.load(MODELS/'cluster_name_map.pkl')
        _models['fcols']   = joblib.load(MODELS/'feature_cols.pkl')
        print("✅ Models loaded")
    except Exception as e:
        print(f"⚠️  Models not found: {e}")
    return _models

def get_df() -> Optional[pd.DataFrame]:
    global _df
    if _df is not None: return _df
    p = DATA / 'metropt_labelled.parquet'
    if not p.exists(): return None
    _df = pd.read_parquet(p)
    _df['timestamp'] = pd.to_datetime(_df['timestamp'])
    print(f"✅ Loaded {len(_df):,} rows from parquet")
    return _df

@app.on_event("startup")
def startup():
    """Pre-load everything and pre-compute all API responses."""
    get_models()
    df = get_df()
    if df is None:
        print("⚠️  No parquet yet — run train.py first")
        return
    _precompute_cache(df)

def _precompute_cache(df: pd.DataFrame):
    """Run ALL heavy computations ONCE and store results in _cache."""
    global _cache
    print("⚙️  Pre-computing API cache...")
    t0 = time.time()

    total = len(df)

    # ── Overview ─────────────────────────────────────────────────────────────
    avg_health = round(float(df['health_score'].mean()), 1)
    alerts_warn   = int((df['anomaly_score'] < -0.45).sum())
    alerts_crit   = int((df['anomaly_score'] < -0.55).sum())
    med_rul   = round(float(df['rul_hours'].median() / 24), 1)
    status    = ('CRITICAL' if alerts_crit > 80000
                 else 'WARNING' if alerts_warn > 50000 else 'HEALTHY')

    df2 = df.copy()
    df2['date']  = df2['timestamp'].dt.date.astype(str)
    df2['month'] = df2['timestamp'].dt.to_period('M').astype(str)
    monthly   = df2.groupby('month').size().reset_index(name='count')
    timeline  = df2.groupby('date')['anomaly_score'].mean().reset_index()
    timeline.columns = ['date','avg_score']

    cluster_dist = df['cluster_name'].value_counts().reset_index()
    cluster_dist.columns = ['cluster','count']

    recent = df[df['anomaly_score'] < -0.45].tail(12)[
        ['timestamp','cluster_name','anomaly_score','health_score','TP2','Oil_temperature']
    ].copy()
    recent['timestamp']  = recent['timestamp'].astype(str)
    recent['alert_level']= recent['anomaly_score'].apply(_alert)

    _cache['overview'] = {
        "status": status, "avg_health": avg_health,
        "alert_count": alerts_warn, "median_rul_days": med_rul,
        "total_rows": total,
        "monthly":      monthly.to_dict(orient='records'),
        "cluster_dist": cluster_dist.to_dict(orient='records'),
        "timeline":     timeline.to_dict(orient='records'),
        "recent_events":recent.to_dict(orient='records'),
        "failure_events":[
            {"id":"#1a","date":"2020-04-18","type":"Air Leak","severity":"High","duration":"24h"},
            {"id":"#1b","date":"2020-05-29","type":"Air Leak","severity":"High","duration":"6.5h"},
            {"id":"#3", "date":"2020-06-05","type":"Air Leak","severity":"High","duration":"52h"},
            {"id":"#4", "date":"2020-07-15","type":"Air Leak","severity":"High","duration":"9.5h"},
            {"id":"#5", "date":"2020-07-16","type":"Air Leak","severity":"High","duration":"9.5h"},
        ],
        "key_metrics": {"silhouette":0.6117,"davies_bouldin":1.1267,
                        "calinski_harabasz":20024,"pca_components":12,"variance_retained":96.0}
    }

    # ── Clusters ─────────────────────────────────────────────────────────────
    sample = df.sample(min(8000, total), random_state=42).copy()
    profiles = df.groupby('cluster_name').agg(
        count=('cluster_name','count'),
        avg_tp2=('TP2','mean'), avg_motor=('Motor_current','mean'),
        avg_oil=('Oil_temperature','mean'), avg_score=('anomaly_score','mean'),
        avg_tp3=('TP3','mean')
    ).reset_index()
    profiles['pct'] = (profiles['count'] / total * 100).round(1)

    scatter = sample[['PC1','PC2','cluster_name','TP2','Motor_current',
                       'Oil_temperature','anomaly_score']].copy()
    scatter['timestamp'] = sample['timestamp'].astype(str)

    # ── Real sparklines: cluster weekly trend ─────────────────────────────────
    df['_week'] = df['timestamp'].dt.to_period('W').astype(str)
    weeks_sorted = sorted(df['_week'].unique())
    cluster_weekly_trends = {}
    for cname in ['NORMAL','IDLE','HIGH-STRESS']:
        sub = df[df['cluster_name']==cname].groupby('_week')['anomaly_score'].mean()
        vals = [round(float(sub.get(w, np.nan)),4) for w in weeks_sorted]
        # fill NaN with nearest valid
        clean = [v for v in vals if not np.isnan(v)]
        avg_v = float(np.mean(clean)) if clean else -0.45
        vals = [v if not np.isnan(v) else avg_v for v in vals]
        cluster_weekly_trends[cname] = vals[-12:]   # last 12 weeks
    _cache['cluster_weekly_trends'] = cluster_weekly_trends

    _cache['clusters'] = {
        "profiles": profiles.to_dict(orient='records'),
        "scatter":  scatter.fillna(0).to_dict(orient='records'),
        "metrics_table": _KMEANS_METRICS,
        "cluster_weekly_trends": cluster_weekly_trends
    }

    # ── Real sparklines: anomaly score context for recent events ──────────────
    recent_events_raw = df[df['anomaly_score'] < -0.45].tail(15)
    recent_with_spark = []
    df_reset = df.reset_index(drop=True)
    for _, row in recent_events_raw.iterrows():
        ts  = row['timestamp']
        pos = df_reset[df_reset['timestamp']==ts].index
        i   = int(pos[0]) if len(pos) else 0
        window_scores = df_reset.iloc[max(0,i-4):i+5]['anomaly_score'].round(4).tolist()
        rec = {
            'timestamp':   str(ts),
            'cluster_name':str(row.get('cluster_name','NORMAL')),
            'anomaly_score':round(float(row.get('anomaly_score',-0.41)),4),
            'health_score': float(row.get('health_score',90)),
            'TP2':          round(float(row.get('TP2',0)),3),
            'Oil_temperature':round(float(row.get('Oil_temperature',62.6)),1),
            'alert_level':  _alert(float(row.get('anomaly_score',-0.41))),
            'spark_scores': window_scores,
        }
        recent_with_spark.append(rec)
    _cache['overview']['recent_events'] = recent_with_spark

    # ── Anomalies ─────────────────────────────────────────────────────────────
    daily = df2.groupby('date').agg(
        anomaly_count=('anomaly_score', lambda x:(x<-0.45).sum()),
        critical_count=('anomaly_score', lambda x:(x<-0.55).sum()),
    ).reset_index()
    hv, he = np.histogram(df['anomaly_score'], bins=60)
    hist = [{"score":round(float((he[i]+he[i+1])/2),4),"count":int(hv[i])} for i in range(len(hv))]
    _cache['anomalies'] = {
        "daily_anomalies": daily.to_dict(orient='records'),
        "score_distribution": hist,
        "counts":{"critical":alerts_crit,"warning":int((alerts_warn-alerts_crit)),
                  "normal":int((df['anomaly_score']>=-0.45).sum())},
        "failure_windows":[
            {"id":"#1a","start":"2020-04-18","end":"2020-04-18","detection_rate":4},
            {"id":"#1b","start":"2020-05-29","end":"2020-05-30","detection_rate":2},
            {"id":"#3", "start":"2020-06-05","end":"2020-06-07","detection_rate":13},
            {"id":"#4", "start":"2020-07-15","end":"2020-07-15","detection_rate":5},
            {"id":"#5", "start":"2020-07-16","end":"2020-07-16","detection_rate":5},
        ]
    }

    # ── Sensor trends (all-time, 5-min resample) ──────────────────────────────
    df_s = df.set_index('timestamp')
    res_num = df_s[ANALOG + ['anomaly_score']].resample('5min').mean()
    res_cls = df_s[['cluster_name']].resample('5min').agg(
        lambda x: x.mode().iloc[0] if len(x) > 0 else 'NORMAL'
    )
    res = pd.concat([res_num, res_cls], axis=1)
    res.reset_index(inplace=True)
    res['timestamp'] = res['timestamp'].astype(str)
    anom_pts = res[res['anomaly_score'] < -0.45][['timestamp'] + ANALOG].copy()
    corr = df[ANALOG].corr().round(3)
    stats = {c:{"mean":round(float(df[c].mean()),4),"std":round(float(df[c].std()),4),
                "min":round(float(df[c].min()),4),"max":round(float(df[c].max()),4)}
             for c in ANALOG}
    _cache['sensors_all'] = {
        "trends":       res[['timestamp']+ANALOG+['anomaly_score']].ffill().to_dict(orient='records'),
        "anomaly_points":anom_pts.to_dict(orient='records'),
        "correlation":  corr.to_dict(),
        "sensor_stats": stats,
    }

    # ── Model performance ────────────────────────────────────────────────────
    hv2, he2 = np.histogram(df['anomaly_score'], bins=50)
    sd = [{"score":round(float((he2[i]+he2[i+1])/2),4),"count":int(hv2[i])} for i in range(len(hv2))]
    pv = [37.3,16.9,10.6,7.5,6.4,3.5,3.4,3.1,2.4,1.9,1.5,1.3]
    cum, c2 = [], 0
    for v in pv:
        c2 += v; cum.append(round(c2,1))
    _cache['model_perf'] = {
        "clustering_metrics": _KMEANS_METRICS,
        "pca_variance":[{"component":f"PC{i+1}","variance":v,"cumulative":cum[i]} for i,v in enumerate(pv)],
        "anomaly_score_dist": sd,
        "algorithm_comparison":[
            {"algorithm":"MiniBatchKMeans","role":"Behaviour Segmentation","metric":"Silhouette","value":"0.6117","status":"Excellent"},
            {"algorithm":"DBSCAN","role":"Noise Detection","metric":"Noise %","value":"~5%","status":"Good"},
            {"algorithm":"Isolation Forest","role":"Anomaly Scoring","metric":"Contamination","value":"5%","status":"Good"},
            {"algorithm":"PCA","role":"Dim Reduction","metric":"Var Retained","value":"96%","status":"Excellent"},
        ],
        "best_k":3,"silhouette":0.6117,"davies_bouldin":1.1267,"calinski_harabasz":20024,
    }

    # ── Dataset info ─────────────────────────────────────────────────────────
    _cache['dataset'] = {
        "name":"MetroPT-3 Air Compressor Dataset","published":"Nature Scientific Data, Vol 9, Issue 1, 2022",
        "doi":"10.1038/s41597-022-01877-3","license":"Creative Commons CC BY 4.0",
        "source":"UCI ML Repository — Dataset ID 791","equipment":"Air Production Unit (APU) — Train compressor",
        "rows":total,"columns":17,"missing_values":0,
        "period":"213 days | ~10 second sampling","date_range":"2020-02-01 to 2020-09-01",
        "columns_doc":[
            {"column":"TP2","description":"Compressor pressure","unit":"bar","type":"Analog"},
            {"column":"TP3","description":"Pneumatic panel pressure","unit":"bar","type":"Analog"},
            {"column":"H1","description":"Air drying tower pressure","unit":"bar","type":"Analog"},
            {"column":"DV_pressure","description":"Pressure drop","unit":"bar","type":"Analog"},
            {"column":"Reservoirs","description":"Air tank pressure","unit":"bar","type":"Analog"},
            {"column":"Oil_temperature","description":"Compressor oil temperature","unit":"°C","type":"Analog"},
            {"column":"Motor_current","description":"Electric motor current","unit":"A","type":"Analog"},
            {"column":"COMP","description":"Compressor ON/OFF","unit":"0/1","type":"Digital"},
            {"column":"DV_eletric","description":"Electric valve state","unit":"0/1","type":"Digital"},
            {"column":"Towers","description":"Drying towers active","unit":"0/1","type":"Digital"},
            {"column":"MPG","description":"Pressure generator motor","unit":"0/1","type":"Digital"},
            {"column":"LPS","description":"Low pressure safety switch","unit":"0/1","type":"Digital"},
            {"column":"Pressure_switch","description":"Pressure safety switch","unit":"0/1","type":"Digital"},
            {"column":"Oil_level","description":"Oil level sensor","unit":"0/1","type":"Digital"},
            {"column":"Caudal_impulses","description":"Air flow impulses","unit":"0/1","type":"Digital"},
        ]
    }

    elapsed = time.time() - t0
    print(f"✅ Cache built in {elapsed:.1f}s")

# ── Constants ─────────────────────────────────────────────────────────────────
_KMEANS_METRICS = [
    {"K":2,"silhouette":0.608, "db":1.0535,"ch":27851.8,"inertia":1017029},
    {"K":3,"silhouette":0.6117,"db":1.1267,"ch":20023.9,"inertia":879642},
    {"K":4,"silhouette":0.4205,"db":1.1712,"ch":20684.9,"inertia":706703},
    {"K":5,"silhouette":0.2593,"db":1.2531,"ch":16442.6,"inertia":684282},
    {"K":6,"silhouette":0.4362,"db":1.2031,"ch":19283.1,"inertia":545666},
    {"K":7,"silhouette":0.4492,"db":0.9318,"ch":19288.5,"inertia":477833},
    {"K":8,"silhouette":0.3350,"db":1.1942,"ch":16797.8,"inertia":472667},
]

# ── Helpers ───────────────────────────────────────────────────────────────────
def _alert(s):
    if s < -0.55: return 'CRITICAL'
    if s < -0.45: return 'WARNING'
    return 'NORMAL'

def _health(cname, score, oil_temp):
    cr = {'NORMAL':0.0,'IDLE':0.15,'HIGH-STRESS':0.70}.get(cname,0.5)
    ar = float(np.clip((-score-0.34)/0.37,0,1))*0.25
    tr = float(np.clip((oil_temp-62.64)/26.41,0,1))*0.05
    return round(100*(1-min(cr+ar+tr,1.0)),1)

def _rul(cname, score):
    base = {'NORMAL':720,'IDLE':360,'HIGH-STRESS':48}.get(cname,168)
    pen  = max(0,(-score-0.45)/0.26)*48
    return max(1,round(base-pen))

def _rec(cname, rul):
    if cname=='HIGH-STRESS' or rul<=24: return '🔴 EMERGENCY: Inspect compressor immediately.'
    if rul<=72: return f'🟠 URGENT: Schedule maintenance within {rul} hours.'
    if cname=='IDLE' or rul<=168: return f'🟡 MONITOR: Inspect within {rul//24} days.'
    return f'✅ HEALTHY: Next check in ~{rul//24} days.'

def _engineer(df):
    df = df.copy()
    if 'timestamp' in df.columns:
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp').reset_index(drop=True)
    if 'DV_pressure' in df.columns:
        Q1,Q3 = df['DV_pressure'].quantile([0.25,0.75])
        df['DV_pressure'] = df['DV_pressure'].clip(Q1-1.5*(Q3-Q1),Q3+1.5*(Q3-Q1))
    for col in ANALOG:
        if col in df.columns:
            df[f'{col}_mean60'] = df[col].rolling(6,min_periods=1).mean()
            df[f'{col}_std60']  = df[col].rolling(6,min_periods=1).std().fillna(0)
            df[f'{col}_roc']    = df[col].diff().fillna(0)
    df['pressure_drop']  = df.get('TP2',0) - df.get('TP3',0)
    df['pressure_ratio'] = df.get('TP2',0) / (df.get('TP3',1e-3)+1e-3)
    df['temp_rise']      = df.get('Oil_temperature',pd.Series([0]*len(df))).diff().fillna(0)
    df['motor_load']     = df.get('Motor_current',0) * df.get('TP2',pd.Series([0]*len(df))).abs()
    df['COMP_int']       = df.get('COMP',1.0).astype(float)
    return df

def _predict_df(df_feat):
    m = get_models()
    if not m: return None,None,None
    fc   = m['fcols']
    fc   = [c for c in fc if c in df_feat.columns]
    X    = df_feat[fc].fillna(0).values
    Xs   = m['scaler'].transform(X)
    Xp   = m['pca'].transform(Xs)
    labs = m['kmeans'].predict(Xp)
    scrs = m['iso'].score_samples(Xs)
    names= [m['cmap'].get(int(l),'UNKNOWN') for l in labs]
    return names, scrs, labs

# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/api/health")
def api_health():
    m = get_models(); df = get_df()
    return {"models_loaded":bool(m),"data_loaded":df is not None,"rows":len(df) if df is not None else 0}

@app.get("/api/overview")
def api_overview():
    if 'overview' not in _cache: raise HTTPException(503,"Data not ready — run train.py first")
    return _cache['overview']

@app.get("/api/clusters")
def api_clusters():
    if 'clusters' not in _cache: raise HTTPException(503,"Data not ready")
    return _cache['clusters']

@app.get("/api/anomalies")
def api_anomalies():
    if 'anomalies' not in _cache: raise HTTPException(503,"Data not ready")
    return _cache['anomalies']

@app.get("/api/sensors")
def api_sensors(days: int = 213):
    if 'sensors_all' not in _cache: raise HTTPException(503,"Data not ready")
    data = _cache['sensors_all']
    if days < 213:
        df = get_df()
        if df is not None:
            cutoff = df['timestamp'].max() - pd.Timedelta(days=days)
            sub    = df[df['timestamp'] >= cutoff].set_index('timestamp')
            res    = sub[ANALOG+['anomaly_score']].resample('5min').mean()
            res.reset_index(inplace=True)
            res['timestamp'] = res['timestamp'].astype(str)
            return {**data, "trends": res.ffill().to_dict(orient='records')}
    return data

@app.get("/api/model-performance")
def api_model_perf():
    if 'model_perf' not in _cache: raise HTTPException(503,"Data not ready")
    return _cache['model_perf']

@app.get("/api/dataset-info")
def api_dataset_info():
    if 'dataset' not in _cache: raise HTTPException(503,"Data not ready")
    return _cache['dataset']

@app.get("/api/config")
def get_config():
    """Expose telegram config to frontend so it can send messages (bypassing HF firewall)."""
    return {
        "telegram_token": TELEGRAM_TOKEN,
        "telegram_chat_id": TELEGRAM_CHAT_ID
    }

@app.get("/api/download/{scenario}")
def api_download(scenario: str):
    df = get_df()
    if df is None: raise HTTPException(503,"Data not ready")
    if scenario=="healthy":
        data=df[(df['cluster_name']=='NORMAL')&(df['anomaly_score']>-0.42)].head(5000); fn="healthy_scenario.csv"
    elif scenario=="warning":
        data=df[(df['cluster_name']=='IDLE')&(df['anomaly_score'].between(-0.52,-0.45))].head(5000); fn="warning_scenario.csv"
    elif scenario=="critical":
        data=df[(df['timestamp']>='2020-06-05 10:00')&(df['timestamp']<='2020-06-07 14:30')].head(5000); fn="critical_failure.csv"
    else:
        data=df.head(50000); fn="metropt3_labelled_sample.csv"
    out=[c for c in ALL_SENSORS+['timestamp','cluster_name','anomaly_score','health_score','rul_hours'] if c in data.columns]
    buf=io.StringIO(); data[out].to_csv(buf,index=False); buf.seek(0)
    return StreamingResponse(io.BytesIO(buf.getvalue().encode()),media_type="text/csv",
                             headers={"Content-Disposition":f"attachment; filename={fn}",
                                      "Access-Control-Expose-Headers":"Content-Disposition"})

@app.post("/api/upload")
async def api_upload(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        df_up = pd.read_csv(io.BytesIO(contents))
        missing=[c for c in ANALOG if c not in df_up.columns]
        if missing: return {"success":False,"error":f"Missing columns: {missing}"}
        for d in DIGITAL:
            if d not in df_up.columns: df_up[d]=1.0
        df_fe = _engineer(df_up)
        names,scores,_ = _predict_df(df_fe)
        if names is None: return {"success":False,"error":"Models not loaded"}
        df_up['cluster_name'] =names
        df_up['anomaly_score']=scores
        df_up['health_score'] =[_health(n,s,o) for n,s,o in zip(names,scores,df_up['Oil_temperature'])]
        df_up['alert_level']  =[_alert(s) for s in scores]
        df_up['rul_hours']    =[_rul(n,s) for n,s in zip(names,scores)]
        return {"success":True,"rows":len(df_up),"columns":list(df_up.columns),
                "cluster_dist":df_up['cluster_name'].value_counts().to_dict(),
                "alert_dist":df_up['alert_level'].value_counts().to_dict(),
                "avg_health":round(float(df_up['health_score'].mean()),1),
                "avg_score":round(float(df_up['anomaly_score'].mean()),4),
                "sample":df_up.head(200).fillna(0).to_dict(orient='records')}
    except Exception as e:
        return {"success":False,"error":str(e)}

@app.post("/api/predict-single")
async def api_predict_single(data: dict):
    try:
        row={k:float(v) for k,v in data.items() if k in ALL_SENSORS}
        for k in ALL_SENSORS:
            if k not in row: row[k]=1.0 if k in DIGITAL else 0.0
        df_r  = pd.DataFrame([row])
        df_fe = _engineer(df_r)
        names,scores,_ = _predict_df(df_fe)
        if names is None: return {"error":"Models not loaded"}
        n,s = names[0],scores[0]
        rul = _rul(n,s)
        return {"cluster":n,"anomaly_score":round(float(s),4),
                "health_score":_health(n,s,row.get('Oil_temperature',62.64)),
                "alert_level":_alert(s),"rul_hours":rul,"rul_days":round(rul/24,1),
                "recommendation":_rec(n,rul)}
    except Exception as e:
        return {"error":str(e)}

# ── WebSocket: Historical playback ───────────────────────────────────────────
@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket):
    await websocket.accept()
    try:
        config   = await websocket.receive_json()
        scenario = config.get("scenario","healthy")
        speed    = float(config.get("speed",1.0))
        df = get_df()
        if df is None:
            await websocket.send_json({"error":"Data not ready"}); await websocket.close(); return

        if scenario=="healthy":
            sub=df[(df['cluster_name']=='NORMAL')&(df['anomaly_score']>-0.42)].head(500)
        elif scenario=="pre_failure":
            sub=df[(df['timestamp']>='2020-04-15')&(df['timestamp']<='2020-04-17')].head(500)
        elif scenario=="active_failure":
            sub=df[(df['timestamp']>='2020-06-05 10:00')&(df['timestamp']<='2020-06-07 14:30')].head(600)
        elif scenario=="custom":
            s=pd.to_datetime(config.get("start","2020-02-01")); e=pd.to_datetime(config.get("end","2020-03-01"))
            sub=df[(df['timestamp']>=s)&(df['timestamp']<=e)].head(1000)
        else:
            sub=df.head(500)
        sub=sub.reset_index(drop=True)

        await websocket.send_json({"type":"start","total":len(sub)})
        delay = max(0.05,0.2/speed)

        for i,row in sub.iterrows():
            try:
                msg=await asyncio.wait_for(websocket.receive_json(),timeout=0.01)
                if msg.get("action")=="stop": break
                if msg.get("action")=="speed":
                    speed=float(msg.get("value",1.0)); delay=max(0.05,0.2/speed)
            except asyncio.TimeoutError: pass

            n=str(row.get('cluster_name','NORMAL')); s=float(row.get('anomaly_score',-0.41))
            rul=_rul(n,s)
            await websocket.send_json({
                "type":"row","index":int(i),"total":len(sub),
                "timestamp":str(row.get('timestamp','')),
                "cluster":n,"health_score":float(row.get('health_score',90)),
                "anomaly_score":round(s,4),"alert_level":_alert(s),
                "rul_hours":rul,"recommendation":_rec(n,rul),
                "sensors":{c:round(float(row.get(c,0)),4) for c in ANALOG if c in row.index}
            })
            await asyncio.sleep(delay)
        await websocket.send_json({"type":"done"})
    except WebSocketDisconnect: pass
    except Exception as e:
        try: await websocket.send_json({"type":"error","message":str(e)})
        except: pass

# ── WebSocket: Synthetic live generator (Option B) ───────────────────────────
_NORMAL_STATS = {
    'TP2':     (-0.013, 0.008),  'TP3':      (8.96,  0.25),
    'H1':      (8.55,  0.25),   'DV_pressure':(-0.020,0.003),
    'Reservoirs':(8.96, 0.25),  'Oil_temperature':(62.6, 2.0),
    'Motor_current':(0.04,0.01),
}
_FAULT_SIGNATURES = {
    # key: (tp2_delta, tp3_delta, oil_temp_delta, motor_delta) per step
    'air_leak':     (-0.18, -0.06,  0.25, 0.18),
    'overheat':     ( 0.00,  0.00,  0.55, 0.10),
    'pressure_drop':(-0.25, -0.10,  0.10, 0.22),
    'bearing_wear': ( 0.00,  0.00,  0.15, 0.30),
}

@app.websocket("/ws/synthetic")
async def ws_synthetic(websocket: WebSocket):
    await websocket.accept()
    try:
        config    = await websocket.receive_json()
        speed     = float(config.get("speed",1.0))
        fault     = config.get("fault", None)   # None = normal
        steps     = int(config.get("steps", 300))
        delay     = max(0.05, 0.15/speed)

        # Current sensor state
        state = {k: float(np.random.normal(mu, sig))
                 for k,(mu,sig) in _NORMAL_STATS.items()}
        state.update({d:1.0 for d in DIGITAL})
        fault_step = 0

        await websocket.send_json({"type":"start","total":steps})

        for i in range(steps):
            # Check for control messages
            try:
                msg = await asyncio.wait_for(websocket.receive_json(), timeout=0.01)
                if msg.get("action")=="stop": break
                if msg.get("action")=="inject_fault":
                    fault = msg.get("fault","air_leak"); fault_step=0
                if msg.get("action")=="recover":
                    fault=None; fault_step=0
                if msg.get("action")=="speed":
                    speed=float(msg.get("value",1.0)); delay=max(0.05,0.15/speed)
            except asyncio.TimeoutError: pass

            # Evolve sensor state
            if fault and fault in _FAULT_SIGNATURES:
                sig = _FAULT_SIGNATURES[fault]
                fault_step = min(fault_step+1, 60)
                intensity  = fault_step/60   # 0→1 over 60 steps
                state['TP2']             += sig[0]*intensity + np.random.normal(0,0.003)
                state['TP3']             += sig[1]*intensity*0.3 + np.random.normal(0,0.015)
                state['Oil_temperature'] += sig[2]*intensity + np.random.normal(0,0.05)
                state['Motor_current']   += sig[3]*intensity*0.5 + np.random.normal(0,0.002)
                state['COMP'] = 0.0 if fault=='air_leak' and fault_step>20 else 1.0
                state['LPS']  = 1.0 if state['TP3'] < 8.0 else 0.0
            else:
                # Normal fluctuation
                for k,(mu,sig2) in _NORMAL_STATS.items():
                    state[k] = float(np.clip(
                        state[k]*0.97 + np.random.normal(mu,sig2)*0.03 + np.random.normal(0,sig2*0.15),
                        mu-4*sig2, mu+4*sig2
                    ))
                state['COMP']=1.0; state['LPS']=0.0

            # Clamp physical limits
            state['TP2']             = max(-0.05, min(11.0, state['TP2']))
            state['TP3']             = max(0.5,   min(10.5, state['TP3']))
            state['Oil_temperature'] = max(15.0,  min(90.0, state['Oil_temperature']))
            state['Motor_current']   = max(0.02,  min(9.5,  state['Motor_current']))

            # Predict
            row = {**state}
            df_r  = pd.DataFrame([row])
            df_fe = _engineer(df_r)
            names, scores, _ = _predict_df(df_fe)
            if names is None:
                n='NORMAL'; s=-0.41
            else:
                n=names[0]; s=float(scores[0])
            rul=_rul(n,s)

            ts = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')
            await websocket.send_json({
                "type":"row","index":i,"total":steps,
                "timestamp":ts,"cluster":n,
                "health_score":_health(n,s,state['Oil_temperature']),
                "anomaly_score":round(s,4),"alert_level":_alert(s),
                "rul_hours":rul,"recommendation":_rec(n,rul),
                "sensors":{k:round(float(state[k]),4) for k in ANALOG},
                "fault_active":fault,
            })
            await asyncio.sleep(delay)

        await websocket.send_json({"type":"done"})
    except WebSocketDisconnect: pass
    except Exception as e:
        try: await websocket.send_json({"type":"error","message":str(e)})
        except: pass

# ── IoT Integration ───────────────────────────────────────────────────────────
import secrets as _secrets

_iot_clients: dict = {}          # {token: WebSocket} — connected phone WebSockets
_iot_dashboard_clients: list = [] # connected dashboard WebSockets
_iot_history: list = []          # last 500 readings
_iot_total_readings: int = 0
_last_telegram_sent: float = 0
_iot_tokens: dict = {}           # {token: {"created_at": float, "used": bool, "connected_at": float|None}}

@app.on_event("startup")
async def _clear_iot_on_startup():
    """Clear stale connections from any previous server run."""
    _iot_clients.clear()
    _iot_dashboard_clients.clear()
    _iot_tokens.clear()

# Load .env file (project-local config — no extra pip package needed)
def _load_dotenv():
    env_path = BASE / '.env'
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, _, value = line.partition('=')
        key, value = key.strip(), value.strip()
        if value and not os.environ.get(key):  # .env doesn't override existing env vars
            os.environ[key] = value

_load_dotenv()
TELEGRAM_TOKEN   = os.environ.get("TELEGRAM_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

# ── Authentication (in-memory — no database needed) ───────────────────────────
import random as _random

_credentials = {
    "username": os.environ.get("ADMIN_USERNAME", "admin"),
    "password": os.environ.get("ADMIN_PASSWORD", "admin123"),
}
# Immutable copy of the .env defaults — never modified by password reset
_default_hints = {
    "username": os.environ.get("ADMIN_USERNAME", "admin"),
    "password": os.environ.get("ADMIN_PASSWORD", "admin123"),
}
_auth_sessions: dict = {}     # {token_str: {"created_at": float}}
_reset_codes: dict = {}       # {code_str: {"expires": float}}


@app.get("/api/login-hints")
async def api_login_hints():
    """Return the original .env default credentials for use as placeholders.
    Always returns the factory defaults, never the runtime-changed password."""
    return {"username": _default_hints["username"], "password": _default_hints["password"]}


@app.post("/api/login")
async def api_login(data: dict):
    """Validate credentials and return a session token."""
    username = data.get("username", "")
    password = data.get("password", "")
    if username == _credentials["username"] and password == _credentials["password"]:
        token = _secrets.token_urlsafe(32)
        _auth_sessions[token] = {"created_at": time.time()}
        return {"success": True, "token": token}
    return {"success": False, "error": "Invalid username or password"}


@app.post("/api/verify-token")
async def api_verify_token(data: dict):
    """Check if a session token is still valid (24-hour expiry)."""
    token = data.get("token", "")
    if token in _auth_sessions:
        if time.time() - _auth_sessions[token]["created_at"] < 86400:
            return {"valid": True}
        del _auth_sessions[token]
    return {"valid": False}


@app.post("/api/logout")
async def api_logout(data: dict):
    """Invalidate a session token."""
    token = data.get("token", "")
    if token in _auth_sessions:
        del _auth_sessions[token]
    return {"success": True}


@app.post("/api/forgot-password")
async def api_forgot_password():
    """Generate a 6-digit reset code. Returns code + Telegram config so
    the frontend can send the code to Telegram (bypasses HF Spaces firewall)."""
    code = str(_random.randint(100000, 999999))
    _reset_codes[code] = {"expires": time.time() + 300}  # 5-minute expiry
    # Garbage-collect expired codes
    expired = [c for c, info in _reset_codes.items() if time.time() > info["expires"]]
    for c in expired:
        del _reset_codes[c]
    return {
        "success": True,
        "code": code,
        "telegram_token": TELEGRAM_TOKEN,
        "telegram_chat_id": TELEGRAM_CHAT_ID,
        "message": f"🔐 <b>Password Reset Code</b>\n\nYour code: <code>{code}</code>\n\nValid for 5 minutes.\n⚠️ Do not share this code.",
    }


@app.post("/api/reset-password")
async def api_reset_password(data: dict):
    """Validate reset code and update the in-memory password."""
    code = data.get("code", "")
    new_password = data.get("new_password", "")
    if not new_password or len(new_password) < 4:
        return {"success": False, "error": "Password must be at least 4 characters"}
    if code in _reset_codes:
        if time.time() < _reset_codes[code]["expires"]:
            _credentials["password"] = new_password
            del _reset_codes[code]
            _auth_sessions.clear()  # invalidate all sessions
            return {"success": True, "message": "Password updated successfully"}
        else:
            del _reset_codes[code]
            return {"success": False, "error": "Code expired. Request a new one."}
    return {"success": False, "error": "Invalid reset code"}


def _send_telegram(message: str):
    """Send Telegram alert with 30-second cooldown. Uses only stdlib urllib."""
    global _last_telegram_sent
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return
    now = time.time()
    if now - _last_telegram_sent < 30:
        return
    _last_telegram_sent = now
    def _do_send():
        try:
            import requests
            url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
            data = {
                "chat_id": TELEGRAM_CHAT_ID,
                "text": message,
                "parse_mode": "HTML"
            }
            # requests is much more robust with Docker networking/IPv4 fallbacks
            response = requests.post(url, data=data, timeout=30)
            response.raise_for_status()
            print("📨 Telegram alert sent")
        except Exception as e:
            print(f"⚠️  Telegram send failed: {e}")
    threading.Thread(target=_do_send, daemon=True).start()

def _iot_predict(ax: float, ay: float, az: float, magnitude: float, vibration: float) -> dict:
    """Map phone accelerometer data to MetroPT-3 sensor space and run ML pipeline."""
    m = get_models()
    if not m:
        return {"error": "Models not loaded"}

    norm_mag = min(magnitude / 20.0, 1.0)
    norm_vib = min(vibration / 10.0, 1.0)

    def clip(val, lo, hi):
        return max(lo, min(hi, val))

    # Map phone sensors to MetroPT-3 industrial sensor space
    pseudo_sensors = {
        'TP2':             clip(-0.013 + norm_vib * 8.5,    -0.03, 10.0),
        'TP3':             clip(8.96   - norm_mag * 0.5,      0.7, 10.3),
        'H1':              clip(8.55   - norm_vib * 1.2,    -0.04, 10.3),
        'DV_pressure':     clip(-0.02  + norm_vib * 0.08,  -0.03,  0.5),
        'Reservoirs':      clip(8.96   - norm_mag * 0.4,     0.7, 10.3),
        'Oil_temperature': clip(62.6   + norm_mag*15 + norm_vib*8, 15, 89),
        'Motor_current':   clip(0.04   + norm_mag*0.8 + norm_vib*1.2, 0.02, 9.3),
    }

    # Digital signals
    digitals = {
        'COMP': 1.0, 'DV_eletric': 1.0, 'Towers': 1.0, 'MPG': 1.0,
        'LPS': 1.0 if norm_vib > 0.6 else 0.0,
        'Pressure_switch': 1.0, 'Oil_level': 1.0, 'Caudal_impulses': 1.0,
    }

    # Build row with all base sensors
    row = {**pseudo_sensors, **digitals}

    # Compute engineered features (rolling stats = same value for single row, std=0, roc=0)
    fc = m['fcols']
    feat_row = {}
    for col in ANALOG:
        val = pseudo_sensors.get(col, 0.0)
        feat_row[col] = val
        feat_row[f'{col}_mean60'] = val   # rolling mean of 1 value = itself
        feat_row[f'{col}_std60']  = 0.0   # rolling std of 1 value = 0
        feat_row[f'{col}_roc']    = 0.0   # diff of 1 value = 0

    # Derived features
    feat_row['pressure_drop']  = pseudo_sensors['TP2'] - pseudo_sensors['TP3']
    feat_row['pressure_ratio'] = pseudo_sensors['TP2'] / (pseudo_sensors['TP3'] + 1e-3)
    feat_row['temp_rise']      = 0.0
    feat_row['motor_load']     = pseudo_sensors['Motor_current'] * abs(pseudo_sensors['TP2'])
    feat_row['COMP_int']       = digitals['COMP']

    # Build feature vector in correct order
    X = np.array([[feat_row.get(c, 0.0) for c in fc]])
    Xs = m['scaler'].transform(X)
    Xp = m['pca'].transform(Xs)
    cluster_label = int(m['kmeans'].predict(Xp)[0])
    anomaly_score = float(m['iso'].score_samples(Xs)[0])
    cluster_name = m['cmap'].get(cluster_label, 'UNKNOWN')

    health_score = _health(cluster_name, anomaly_score, pseudo_sensors['Oil_temperature'])
    rul_hours    = _rul(cluster_name, anomaly_score)
    alert_level  = _alert(anomaly_score)
    recommendation = _rec(cluster_name, rul_hours)

    return {
        "cluster": cluster_name,
        "anomaly_score": round(anomaly_score, 4),
        "health_score": health_score,
        "alert_level": alert_level,
        "rul_hours": rul_hours,
        "recommendation": recommendation,
        "sensors": {k: round(v, 4) for k, v in pseudo_sensors.items()},
    }


@app.get("/iot", response_class=HTMLResponse)
async def iot_page(token: str = ""):
    """Serve the mobile IoT sensor page. Requires a valid token."""
    now = time.time()
    if token and token in _iot_tokens:
        info = _iot_tokens[token]
        if not info.get('used') and now - info['created_at'] > 300:
            del _iot_tokens[token]

    if not token or token not in _iot_tokens:
        return HTMLResponse(
            "<html><body style='background:#000000;color:#ffffff;font-family:Inter,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;text-align:center'>"
            "<div><h1 style='color:#ef4444;font-size:24px'>⏳ Link Expired</h1>"
            "<p style='color:#9ca3af;margin-top:12px;font-weight:500;line-height:1.5'>This link has expired (exceeded 5 minutes).<br>Please go back to the dashboard and generate a new one.</p></div></body></html>",
            status_code=403
        )
    if _iot_tokens[token].get('used'):
        return HTMLResponse(
            "<html><body style='background:#000000;color:#ffffff;font-family:Inter,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;text-align:center'>"
            "<div><h1 style='color:#f59e0b;font-size:24px'>⚠️ Link Already In Use</h1>"
            "<p style='color:#9ca3af;margin-top:12px;font-weight:500;line-height:1.5'>A device is already connected with this link.<br>Disconnect it first or generate a new link.</p></div></body></html>",
            status_code=403
        )
    html_path = BASE / "iot_sensor.html"
    if not html_path.exists():
        raise HTTPException(404, "iot_sensor.html not found")
    return html_path.read_text(encoding='utf-8')


@app.post("/api/iot/generate-token")
def api_generate_token():
    """Generate a one-time-use token for an IoT sensor connection."""
    now = time.time()
    # Garbage collection: clear unused tokens older than 5 minutes (300 seconds)
    expired = [t for t, info in _iot_tokens.items() if not info.get("used") and now - info["created_at"] > 300]
    for t in expired:
        del _iot_tokens[t]

    token = _secrets.token_urlsafe(16)
    _iot_tokens[token] = {"created_at": now, "used": False, "connected_at": None}
    return {"token": token}


@app.get("/api/iot/devices")
def api_iot_devices():
    """List all connected IoT devices."""
    devices = []
    for token, ws in _iot_clients.items():
        info = _iot_tokens.get(token, {})
        devices.append({
            "token": token,
            "token_short": token[:8] + "...",
            "connected_at": info.get("connected_at"),
            "connected_since": round(time.time() - info.get("connected_at", time.time())) if info.get("connected_at") else 0,
        })
    return {"devices": devices, "count": len(devices)}


@app.post("/api/iot/disconnect/{token}")
async def api_iot_disconnect(token: str):
    """Force-disconnect a device by its token and expire the token."""
    if token in _iot_clients:
        ws = _iot_clients[token]
        try:
            await ws.close(code=1000, reason="Disconnected by dashboard")
        except:
            pass
        # Cleanup happens in the finally block of ws_iot_sensor
    # Expire the token regardless
    if token in _iot_tokens:
        del _iot_tokens[token]
    return {"status": "disconnected", "token": token}


@app.get("/api/iot/history")
def api_iot_history():
    """Return IoT reading history and connection stats."""
    return {
        "history": _iot_history[-200:],
        "connected_count": len(_iot_clients),
        "total_readings": _iot_total_readings,
    }


@app.get("/api/iot/export-csv")
def api_iot_export_csv():
    """Download all current IoT sensor readings as a CSV file."""
    if not _iot_history:
        raise HTTPException(404, "No sensor data available to export")
    df = pd.DataFrame(_iot_history)
    # Reorder columns for a clean CSV
    preferred = ['timestamp', 'token_short', 'ax', 'ay', 'az', 'magnitude', 'vibration',
                 'cluster', 'health_score', 'anomaly_score', 'alert_level', 'rul_hours']
    cols = [c for c in preferred if c in df.columns]
    df = df[cols]
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)
    filename = f"iot_sensor_data_{time.strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


async def _broadcast_device_change():
    """Notify all dashboard clients about device list changes."""
    devices = []
    for token in _iot_clients:
        info = _iot_tokens.get(token, {})
        devices.append({
            "token": token,
            "token_short": token[:8] + "...",
            "connected_at": info.get("connected_at"),
        })
    msg = {"type": "device_change", "devices": devices, "count": len(devices)}
    dead = []
    for dc in _iot_dashboard_clients:
        try:
            await dc.send_json(msg)
        except:
            dead.append(dc)
    for dc in dead:
        if dc in _iot_dashboard_clients:
            _iot_dashboard_clients.remove(dc)
    # If zero devices, also send a reset signal
    if len(_iot_clients) == 0:
        reset_msg = {"type": "all_disconnected"}
        for dc in _iot_dashboard_clients:
            try:
                await dc.send_json(reset_msg)
            except:
                pass


@app.websocket("/ws/iot-sensor")
async def ws_iot_sensor(websocket: WebSocket, token: str = ""):
    """Phone connects here with a valid token, sends accelerometer data, receives ML predictions."""
    global _iot_total_readings

    # Validate token expiry
    now = time.time()
    if token and token in _iot_tokens:
        info = _iot_tokens[token]
        if not info.get('used') and now - info['created_at'] > 300:
            del _iot_tokens[token]

    if not token or token not in _iot_tokens:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return
    if _iot_tokens[token].get('used'):
        await websocket.close(code=4002, reason="Token already in use")
        return

    await websocket.accept()
    _iot_tokens[token]['used'] = True
    _iot_tokens[token]['connected_at'] = time.time()
    _iot_clients[token] = websocket
    print(f"IoT sensor connected (token: {token[:8]}...). Total: {len(_iot_clients)}")
    await _broadcast_device_change()

    try:
        while True:
            # 15-second timeout: if phone stops sending, treat as disconnected
            raw = await asyncio.wait_for(websocket.receive_text(), timeout=15.0)
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            ax = float(data.get('ax', 0))
            ay = float(data.get('ay', 0))
            az = float(data.get('az', 0))
            magnitude = float(data.get('magnitude', 9.81))
            vibration = float(data.get('vibration', 0))

            result = _iot_predict(ax, ay, az, magnitude, vibration)
            _iot_total_readings += 1

            # Add to history (keep last 500)
            entry = {
                "timestamp": time.strftime('%Y-%m-%d %H:%M:%S'),
                "ax": round(ax, 2), "ay": round(ay, 2), "az": round(az, 2),
                "magnitude": round(magnitude, 2), "vibration": round(vibration, 2),
                "token_short": token[:8] + "...",
                **result
            }
            _iot_history.append(entry)
            if len(_iot_history) > 500:
                _iot_history.pop(0)

            # Send prediction back to phone
            await websocket.send_json(result)

            # Broadcast to dashboard clients
            dead = []
            for dc in _iot_dashboard_clients:
                try:
                    await dc.send_json(entry)
                except:
                    dead.append(dc)
            for dc in dead:
                if dc in _iot_dashboard_clients:
                    _iot_dashboard_clients.remove(dc)

    except WebSocketDisconnect:
        pass
    except asyncio.TimeoutError:
        # Phone stopped sending data — auto-disconnect
        try: await websocket.close()
        except: pass
    except Exception as e:
        print(f"IoT sensor WS error: {e}")
    finally:
        if token in _iot_clients:
            del _iot_clients[token]
        # Expire the token so it can't be reused
        if token in _iot_tokens:
            del _iot_tokens[token]
        print(f"IoT sensor disconnected (token: {token[:8]}...). Total: {len(_iot_clients)}")
        # Clear history if no devices left
        if len(_iot_clients) == 0:
            _iot_history.clear()
            _iot_total_readings = 0
        await _broadcast_device_change()


@app.websocket("/ws/iot-dashboard")
async def ws_iot_dashboard(websocket: WebSocket):
    """Dashboard connects here to receive live IoT updates."""
    await websocket.accept()
    _iot_dashboard_clients.append(websocket)
    print(f"IoT dashboard client connected. Total: {len(_iot_dashboard_clients)}")
    try:
        # Send recent history as initial payload
        await websocket.send_json({
            "type": "init",
            "history": _iot_history[-100:],
            "connected_count": len(_iot_clients),
            "total_readings": _iot_total_readings,
        })
        # Keep connection alive — wait for disconnect
        while True:
            await websocket.receive_text()   # just keep alive
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"IoT dashboard WS error: {e}")
    finally:
        if websocket in _iot_dashboard_clients:
            _iot_dashboard_clients.remove(websocket)
        print(f"IoT dashboard client disconnected. Total: {len(_iot_dashboard_clients)}")


from fastapi.staticfiles import StaticFiles

# ── Production Deployment: Serve React Frontend ───────────────────────────────
# In production, build the Vite app (npm run build) and FastAPI will serve it automatically.
dist_path = BASE.parent / "frontend" / "dist"
if dist_path.exists():
    # Mount everything else to the React build
    app.mount("/", StaticFiles(directory=dist_path, html=True), name="static")

if __name__=="__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, reload=False)
