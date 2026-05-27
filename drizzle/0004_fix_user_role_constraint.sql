-- Migration: Fix 'role' check constraint to allow 'god' role
-- Step 1: Create temporary table with the expanded constraint
CREATE TABLE users_migration (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT CHECK(role IN ('admin', 'employee', 'god')) NOT NULL,
  password_hash TEXT,
  avatar_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active'
);

-- Step 2: Copy data from the old table
INSERT INTO users_migration (id, email, name, role, password_hash, avatar_url, created_at, updated_at, phone, status)
SELECT id, email, name, role, password_hash, avatar_url, created_at, updated_at, phone, status FROM users;

-- Step 3: Remove the old table and rename the new one
DROP TABLE users;
ALTER TABLE users_migration RENAME TO users;
