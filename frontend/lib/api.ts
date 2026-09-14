// Typed client for the CAPEX AI backend. All calls go through /api/* which
// next.config.js proxies to the FastAPI server on port 8000.

async function j<T>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.json();
}

export const api = {
  health: () => j<any>("/api/health"),

  listDatasets: () => j<any[]>("/api/datasets"),
  getDataset: (name: string) => j<any>(`/api/datasets/${encodeURIComponent(name)}`),
  deleteDataset: (name: string) =>
    j<any>(`/api/datasets/${encodeURIComponent(name)}`, { method: "DELETE" }),
  uploadDataset: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return j<any>("/api/datasets/upload", { method: "POST", body: fd });
  },

  train: (body: any) =>
    j<any>("/api/train", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  getModel: (dataset: string) => j<any>(`/api/train/${encodeURIComponent(dataset)}`),
  predict: (body: any) =>
    j<any>("/api/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  explain: (body: any) =>
    j<any>("/api/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  montecarlo: (body: any) =>
    j<any>("/api/montecarlo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),

  // preprocessing
  preDetect: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return j<any>("/api/preprocess/detect", { method: "POST", body: fd });
  },
  preRun: (file: File, facilityType: string, storeAs: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("facility_type", facilityType);
    if (storeAs) fd.append("store_as", storeAs);
    return j<any>("/api/preprocess/run", { method: "POST", body: fd });
  },

  // projects
  listProjects: () => j<any[]>("/api/projects"),
  createProject: (name: string) =>
    j<any>("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }),
  addComponent: (body: any) =>
    j<any>("/api/projects/component", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),

  chat: (body: any) =>
    j<any>("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
};
