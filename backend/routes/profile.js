// routes/profile.js — the logged-in user's own account and skills.

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

// GET /api/profile ---------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    // Never select the password column.
    const [rows] = await db.query(
      `SELECT id, name, email, role, street, city, latitude, longitude, bio, created_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });

    const [skills] = await db.query(
      `SELECT c.id, c.name FROM user_skills us
       JOIN categories c ON c.id = us.category_id
       WHERE us.user_id = ? ORDER BY c.name`,
      [req.user.id]
    );

    const [[counts]] = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM help_requests WHERE user_id = ?) AS requests_posted,
         (SELECT COUNT(*) FROM offers WHERE helper_id = ? AND status = 'accepted') AS helps_given,
         (SELECT AVG(rating) FROM reviews WHERE reviewee_id = ?) AS avg_rating,
         (SELECT COUNT(*)    FROM reviews WHERE reviewee_id = ?) AS review_count`,
      [req.user.id, req.user.id, req.user.id, req.user.id]
    );

    res.json({
      ...rows[0],
      skills,
      stats: {
        requests_posted: Number(counts.requests_posted),
        helps_given: Number(counts.helps_given),
        // null (not 0) when there are no reviews — the UI shows "No reviews yet"
        // rather than a misleading 0.0.
        avg_rating: counts.avg_rating === null ? null : Number(Number(counts.avg_rating).toFixed(1)),
        review_count: Number(counts.review_count),
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/profile — update details and skills -----------------------------
router.put('/', async (req, res, next) => {
  const { name, email, street, bio, skill_ids } = req.body;

  if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });
  if (!email) return res.status(400).json({ message: 'Email is required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address' });
  }
  if (bio && bio.length > 255) {
    return res.status(400).json({ message: 'Bio must be 255 characters or fewer' });
  }
  if (skill_ids && !Array.isArray(skill_ids)) {
    return res.status(400).json({ message: 'skill_ids must be an array' });
  }

  try {
    const [taken] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [
      email,
      req.user.id,
    ]);
    if (taken.length > 0) {
      return res.status(409).json({ message: 'That email is already taken' });
    }

    await db.query(
      'UPDATE users SET name = ?, email = ?, street = ?, bio = ? WHERE id = ?',
      [name.trim(), email, street || null, bio || null, req.user.id]
    );

    // Skills: simplest correct approach is delete-all-then-insert.
    if (Array.isArray(skill_ids)) {
      await db.query('DELETE FROM user_skills WHERE user_id = ?', [req.user.id]);

      if (skill_ids.length > 0) {
        const values = skill_ids.map((id) => [req.user.id, id]);
        await db.query('INSERT INTO user_skills (user_id, category_id) VALUES ?', [values]);
      }
    }

    const [rows] = await db.query(
      'SELECT id, name, email, role, street, city, bio, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/profile/password — change your own password ---------------------
router.put('/password', async (req, res, next) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ message: 'Both current and new password are required' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters' });
  }

  try {
    const [rows] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const match = await bcrypt.compare(current_password, rows[0].password);

    if (!match) {
      return res.status(401).json({ message: 'Your current password is not correct' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id]);

    res.json({ message: 'Password updated' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
