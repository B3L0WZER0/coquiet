-- One row per vote. `voter` is a salted hash, never an address.
CREATE TABLE IF NOT EXISTS votes (
  slug TEXT NOT NULL,
  voter TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (slug, voter)
) WITHOUT ROWID;
