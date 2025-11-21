import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import db from './database.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Increased limit for large file uploads

// Get all files
app.get('/api/files', (req, res) => {
  const sql = 'SELECT * FROM files';
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({
      message: 'success',
      data: rows
    });
  });
});

// Create or Update a file
app.post('/api/files', (req, res) => {
  const { id, parentId, name, type, content, createdAt } = req.body;
  const sql = `INSERT OR REPLACE INTO files (id, parentId, name, type, content, createdAt) VALUES (?, ?, ?, ?, ?, ?)`;
  const params = [id, parentId, name, type, content, createdAt];
  
  db.run(sql, params, function (err) {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({
      message: 'success',
      data: req.body,
      id: this.lastID
    });
  });
});

// Batch Create/Update files
app.post('/api/files/batch', (req, res) => {
    const files = req.body;
    if (!Array.isArray(files)) {
        return res.status(400).json({ error: "Expected an array of files" });
    }

    const sql = `INSERT OR REPLACE INTO files (id, parentId, name, type, content, createdAt) VALUES (?, ?, ?, ?, ?, ?)`;
    
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare(sql);
        
        files.forEach(file => {
            stmt.run([file.id, file.parentId, file.name, file.type, file.content, file.createdAt]);
        });
        
        stmt.finalize();
        db.run("COMMIT", (err) => {
            if (err) {
                res.status(400).json({ error: err.message });
                return;
            }
            res.json({ message: 'success', count: files.length });
        });
    });
});

// Delete a file
app.delete('/api/files/:id', (req, res) => {
  const sql = 'DELETE FROM files WHERE id = ?';
  db.run(sql, req.params.id, function (err) {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ message: 'deleted', changes: this.changes });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
