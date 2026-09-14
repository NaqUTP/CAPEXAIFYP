"""
main.py  -  CAPEX AI RT2026 FastAPI backend
Run:  py -m uvicorn main:app --reload --port 8000
"""
from __future__ import annotations
import io
import pandas as pd
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import ml_pipeline as ml
from preprocess_pipeline import SCHEMAS, detect_facility_type, preprocess

try:
    import supabase_store as sb
except Exception:
    sb = None

app = FastAPI(title="CAPEX AI RT2026")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"], allow_headers=["*"],
)

# in-memory state; mirrored by supabase_store when configured
STORE = {"datasets": {}, "models": {}, "projects": {}}


# ---- models for request bodies --------------------------------------------
class TrainReq(BaseModel):
    dataset: str
    test_size: float = 0.2
    include_mlp: bool = True
    include_tabpfn: bool = True

class PredictReq(BaseModel):
    dataset: str
    features: dict
    model: str | None = None
    owners_pct: float = 0
    sst_pct: float = 0
    cont_pct: float = 0
    esc_pct: float = 0

class ExplainReq(BaseModel):
    dataset: str
    features: dict

class MonteReq(BaseModel):
    dataset: str
    features: dict
    n_sims: int = 1000
    uncertainty: float = 0.10
    budget: float | None = None

class ChatReq(BaseModel):
    messages: list
    backend: str = "ollama"
    use_context: bool = True

class ProjectReq(BaseModel):
    name: str

class ComponentReq(BaseModel):
    project: str
    dataset: str
    component_type: str
    features: dict


# ---- health ----------------------------------------------------------------
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "torch": ml.TORCH_AVAILABLE,
        "tabpfn": ml.TABPFN_AVAILABLE,
        "shap": ml.SHAP_AVAILABLE,
        "supabase": bool(sb and sb.is_configured()) if sb else False,
        "datasets": len(STORE["datasets"]),
        "models": len(STORE["models"]),
    }


# ---- datasets --------------------------------------------------------------
@app.post("/api/datasets/upload")
async def upload(file: UploadFile = File(...)):
    try:
        df = pd.read_csv(io.BytesIO(await file.read()))
    except Exception as e:
        raise HTTPException(400, f"Could not read CSV: {e}")
    df = ml.clean_dataframe(df)
    STORE["datasets"][file.filename] = df
    synced = 0
    if sb and sb.is_configured():
        synced = sb.append_dataset(file.filename, df)
    return {"name": file.filename, "rows": len(df), "columns": list(df.columns), "synced": synced}

@app.get("/api/datasets")
def list_datasets():
    return [{"name": n, "rows": len(d), "columns": list(d.columns)} for n, d in STORE["datasets"].items()]

@app.get("/api/datasets/{name}")
def get_dataset(name: str):
    if name not in STORE["datasets"]:
        raise HTTPException(404, "Dataset not found")
    d = STORE["datasets"][name]
    return {"name": name, "columns": list(d.columns), "target": d.columns[-1],
            "preview": d.head(10).fillna("").astype(str).to_dict(orient="records")}

@app.delete("/api/datasets/{name}")
def delete_dataset(name: str):
    STORE["datasets"].pop(name, None)
    STORE["models"].pop(name, None)
    return {"deleted": name}


# ---- preprocessing ---------------------------------------------------------
@app.get("/api/preprocess/schemas")
def schemas():
    return {t: {"cost_drivers": list(s["features"].keys()), "target": "CAPEX_MMUSD"}
            for t, s in SCHEMAS.items()}

@app.post("/api/preprocess/detect")
async def pre_detect(file: UploadFile = File(...)):
    df = pd.read_csv(io.BytesIO(await file.read()))
    return {"filename": file.filename, "rows": len(df), "columns": list(df.columns),
            "preview": df.head(5).fillna("").astype(str).to_dict(orient="records"),
            "detection": detect_facility_type(df)}

@app.post("/api/preprocess/run")
async def pre_run(file: UploadFile = File(...), facility_type: str = Form(...), store_as: str = Form("")):
    df = pd.read_csv(io.BytesIO(await file.read()))
    if facility_type not in SCHEMAS:
        raise HTTPException(400, f"Unknown facility type '{facility_type}'")
    clean, report = preprocess(df, facility_type)
    stored = False
    if store_as:
        STORE["datasets"][store_as] = clean
        stored = True
    return {"report": report, "stored": stored, "stored_as": store_as or None,
            "clean_preview": clean.head(10).fillna("").astype(str).to_dict(orient="records"),
            "clean_columns": list(clean.columns), "clean_csv": clean.to_csv(index=False)}


# ---- training + prediction -------------------------------------------------
@app.post("/api/train")
def train(req: TrainReq):
    if req.dataset not in STORE["datasets"]:
        raise HTTPException(404, "Dataset not found")
    pack = ml.train_models(STORE["datasets"][req.dataset], req.test_size,
                           req.include_mlp, req.include_tabpfn)
    STORE["models"][req.dataset] = pack
    return _public_pack(pack)

@app.get("/api/train/{dataset}")
def get_model(dataset: str):
    if dataset not in STORE["models"]:
        raise HTTPException(404, "No trained model for this dataset")
    return _public_pack(STORE["models"][dataset])

@app.post("/api/predict")
def predict(req: PredictReq):
    if req.dataset not in STORE["models"]:
        raise HTTPException(404, "Train a model first")
    pack = STORE["models"][req.dataset]
    base = ml.predict_one(pack, req.features, req.model)
    breakdown = ml.cost_breakdown(base, req.owners_pct, req.sst_pct, req.cont_pct, req.esc_pct)
    if sb and sb.is_configured():
        sb.log_prediction(req.dataset, req.features, base)
    return {"model": req.model or pack["best_model"], "breakdown": breakdown}

@app.post("/api/explain")
def explain(req: ExplainReq):
    if req.dataset not in STORE["models"]:
        raise HTTPException(404, "Train a model first")
    return ml.explain_prediction(STORE["models"][req.dataset], req.features)

@app.post("/api/montecarlo")
def montecarlo(req: MonteReq):
    if req.dataset not in STORE["models"]:
        raise HTTPException(404, "Train a model first")
    return ml.monte_carlo(STORE["models"][req.dataset], req.features,
                          req.n_sims, req.uncertainty, req.budget)


# ---- projects --------------------------------------------------------------
@app.get("/api/projects")
def list_projects():
    return [{"name": n, **p} for n, p in STORE["projects"].items()]

@app.post("/api/projects")
def create_project(req: ProjectReq):
    STORE["projects"][req.name] = {"components": [], "total": 0.0}
    return {"name": req.name}

@app.post("/api/projects/component")
def add_component(req: ComponentReq):
    if req.project not in STORE["projects"]:
        raise HTTPException(404, "Project not found")
    if req.dataset not in STORE["models"]:
        raise HTTPException(404, "Train a model for the component dataset first")
    base = ml.predict_one(STORE["models"][req.dataset], req.features)
    comp = {"type": req.component_type, "dataset": req.dataset, "capex": round(base, 2)}
    proj = STORE["projects"][req.project]
    proj["components"].append(comp)
    proj["total"] = round(sum(c["capex"] for c in proj["components"]), 2)
    return {"project": req.project, **proj}


# ---- advisor ---------------------------------------------------------------
@app.post("/api/chat")
def chat(req: ChatReq):
    context = _build_context() if req.use_context else ""
    system = ("You are a senior oil and gas cost engineer. Be concise and grounded "
              "in the provided context.\n" + context)
    # Try Ollama locally; fall back to a helpful message.
    try:
        import requests
        payload = {"model": "llama3", "stream": False,
                   "messages": [{"role": "system", "content": system}] + req.messages}
        r = requests.post("http://localhost:11434/api/chat", json=payload, timeout=60)
        return {"reply": r.json()["message"]["content"], "backend": "ollama"}
    except Exception:
        return {"reply": "The local advisor (Ollama) is not reachable. Start it with "
                         "`ollama serve` and `ollama pull llama3`, or switch the backend.",
                "backend": "unavailable"}


# ---- helpers ---------------------------------------------------------------
def _public_pack(pack):
    return {k: pack[k] for k in ("target", "features", "n_rows", "results",
                                 "best_model", "importances")}

def _build_context():
    lines = []
    for name, d in STORE["datasets"].items():
        lines.append(f"Dataset {name}: {len(d)} rows, columns {list(d.columns)}.")
    for name, pack in STORE["models"].items():
        top = list(pack["importances"].items())[:3]
        lines.append(f"Model for {name}: best {pack['best_model']}, top drivers {top}.")
    return "\n".join(lines) if lines else "No datasets loaded yet."
