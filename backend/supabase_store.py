"""
supabase_store.py  -  optional continual-learning persistence.
No-ops cleanly when SUPABASE_URL / SUPABASE_KEY are not set or the client
library is not installed. See SUPABASE_SETUP.md for the table schema.
"""
from __future__ import annotations
import os, hashlib, json
import pandas as pd

_URL = os.environ.get("SUPABASE_URL", "")
_KEY = os.environ.get("SUPABASE_KEY", "")

try:
    from supabase import create_client
    _client = create_client(_URL, _KEY) if _URL and _KEY else None
except Exception:
    _client = None


def is_configured() -> bool:
    return _client is not None


def schema_key(columns) -> str:
    return hashlib.md5("|".join(sorted(map(str, columns))).encode()).hexdigest()[:12]


def append_dataset(name: str, df: pd.DataFrame) -> int:
    if not is_configured():
        return 0
    key = schema_key(df.columns)
    target = df.columns[-1]
    rows = [{
        "schema_key": key, "source": name,
        "features": json.dumps({c: (None if pd.isna(v) else v)
                                for c, v in r.items() if c != target}),
        "target": None if pd.isna(r[target]) else float(r[target]),
    } for _, r in df.iterrows()]
    _client.table("datasets").insert(rows).execute()
    return len(rows)


def log_prediction(dataset: str, features: dict, predicted: float):
    if not is_configured():
        return
    _client.table("predictions").insert({
        "dataset": dataset, "features": json.dumps(features),
        "predicted_capex": float(predicted),
    }).execute()


def status(schema: str):
    if not is_configured():
        return {"configured": False}
    ds = _client.table("datasets").select("id", count="exact").eq("schema_key", schema).execute()
    return {"configured": True, "rows": ds.count}
