export const CREATE_ENUMS_SQL = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sprint_status') THEN
    CREATE TYPE sprint_status AS ENUM ('planning', 'active', 'completed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_category') THEN
    CREATE TYPE task_category AS ENUM ('product', 'integration', 'other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'resource_role') THEN
    CREATE TYPE resource_role AS ENUM ('developer', 'qa', 'devops', 'designer', 'pm');
  END IF;
END$$;
`;

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS resources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  team VARCHAR(100) NOT NULL,
  role resource_role NOT NULL DEFAULT 'developer',
  default_hours_per_sprint NUMERIC NOT NULL DEFAULT 80,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT resources_name_unique UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS sprints (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  start_date DATE,
  end_date DATE,
  status sprint_status NOT NULL DEFAULT 'planning',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sprint_allocations (
  id SERIAL PRIMARY KEY,
  sprint_id INTEGER NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  team VARCHAR(100) NOT NULL,
  story_points NUMERIC NOT NULL DEFAULT 0,
  standard_hours NUMERIC NOT NULL DEFAULT 0,
  leave_days NUMERIC NOT NULL DEFAULT 0,
  effective_hours NUMERIC NOT NULL DEFAULT 0,
  effective_hours_overridden BOOLEAN NOT NULL DEFAULT false,
  dependencies TEXT,
  remarks TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT sprint_allocations_unique UNIQUE (sprint_id, resource_id)
);

CREATE TABLE IF NOT EXISTS allocation_tasks (
  id SERIAL PRIMARY KEY,
  allocation_id INTEGER NOT NULL REFERENCES sprint_allocations(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  category task_category NOT NULL DEFAULT 'product',
  start_date DATE,
  estimated_days INTEGER,
  story_points NUMERIC NOT NULL DEFAULT 0,
  status task_status NOT NULL DEFAULT 'todo',
  jira_issue_key VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE allocation_tasks ADD COLUMN IF NOT EXISTS uat_date DATE;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS github_handle VARCHAR(100);
ALTER TABLE resources ADD COLUMN IF NOT EXISTS jira_account_id VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_resources_team ON resources(team);
CREATE INDEX IF NOT EXISTS idx_resources_active ON resources(is_active);
CREATE INDEX IF NOT EXISTS idx_allocations_sprint ON sprint_allocations(sprint_id);
CREATE INDEX IF NOT EXISTS idx_allocations_resource ON sprint_allocations(resource_id);
CREATE INDEX IF NOT EXISTS idx_allocations_team ON sprint_allocations(team);
CREATE INDEX IF NOT EXISTS idx_tasks_allocation ON allocation_tasks(allocation_id);
`;
