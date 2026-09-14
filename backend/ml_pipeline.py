"""
ml_pipeline.py  -  CAPEX AI RT2026
Pure-Python ML core: preprocessing, four model families, automatic selection,
Monte Carlo risk, SHAP explanation, and the CAPEX cost breakdown.

Optional dependencies (torch, tabpfn, shap) are guarded: if a library is not
installed, that capability is skipped and the rest of the pipeline still runs.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error

# ---- optional capabilities -------------------------------------------------
try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except Exception:
    TORCH_AVAILABLE = False

try:
    from tabpfn import TabPFNRegressor
    TABPFN_AVAILABLE = True
except Exception:
    TABPFN_AVAILABLE = False

try:
    import shap
    SHAP_AVAILABLE = True
except Exception:
    SHAP_AVAILABLE = False


# ---- data prep -------------------------------------------------------------
def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df = df.dropna(axis=1, how="all")
    df = df.loc[:, [c for c in df.columns if not str(c).lower().startswith("unnamed")]]
    return df


def split_features_target(df: pd.DataFrame):
    """Last column is the target (CAPEX). Non-numeric feature columns are
    one-hot encoded so structure types etc. can be used."""
    target = df.columns[-1]
    y = pd.to_numeric(df[target], errors="coerce")
    X = df.drop(columns=[target])
    X = pd.get_dummies(X, dummy_na=False)
    keep = y.notna()
    return X[keep].reset_index(drop=True), y[keep].reset_index(drop=True), list(X.columns), target


# ---- MLP (optional) --------------------------------------------------------
if TORCH_AVAILABLE:
    class _MLP(nn.Module):
        def __init__(self, n):
            super().__init__()
            self.net = nn.Sequential(
                nn.Linear(n, 128), nn.BatchNorm1d(128), nn.ReLU(), nn.Dropout(0.3),
                nn.Linear(128, 64), nn.BatchNorm1d(64), nn.ReLU(), nn.Dropout(0.2),
                nn.Linear(64, 32), nn.ReLU(),
                nn.Linear(32, 1),
            )
        def forward(self, x):
            return self.net(x)

    def _train_mlp(Xtr, ytr, Xte, yte):
        sc = StandardScaler().fit(Xtr)
        Xtr_s = torch.tensor(sc.transform(Xtr), dtype=torch.float32)
        Xte_s = torch.tensor(sc.transform(Xte), dtype=torch.float32)
        ytr_t = torch.tensor(ytr.values, dtype=torch.float32).view(-1, 1)
        model = _MLP(Xtr.shape[1])
        opt = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)
        loss_fn = nn.MSELoss()
        best, best_state, patience = 1e18, None, 0
        for _ in range(400):
            model.train(); opt.zero_grad()
            out = model(Xtr_s); loss = loss_fn(out, ytr_t)
            loss.backward(); opt.step()
            model.eval()
            with torch.no_grad():
                v = loss_fn(model(Xte_s), torch.tensor(yte.values, dtype=torch.float32).view(-1, 1)).item()
            if v < best - 1e-4:
                best, best_state, patience = v, model.state_dict(), 0
            else:
                patience += 1
                if patience > 30:
                    break
        if best_state:
            model.load_state_dict(best_state)
        model.eval()
        with torch.no_grad():
            pred = model(Xte_s).numpy().ravel()
        return ("mlp", model, sc), pred


# ---- training --------------------------------------------------------------
def train_models(df: pd.DataFrame, test_size: float = 0.2,
                 include_mlp: bool = True, include_tabpfn: bool = True):
    df = clean_dataframe(df)
    X, y, feat_names, target = split_features_target(df)
    if len(X) < 8:
        raise ValueError("Need at least 8 rows with a cost value to train.")

    imp = SimpleImputer(strategy="median")
    Ximp = pd.DataFrame(imp.fit_transform(X), columns=X.columns)
    Xtr, Xte, ytr, yte = train_test_split(Ximp, y, test_size=test_size, random_state=42)

    results, fitted = {}, {}

    rf = Pipeline([("imp", SimpleImputer(strategy="median")),
                   ("m", RandomForestRegressor(n_estimators=200, random_state=42, n_jobs=-1))])
    rf.fit(Xtr, ytr); results["RandomForest"] = _metrics(yte, rf.predict(Xte)); fitted["RandomForest"] = rf

    gb = Pipeline([("imp", SimpleImputer(strategy="median")),
                   ("m", GradientBoostingRegressor(n_estimators=200, learning_rate=0.05,
                                                   max_depth=4, subsample=0.8, random_state=42))])
    gb.fit(Xtr, ytr); results["GradientBoosting"] = _metrics(yte, gb.predict(Xte)); fitted["GradientBoosting"] = gb

    if include_mlp and TORCH_AVAILABLE and len(Xtr) >= 20:
        try:
            obj, pred = _train_mlp(Xtr, ytr, Xte, yte)
            results["MLP"] = _metrics(yte, pred); fitted["MLP"] = obj
        except Exception as e:
            results["MLP"] = {"available": False, "reason": str(e)}
    elif include_mlp:
        results["MLP"] = {"available": False, "reason": "torch not installed" if not TORCH_AVAILABLE else "too few rows"}

    if include_tabpfn and TABPFN_AVAILABLE and len(Xtr) <= 10000:
        try:
            tp = TabPFNRegressor()
            tp.fit(Xtr.values, ytr.values)
            results["TabPFN"] = _metrics(yte, np.asarray(tp.predict(Xte.values)).ravel())
            fitted["TabPFN"] = ("tabpfn", tp, imp)
        except Exception as e:
            results["TabPFN"] = {"available": False, "reason": str(e)}
    elif include_tabpfn:
        results["TabPFN"] = {"available": False, "reason": "tabpfn not installed"}

    scored = {k: v for k, v in results.items() if isinstance(v, dict) and "r2" in v}
    best = max(scored, key=lambda k: scored[k]["r2"]) if scored else None

    importances = {}
    if "RandomForest" in fitted:
        rf_model = fitted["RandomForest"].named_steps["m"]
        importances = dict(sorted(zip(feat_names, rf_model.feature_importances_),
                                  key=lambda kv: kv[1], reverse=True))

    return {
        "target": target, "features": feat_names, "n_rows": int(len(X)),
        "results": results, "best_model": best,
        "importances": {k: round(float(v), 4) for k, v in importances.items()},
        "_fitted": fitted, "_imputer": imp, "_feature_cols": list(X.columns),
        "_mean_target": float(y.mean()),
    }


def _metrics(y_true, y_pred):
    return {
        "available": True,
        "r2": round(float(r2_score(y_true, y_pred)), 4),
        "rmse": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 3),
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 3),
    }


# ---- prediction ------------------------------------------------------------
def _row_from_features(features: dict, feature_cols):
    row = {c: np.nan for c in feature_cols}
    for k, v in features.items():
        if k in row:
            row[k] = v
        else:  # one-hot: match "col_value"
            for c in feature_cols:
                if c == f"{k}_{v}":
                    row[c] = 1
    return pd.DataFrame([row])[feature_cols]


def predict_one(model_pack: dict, features: dict, model_name: str | None = None):
    name = model_name or model_pack["best_model"]
    fitted = model_pack["_fitted"][name]
    X = _row_from_features(features, model_pack["_feature_cols"])
    if isinstance(fitted, tuple) and fitted[0] == "tabpfn":
        _, tp, imp = fitted
        return float(np.asarray(tp.predict(imp.transform(X))).ravel()[0])
    if isinstance(fitted, tuple) and fitted[0] == "mlp":
        _, model, sc = fitted
        import torch
        with torch.no_grad():
            xi = SimpleImputer(strategy="median").fit(X.fillna(X.median())).transform(X)
            t = torch.tensor(sc.transform(np.nan_to_num(xi)), dtype=torch.float32)
            return float(model(t).numpy().ravel()[0])
    return float(fitted.predict(X)[0])


def cost_breakdown(base, owners_pct=0, sst_pct=0, cont_pct=0, esc_pct=0):
    owners = base * owners_pct / 100
    sst = base * sst_pct / 100
    sub = base + owners
    cont = sub * cont_pct / 100
    esc = sub * esc_pct / 100
    return {
        "base": round(base, 2), "owners": round(owners, 2), "sst": round(sst, 2),
        "contingency": round(cont, 2), "escalation": round(esc, 2),
        "grand_total": round(base + owners + sst + cont + esc, 2),
    }


# ---- explanation -----------------------------------------------------------
def explain_prediction(model_pack: dict, features: dict):
    if not SHAP_AVAILABLE or "RandomForest" not in model_pack["_fitted"]:
        return {"available": False, "reason": "shap not installed" if not SHAP_AVAILABLE else "no tree model"}
    rf = model_pack["_fitted"]["RandomForest"].named_steps["m"]
    imp = model_pack["_fitted"]["RandomForest"].named_steps["imp"]
    X = _row_from_features(features, model_pack["_feature_cols"])
    Xi = imp.transform(X)
    explainer = shap.TreeExplainer(rf)
    sv = explainer.shap_values(Xi)
    contribs = sorted(zip(model_pack["_feature_cols"], np.asarray(sv).ravel()),
                      key=lambda kv: abs(kv[1]), reverse=True)
    base_val = float(np.asarray(explainer.expected_value).ravel()[0])
    return {
        "available": True, "base_value": round(base_val, 3),
        "mean_target": round(model_pack["_mean_target"], 2),
        "contributions": [{"feature": f, "value": round(float(v), 3)} for f, v in contribs],
    }


# ---- monte carlo -----------------------------------------------------------
def monte_carlo(model_pack: dict, base_features: dict, n_sims=1000,
                uncertainty=0.10, budget=None, model_name=None):
    rng = np.random.default_rng(42)
    sims = []
    numeric = {k: v for k, v in base_features.items() if isinstance(v, (int, float))}
    for _ in range(int(n_sims)):
        s = dict(base_features)
        for k, v in numeric.items():
            s[k] = float(v) * (1 + rng.normal(0, uncertainty))
        try:
            sims.append(predict_one(model_pack, s, model_name))
        except Exception:
            pass
    arr = np.array(sims)
    out = {
        "n": len(arr),
        "p50": round(float(np.percentile(arr, 50)), 2),
        "p80": round(float(np.percentile(arr, 80)), 2),
        "p90": round(float(np.percentile(arr, 90)), 2),
        "min": round(float(arr.min()), 2), "max": round(float(arr.max()), 2),
        "hist": np.histogram(arr, bins=24)[0].tolist(),
        "hist_edges": [round(float(e), 2) for e in np.histogram(arr, bins=24)[1]],
    }
    if budget:
        out["p_over_budget"] = round(float((arr > budget).mean() * 100), 1)
    return out
