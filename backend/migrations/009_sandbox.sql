-- Add sandbox fields to jobs table for StackBlitz integration
-- The sandbox provides a VS Code-like IDE experience for agents to work in

ALTER TABLE jobs ADD COLUMN sandbox_url TEXT;
ALTER TABLE jobs ADD COLUMN sandbox_project_id TEXT;
