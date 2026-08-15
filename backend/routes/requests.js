// routes/requests.js — help requests (the app's core resource) + matching.

const express = require('express');
const db = require('../db');
const { findMatches } = require('../utils/matching');
const { streetOnly, blurCoordinates } = require('../utils/geo');

const router = express.Router();

// Shared validation for POST and PUT.
function validateRequest(body) {
  const { title, description, category_id, urgency } = body;

  if (!title || !title.trim()) return 'Title is required';
  if (title.length > 120) return 'Title must be 120 characters or fewer';
  if (!description || !description.trim()) return 'Please describe what you need help with';
  if (description.length > 2000) return 'Description is too long';
  if (!category_id) return 'Please choose a category';
  if (urgency && !['low', 'normal', 'high'].includes(urgency)) return 'Invalid urgency';

  return null;
}

// GET /api/requests — browse all open requests (the community feed) --------
// Query params: ?category_id=2&urgency=high&mine=true
router.get('/', async (req, res, next) => {
  const { category_id, urgency, mine, status } = req.query;

  let sql = `
    SELECT r.*, c.name AS category_name, u.name AS user_name,
           (SELECT COUNT(*) FROM offers o WHERE o.request_id = r.id) AS offer_count
    FROM help_requests r
    JOIN categories c ON c.id = r.category_id
    JOIN users u      ON u.id = r.user_id
    WHERE 1 = 1`;
  const params = [];

  if (mine === 'true') {
    sql += ' AND r.user_id = ?';
    params.push(req.user.id);
  } else {
    // The public feed only shows open requests from active users.
    sql += " AND r.status = 'open' AND u.is_active = TRUE";
  }

  if (status) {
    sql += ' AND r.status = ?';
    params.push(status);
  }
  if (category_id) {
    sql += ' AND r.category_id = ?';
    params.push(category_id);
  }
  if (urgency) {
    sql += ' AND r.urgency = ?';
    params.push(urgency);
  }

  sql += ' ORDER BY FIELD(r.urgency, "high", "normal", "low"), r.created_at DESC';

  try {
    const [rows] = await db.query(sql, params);

    // Privacy: only the owner sees the full street of their own request.
    const cleaned = rows.map((r) => ({
      ...r,
      street: r.user_id === req.user.id ? r.street : streetOnly(r.street),
      ...(r.user_id === req.user.id
        ? {}
        : blurCoordinates(r.latitude, r.longitude, r.id)),
    }));

    res.json(cleaned);
  } catch (err) {
    next(err);
  }
});

// GET /api/requests/stats — dashboard numbers ------------------------------
// Declared before '/:id' so "stats" is not read as an id.
router.get('/stats', async (req, res, next) => {
  try {
    const [[mine]] = await db.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'open')      AS open_count,
         SUM(status = 'completed') AS completed_count
       FROM help_requests WHERE user_id = ?`,
      [req.user.id]
    );

    const [[helping]] = await db.query(
      `SELECT COUNT(*) AS accepted_offers
       FROM offers WHERE helper_id = ? AND status = 'accepted'`,
      [req.user.id]
    );

    const [[community]] = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE is_active = TRUE) AS active_users,
         (SELECT COUNT(*) FROM help_requests WHERE status = 'open') AS open_requests,
         (SELECT COUNT(*) FROM help_requests WHERE status = 'completed') AS completed_requests`
    );

    res.json({
      my_requests: Number(mine.total) || 0,
      my_open: Number(mine.open_count) || 0,
      my_completed: Number(mine.completed_count) || 0,
      helping_with: Number(helping.accepted_offers) || 0,
      active_users: Number(community.active_users) || 0,
      open_requests: Number(community.open_requests) || 0,
      completed_requests: Number(community.completed_requests) || 0,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/requests/:id ----------------------------------------------------
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, c.name AS category_name, u.name AS user_name
       FROM help_requests r
       JOIN categories c ON c.id = r.category_id
       JOIN users u      ON u.id = r.user_id
       WHERE r.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const r = rows[0];
    const isOwner = r.user_id === req.user.id;

    res.json({
      ...r,
      street: isOwner ? r.street : streetOnly(r.street),
      ...(isOwner ? {} : blurCoordinates(r.latitude, r.longitude, r.id)),
      is_owner: isOwner,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/requests/:id/matches — ranked helpers ---------------------------
router.get('/:id/matches', async (req, res, next) => {
  try {
    const [reqRows] = await db.query(
      `SELECT r.*, c.name AS category_name
       FROM help_requests r
       JOIN categories c ON c.id = r.category_id
       WHERE r.id = ? AND r.user_id = ?`,
      [req.params.id, req.user.id]
    );

    if (reqRows.length === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }
    const request = reqRows[0];

    // Candidates = every other active user, with the aggregates the
    // scoring function needs.
    const [candidates] = await db.query(
      `SELECT u.id, u.name, u.street, u.bio, u.latitude, u.longitude,
              (SELECT AVG(rating)  FROM reviews rv WHERE rv.reviewee_id = u.id) AS avg_rating,
              (SELECT COUNT(*)     FROM reviews rv WHERE rv.reviewee_id = u.id) AS review_count,
              (SELECT COUNT(*) FROM offers o
                 JOIN help_requests hr ON hr.id = o.request_id
                 WHERE o.helper_id = u.id AND o.status = 'accepted'
                   AND hr.status IN ('open', 'matched')) AS open_commitments,
              (SELECT GROUP_CONCAT(us.category_id)
                 FROM user_skills us WHERE us.user_id = u.id) AS skills
       FROM users u
       WHERE u.id != ? AND u.is_active = TRUE`,
      [req.user.id]
    );

    // GROUP_CONCAT gives "1,4,7" — turn it into [1, 4, 7].
    const prepared = candidates.map((c) => ({
      ...c,
      review_count: Number(c.review_count),
      skill_ids: c.skills ? c.skills.split(',').map(Number) : [],
    }));

    const matches = findMatches(request, prepared, 5).map((m) => ({
      ...m,
      street: streetOnly(m.street), // never expose house numbers
    }));

    res.json({ request_id: request.id, category: request.category_name, matches });
  } catch (err) {
    next(err);
  }
});

// POST /api/requests — create ----------------------------------------------
router.post('/', async (req, res, next) => {
  const error = validateRequest(req.body);
  if (error) return res.status(400).json({ message: error });

  const { title, description, category_id, urgency, street, needed_by } = req.body;

  try {
    // Verify the category exists and is active.
    const [cat] = await db.query(
      'SELECT id, name FROM categories WHERE id = ? AND is_active = TRUE',
      [category_id]
    );
    if (cat.length === 0) {
      return res.status(400).json({ message: 'That category does not exist' });
    }

    // Default the request location to the user's own coordinates.
    const [[me]] = await db.query(
      'SELECT street, latitude, longitude FROM users WHERE id = ?',
      [req.user.id]
    );

    const [result] = await db.query(
      `INSERT INTO help_requests
         (user_id, category_id, title, description, urgency, street, latitude, longitude, needed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        category_id,
        title.trim(),
        description.trim(),
        urgency || 'normal',
        street || me.street,
        me.latitude,
        me.longitude,
        needed_by || null,
      ]
    );

    const [rows] = await db.query(
      `SELECT r.*, c.name AS category_name FROM help_requests r
       JOIN categories c ON c.id = r.category_id WHERE r.id = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/requests/:id — update -------------------------------------------
router.put('/:id', async (req, res, next) => {
  const error = validateRequest(req.body);
  if (error) return res.status(400).json({ message: error });

  const { title, description, category_id, urgency, street, needed_by, status } = req.body;

  try {
    const [result] = await db.query(
      `UPDATE help_requests
       SET title = ?, description = ?, category_id = ?, urgency = ?,
           street = ?, needed_by = ?, status = COALESCE(?, status)
       WHERE id = ? AND user_id = ?`,
      [
        title.trim(),
        description.trim(),
        category_id,
        urgency || 'normal',
        street || null,
        needed_by || null,
        status || null,
        req.params.id,
        req.user.id,
      ]
    );

    // 0 rows = wrong id, or it belongs to someone else. Same 404 either way.
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const [rows] = await db.query(
      `SELECT r.*, c.name AS category_name FROM help_requests r
       JOIN categories c ON c.id = r.category_id WHERE r.id = ?`,
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/requests/:id -------------------------------------------------
router.delete('/:id', async (req, res, next) => {
  try {
    const [result] = await db.query(
      'DELETE FROM help_requests WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }

    res.json({ message: 'Request deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
