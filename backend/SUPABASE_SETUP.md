# Supabase (optional continual learning)

Set two environment variables before starting the backend:
    SUPABASE_URL=your-project-url
    SUPABASE_KEY=your-service-role-key

Install the client:
    py -m pip install supabase

Create three tables:

    create table datasets (
      id bigint generated always as identity primary key,
      schema_key text, source text, features jsonb, target double precision,
      created_at timestamptz default now()
    );
    create table predictions (
      id bigint generated always as identity primary key,
      dataset text, features jsonb, predicted_capex double precision,
      created_at timestamptz default now()
    );
    create table model_registry (
      id bigint generated always as identity primary key,
      schema_key text, algorithm text, r2 double precision, rows int,
      active boolean default true, created_at timestamptz default now()
    );

The backend uses the service-role key and bypasses row level security, so RLS can be
left off for a local project. Free tier pauses after 7 days of inactivity; open the
project before a demo to wake it.
