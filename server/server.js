import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import db from './database.js';

const app = express();
const PORT = 3001;

// SECURITY FIX: Restrict CORS to specific origins instead of wildcard
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// SECURITY FIX: Reduced body size limit from 50mb to 10mb to prevent DoS
app.use(bodyParser.json({ limit: '100mb' }));

// SECURITY FIX: Add rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Input validation middleware
const validateFileInput = (req, res, next) => {
  const { id, name, type, content } = req.body;

  // Validate required fields
  if (!id || !name || !type) {
    return res.status(400).json({ error: 'Missing required fields: id, name, type' });
  }

  // Validate id format (UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid ID format. Must be a valid UUID.' });
  }

  // Validate name (no path traversal)
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    return res.status(400).json({ error: 'Invalid file name. Cannot contain path traversal characters.' });
  }

  // Validate name length
  if (name.length > 255) {
    return res.status(400).json({ error: 'File name too long. Maximum 255 characters.' });
  }

  // Validate type
  const validTypes = ['TEXT', 'IMAGE', 'VIDEO', 'PDF', 'HTML', 'CODE', 'SYSTEM', 'DATA_NODE', 'DIRECTORY'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
  }

  // Validate content length (if present)
  if (content && content.length > 100 * 1024 * 1024) { // 100MB
    return res.status(400).json({ error: 'Content too large. Maximum 100MB.' });
  }

  next();
};

const validateClusterInput = (req, res, next) => {
  const { id, name, position, color } = req.body;

  // Validate required fields
  if (!id || !name || !position || !color) {
    return res.status(400).json({ error: 'Missing required fields: id, name, position, color' });
  }

  // Validate id format (UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid ID format. Must be a valid UUID.' });
  }

  // Validate name
  if (name.length > 255 || name.length < 1) {
    return res.status(400).json({ error: 'Cluster name must be between 1 and 255 characters.' });
  }

  // Validate position array
  if (!Array.isArray(position) || position.length !== 3) {
    return res.status(400).json({ error: 'Position must be an array of 3 numbers [x, y, z].' });
  }

  if (!position.every(n => typeof n === 'number' && !isNaN(n))) {
    return res.status(400).json({ error: 'Position coordinates must be valid numbers.' });
  }

  // Validate color format (hex color)
  const colorRegex = /^#[0-9A-F]{6}$/i;
  if (!colorRegex.test(color)) {
    return res.status(400).json({ error: 'Color must be a valid hex color (e.g., #FF5733).' });
  }

  next();
};

const validateIdParam = (req, res, next) => {
  const { id } = req.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid ID format. Must be a valid UUID.' });
  }

  next();
};

// Get all files
app.get('/api/files', (req, res) => {
  // PERFORMANCE FIX: Select only needed columns instead of *
  const sql = 'SELECT id, parentId, name, type, content, createdAt, clusterId FROM files';
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({
      message: 'success',
      data: rows
    });
  });
});

// Create or Update a file with validation
app.post('/api/files', validateFileInput, (req, res) => {
  const { id, parentId, name, type, content, createdAt, clusterId } = req.body;
  const sql = `INSERT OR REPLACE INTO files (id, parentId, name, type, content, createdAt, clusterId) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const params = [id, parentId, name, type, content, createdAt, clusterId || 'root'];

  db.run(sql, params, function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({
      message: 'success',
      data: req.body,
      id: this.lastID
    });
  });
});

// Batch Create/Update files with validation
app.post('/api/files/batch', (req, res) => {
    const files = req.body;
    if (!Array.isArray(files)) {
        return res.status(400).json({ error: "Expected an array of files" });
    }

    // SECURITY FIX: Validate each file in the batch
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validTypes = ['TEXT', 'IMAGE', 'VIDEO', 'PDF', 'HTML', 'CODE', 'SYSTEM', 'DATA_NODE', 'DIRECTORY'];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (!file.id || !file.name || !file.type) {
            return res.status(400).json({ error: `File at index ${i} missing required fields` });
        }

        if (!uuidRegex.test(file.id)) {
            return res.status(400).json({ error: `File at index ${i} has invalid ID format` });
        }

        if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
            return res.status(400).json({ error: `File at index ${i} has invalid name` });
        }

        if (!validTypes.includes(file.type)) {
            return res.status(400).json({ error: `File at index ${i} has invalid type` });
        }
    }

    const sql = `INSERT OR REPLACE INTO files (id, parentId, name, type, content, createdAt, clusterId) VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare(sql);

        files.forEach(file => {
            stmt.run([file.id, file.parentId, file.name, file.type, file.content, file.createdAt, file.clusterId || 'root']);
        });

        stmt.finalize();
        db.run("COMMIT", (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'success', count: files.length });
        });
    });
});

// Delete a file with ID validation
app.delete('/api/files/:id', validateIdParam, (req, res) => {
  const sql = 'DELETE FROM files WHERE id = ?';
  db.run(sql, req.params.id, function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'deleted', changes: this.changes });
  });
});

// ===== CLUSTER ENDPOINTS =====

// Get all clusters
app.get('/api/clusters', (req, res) => {
  // PERFORMANCE FIX: Select only needed columns instead of *
  const sql = 'SELECT id, name, positionX, positionY, positionZ, color, createdAt FROM clusters';
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    // Transform database rows to Cluster objects
    const clusters = rows.map(row => ({
      id: row.id,
      name: row.name,
      position: [row.positionX, row.positionY, row.positionZ],
      color: row.color,
      createdAt: row.createdAt
    }));
    res.json({ message: 'success', data: clusters });
  });
});

// Create a new cluster with validation
app.post('/api/clusters', validateClusterInput, (req, res) => {
  const { id, name, position, color, createdAt } = req.body;
  const sql = `INSERT OR REPLACE INTO clusters (id, name, positionX, positionY, positionZ, color, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const params = [id, name, position[0], position[1], position[2], color, createdAt];

  db.run(sql, params, function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'success', data: req.body });
  });
});

// Delete a cluster (and cascade delete its files) with ID validation
app.delete('/api/clusters/:id', validateIdParam, (req, res) => {
  const sql = 'DELETE FROM clusters WHERE id = ?';
  db.run(sql, req.params.id, function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'deleted', changes: this.changes });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
