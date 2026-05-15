"""
train.py — Run ONCE before starting the API.
Usage: python train.py
Training 1.5M rows takes ~35-45 seconds (real, verified).
"""
import pandas as pd, numpy as np, time
from pathlib import Path
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import MiniBatchKMeans
from sklearn.ensemble import IsolationForest
from sklearn.decomposition import PCA
import joblib

BASE   = Path(__file__).parent
DATA   = BASE/"data"
MODELS = BASE/"models"
MODELS.mkdir(exist_ok=True)
(DATA/"processed").mkdir(exist_ok=True, parents=True)

ANALOG = ['TP2','TP3','H1','DV_pressure','Reservoirs','Oil_temperature','Motor_current']
FEAT   = (ANALOG +
          [f'{c}_mean60' for c in ANALOG] +
          [f'{c}_std60'  for c in ANALOG] +
          [f'{c}_roc'    for c in ANALOG] +
          ['pressure_drop','pressure_ratio','temp_rise','motor_load','COMP_int'])

def log(m): print(f"  {m}")

def engineer(df):
    df=df.copy()
    Q1,Q3=df['DV_pressure'].quantile([0.25,0.75]); IQR=Q3-Q1
    df['DV_pressure']=df['DV_pressure'].clip(Q1-1.5*IQR,Q3+1.5*IQR)
    for c in ANALOG:
        df[f'{c}_mean60']=df[c].rolling(6, min_periods=1).mean()
        df[f'{c}_std60'] =df[c].rolling(6, min_periods=1).std().fillna(0)
        df[f'{c}_roc']   =df[c].diff().fillna(0)
    df['pressure_drop'] =df['TP2']-df['TP3']
    df['pressure_ratio']=df['TP2']/(df['TP3']+0.001)
    df['temp_rise']     =df['Oil_temperature'].diff().fillna(0)
    df['motor_load']    =df['Motor_current']*df['TP2'].abs()
    df['COMP_int']      =df['COMP'].astype(float)
    return df

def main():
    print("\n"+"="*55)
    print("  PREDICTIVE MAINTENANCE — TRAINING PIPELINE v3")
    print("="*55)

    csv=DATA/"MetroPT3(AirCompressor).csv"
    if not csv.exists():
        raise FileNotFoundError(
            f"\nDataset not found at: {csv}\n"
            "Place MetroPT3(AirCompressor).csv inside backend/data/")

    t0=time.time()
    log(f"Loading {csv.name} ...")
    df=pd.read_csv(csv,index_col=0)
    df['timestamp']=pd.to_datetime(df['timestamp'])
    df=df.sort_values('timestamp').reset_index(drop=True)
    log(f"Loaded {len(df):,} rows in {time.time()-t0:.1f}s")

    log("Feature engineering (33 features)...")
    t1=time.time()
    df=engineer(df)
    log(f"Done in {time.time()-t1:.1f}s")

    train=df[df['timestamp']<'2020-06-01']
    log(f"Train: {len(train):,} rows | Test: {len(df)-len(train):,} rows")

    X_tr=train[FEAT].fillna(0).values
    X_all=df[FEAT].fillna(0).values

    log("StandardScaler fit+transform...")
    sc=StandardScaler(); X_tr_sc=sc.fit_transform(X_tr); X_all_sc=sc.transform(X_all)

    log("PCA fit+transform (12 components)...")
    pca=PCA(n_components=12,random_state=42)
    X_tr_p=pca.fit_transform(X_tr_sc); X_all_p=pca.transform(X_all_sc)
    log(f"PCA variance retained: {pca.explained_variance_ratio_.sum()*100:.1f}%")

    log("MiniBatchKMeans K=3 training...")
    km=MiniBatchKMeans(n_clusters=3,random_state=42,n_init=10,batch_size=10000,max_iter=300)
    km.fit(X_tr_p); tr_lab=km.labels_; all_lab=km.predict(X_all_p)

    # Name clusters
    ot_means={c:train['Oil_temperature'].values[tr_lab==c].mean() for c in range(3)}
    tp2_means={c:train['TP2'].values[tr_lab==c].mean() for c in range(3)}
    sorted_c=sorted(ot_means.items(),key=lambda x:x[1])
    rem=[sorted_c[1][0],sorted_c[2][0]]
    cmap={sorted_c[0][0]:'NORMAL'}
    if tp2_means[rem[0]]>tp2_means[rem[1]]:
        cmap[rem[0]]='IDLE'; cmap[rem[1]]='HIGH-STRESS'
    else:
        cmap[rem[1]]='IDLE'; cmap[rem[0]]='HIGH-STRESS'
    log(f"Cluster names: {cmap}")

    log("Isolation Forest training (n_estimators=200)...")
    iso=IsolationForest(n_estimators=200,contamination=0.05,random_state=42,n_jobs=-1)
    iso.fit(X_tr_sc)
    all_scores=iso.score_samples(X_all_sc)
    log(f"Score range: {all_scores.min():.4f} to {all_scores.max():.4f}")

    log("Computing health scores and RUL...")
    risk={'NORMAL':0.0,'IDLE':0.15,'HIGH-STRESS':0.70}
    names=[cmap[int(l)] for l in all_lab]
    hs=[]; rul=[]
    cr_arr=np.array([risk.get(n,0.5) for n in names])
    ar_arr=np.clip((-all_scores-0.34)/0.37,0,1)*0.25
    tr_arr=np.clip((df['Oil_temperature'].values-62.64)/26.41,0,1)*0.05
    hs=np.round(100*(1-np.clip(cr_arr+ar_arr+tr_arr,0,1)),1)
    base_arr=np.array([{'NORMAL':720,'IDLE':360,'HIGH-STRESS':48}.get(n,168) for n in names])
    pen_arr=np.maximum(0,(-all_scores-0.45)/0.26)*48
    rul=np.maximum(1,np.round(base_arr-pen_arr)).astype(int)

    df['cluster']      =all_lab
    df['cluster_name'] =names
    df['anomaly_score']=all_scores
    df['health_score'] =hs
    df['rul_hours']    =rul

    # PCA 2D for scatter
    pca2=PCA(n_components=2,random_state=42)
    pc2d=pca2.fit_transform(X_all_sc)
    df['PC1']=pc2d[:,0]; df['PC2']=pc2d[:,1]

    log("Saving models...")
    joblib.dump(sc,   MODELS/'scaler.pkl')
    joblib.dump(pca,  MODELS/'pca_model.pkl')
    joblib.dump(km,   MODELS/'kmeans_model.pkl')
    joblib.dump(iso,  MODELS/'isolation_forest.pkl')
    joblib.dump(cmap, MODELS/'cluster_name_map.pkl')
    joblib.dump(FEAT, MODELS/'feature_cols.pkl')

    log("Saving labelled parquet...")
    df.to_parquet(DATA/'metropt_labelled.parquet',index=False)

    from sklearn.metrics import silhouette_score
    sil=silhouette_score(X_tr_p,tr_lab,sample_size=10000,random_state=42)
    total=time.time()-t0
    print("\n"+"="*55)
    print(f"  ✅ TRAINING COMPLETE in {total:.0f}s")
    print(f"  Silhouette Score  : {sil:.4f}")
    print(f"  Cluster dist      : {pd.Series(names).value_counts().to_dict()}")
    print(f"  Models saved to   : {MODELS}")
    print("="*55)
    print("\n  Now run: uvicorn main:app --port 8000")
    print("  Frontend: cd ../frontend && npm run dev\n")

if __name__=="__main__":
    main()
