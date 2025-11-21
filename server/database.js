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
  db.run(`CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    parentId TEXT,
    name TEXT,
    type TEXT,
    content TEXT,
    createdAt INTEGER
  )`, (err) => {
    if (err) {
      console.error('Error creating table:', err.message);
    }
  });
}

export default db;
