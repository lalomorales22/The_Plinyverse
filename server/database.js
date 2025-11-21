import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const verboseSqlite = sqlite3.verbose();
const dbPath = path.resolve(__dirname, 'plinyverse.db');

const db = new verboseSqlite.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initDb();
  }
});

function initDb() {
  // Files table with cluster support
  db.run(`CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    parentId TEXT,
    name TEXT,
    type TEXT,
    content TEXT,
    createdAt INTEGER,
    clusterId TEXT DEFAULT 'root',
    FOREIGN KEY (clusterId) REFERENCES clusters(id) ON DELETE CASCADE
  )`, (err) => {
    if (err) {
      console.error('Error creating files table:', err.message);
    } else {
      // PERFORMANCE FIX: Add indexes for frequently queried columns
      db.run('CREATE INDEX IF NOT EXISTS idx_files_parentId ON files(parentId)');
      db.run('CREATE INDEX IF NOT EXISTS idx_files_clusterId ON files(clusterId)');
    }
  });

  // Clusters table for multi-cluster support
  db.run(`CREATE TABLE IF NOT EXISTS clusters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    positionX REAL DEFAULT 0,
    positionY REAL DEFAULT 0,
    positionZ REAL DEFAULT 0,
    color TEXT DEFAULT '#00ff9d',
    createdAt INTEGER
  )`, (err) => {
    if (err) {
      console.error('Error creating clusters table:', err.message);
    } else {
      // Create default 'root' cluster if it doesn't exist
      db.run(`INSERT OR IGNORE INTO clusters (id, name, positionX, positionY, positionZ, color, createdAt)
              VALUES ('root', 'ROOT CLUSTER', 0, 0, 0, '#00ff9d', ?)`, [Date.now()]);
    }
  });
}

export default db;
