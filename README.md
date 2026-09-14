# CAPEX AI RT2026

Machine learning application for upstream oil and gas capital expenditure estimation.
Two tiers: a Next.js front end and a FastAPI back end that hosts the ML pipeline.

## Design
Industrial, instrument-panel aesthetic. IBM Plex Sans + IBM Plex Mono, a steel-and-paper
palette with a single safety-signal accent, flat square panels and data tables. No gradients,
glassmorphism, or decorative motion. See DESIGN_NOTES in the frontend.

## Run

Backend (terminal 1):
    cd backend
    py -m pip install -r requirements.txt
    py -m uvicorn main:app --reload --port 8000

Frontend (terminal 2):
    cd frontend
    npm install
    npm run dev
    # open http://localhost:3000

Optional:
- MLP model:       py -m pip install torch
- TabPFN model:    py -m pip install tabpfn
- SHAP explain:    py -m pip install shap
- Continual learning: set SUPABASE_URL / SUPABASE_KEY (see backend/SUPABASE_SETUP.md)
- AI advisor:      run Ollama locally (ollama serve; ollama pull llama3)

Every optional capability degrades gracefully. The core (upload, ensemble training,
prediction, cost breakdown, Monte Carlo, preprocessing) runs on the base requirements alone.

## Layout
    backend/   FastAPI app, ML pipeline, preprocessing, optional Supabase
    frontend/  Next.js 14 app: shell + six tabs (Data & Models, Preprocessing,
               Project Builder, Monte Carlo, Compare, Cost Advisor)
