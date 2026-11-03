CREATE TABLE households (id TEXT PRIMARY KEY, owner TEXT NOT NULL UNIQUE, state TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);
CREATE TABLE members (household TEXT NOT NULL, user TEXT NOT NULL, role TEXT NOT NULL, access TEXT NOT NULL, email TEXT NOT NULL, PRIMARY KEY(household,user));
CREATE TABLE credentials (owner TEXT PRIMARY KEY, ciphertext TEXT NOT NULL, iv TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE model_runs (id TEXT PRIMARY KEY, household TEXT NOT NULL, started_at TEXT NOT NULL);
