// routes/admin.js — the business/owner side.
//
// Every route here sits behind auth + adminOnly (see server.js).
// This is the "owner dashboard with CRUD" the assignment asks for:
// categories are the core resource, plus user moderation and reports.

const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/admin/stats -----------------------------------------------------
router.get('/stats', async (req, res, next) => {
  try {
    const [[stats]] = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM users)                                   AS total_users,
         (SELECT COUNT(*) FROM users WHERE is_active = FALSE)           AS deactivated_users,
         (SELECT COUNT(*) FROM help_requests)                           AS total_requests,
         (SELECT COUNT(*) FROM help_requests WHERE status = 'open')     AS open_requests,
         (SELECT COUNT(*) FROM help_requests WHERE status = 'completed') AS completed_requests,
         (SELECT COUNT(*) FROM offers)                                  AS total_offers,
         (SELECT COUNT(*) FROM reports WHERE status = 'open')           AS open_reports,
         (SELECT COUNT(*) FROM categories WHERE is_active = TRUE)       AS active_categories`
    );

    // Convert every count to a number so the frontend never has to.
    const numeric = {};
    for (const [key, value] of Object.entries(stats)) numeric[key] = Number(value);

    res.json(numeric);
  } catch (err) {
    next(err);
  }
});

// --- Categories: full CRUD -------------------------------------------------

// GET /api/admin/categories
router.get('/categories', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM help_requests r WHERE r.category_id = c.id) AS request_count
       FROM categories c ORDER BY c.name`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/categories
router.post('/categories', async (req, res, next) => {
  const { name, description } = req.body;

  if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });
  if (name.length > 50) return res.status(400).json({ message: 'Name must be 50 characters or fewer' });

  try {
    const [existing] = await db.query('SELECT id FROM categories WHERE name = ?', [name.trim()]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'That category already exists' });
    }

    const [result] = await db.query(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [name.trim(), description || null]
    );

    const [rows] = await db.query('SELECT * FROM categories WHERE id = ?', [result.insertId]);
    res.status(201).json({ ...rows[0], request_count: 0 });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/categories/:id
router.put('/categories/:id', async (req, res, next) => {
  const { name, description, is_active } = req.body;

  if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });

  try {
    const [clash] = await db.query('SELECT id FROM categories WHERE name = ? AND id != ?', [
      name.trim(),
      req.params.id,
    ]);
    if (clash.length > 0) {
      return res.status(409).json({ message: 'Another category already has that name' });
    }

    const [result] = await db.query(
      'UPDATE categories SET name = ?, description = ?, is_active = ? WHERE id = ?',
      [name.trim(), description || null, is_active === undefined ? true : !!is_active, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const [rows] = await db.query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/categories/:id
router.delete('/categories/:id', async (req, res, next) => {
  try {
    // A category in use can't be deleted — that would orphan requests.
    // Deactivating is the right move instead, and we say so.
    const [[used]] = await db.query(
      'SELECT COUNT(*) AS n FROM help_requests WHERE category_id = ?',
      [req.params.id]
    );

    if (Number(used.n) > 0) {
      return res.status(409).json({
        message: `This category is used by ${used.n} request(s). Deactivate it instead of deleting.`,
      });
    }

    const [result] = await db.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
});

// --- Users: list and moderate ----------------------------------------------

// GET /api/admin/users
router.get('/users', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.city, u.is_active, u.created_at,
              (SELECT COUNT(*) FROM help_requests r WHERE r.user_id = u.id) AS request_count,
              (SELECT COUNT(*) FROM reports rp WHERE rp.reported_user_id = u.id AND rp.status = 'open') AS open_reports
       FROM users u ORDER BY u.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/users/:id — activate / deactivate
router.put('/users/:id', async (req, res, next) => {
  const { is_active } = req.body;

  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ message: 'is_active must be true or false' });
  }

  // Guard: an admin locking themselves out would be unrecoverable.
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ message: 'You cannot deactivate your own account' });
  }

  try {
    const [result] = await db.query('UPDATE users SET is_active = ? WHERE id = ?', [
      is_active,
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: is_active ? 'User activated' : 'User deactivated' });
  } catch (err) {
    next(err);
  }
});

// --- Reports ---------------------------------------------------------------

// GET /api/admin/reports
router.get('/reports', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT rp.*, reporter.name AS reporter_name, reported.name AS reported_user_name
       FROM reports rp
       JOIN users reporter ON reporter.id = rp.reporter_id
       JOIN users reported ON reported.id = rp.reported_user_id
       ORDER BY FIELD(rp.status, 'open', 'resolved', 'dismissed'), rp.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/reports/:id — resolve or dismiss
router.put('/reports/:id', async (req, res, next) => {
  const { status } = req.body;

  if (!['open', 'resolved', 'dismissed'].includes(status)) {
    return res.status(400).json({ message: 'Status must be open, resolved or dismissed' });
  }

  try {
    const [result] = await db.query('UPDATE reports SET status = ? WHERE id = ?', [
      status,
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Report not found' });
    }

    res.json({ message: 'Report updated' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
