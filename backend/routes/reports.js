// routes/reports.js — reporting another user.
//
// In the prototype the Report tab just told you to go somewhere else.
// Here it hosts a real form backed by a real table, and admins resolve
// the reports from the admin dashboard.

const express = require('express');
const db = require('../db');

const router = express.Router();

const REASONS = [
  'Inappropriate behaviour',
  'Spam or scam',
  'Did not show up',
  'Unsafe situation',
  'Other',
];

// GET /api/reports/reasons — populate the dropdown ------------------------
router.get('/reasons', (req, res) => {
  res.json(REASONS);
});

// GET /api/reports — my own submitted reports -----------------------------
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT rp.*, u.name AS reported_user_name
       FROM reports rp
       JOIN users u ON u.id = rp.reported_user_id
       WHERE rp.reporter_id = ?
       ORDER BY rp.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/reports --------------------------------------------------------
router.post('/', async (req, res, next) => {
  const { reported_user_id, reason, details } = req.body;

  if (!reported_user_id) return res.status(400).json({ message: 'Please choose a user' });
  if (!reason) return res.status(400).json({ message: 'Please choose a reason' });
  if (!REASONS.includes(reason)) return res.status(400).json({ message: 'Invalid reason' });
  if (details && details.length > 500) {
    return res.status(400).json({ message: 'Details must be 500 characters or fewer' });
  }
  if (Number(reported_user_id) === req.user.id) {
    return res.status(400).json({ message: 'You cannot report yourself' });
  }

  try {
    const [user] = await db.query('SELECT id FROM users WHERE id = ?', [reported_user_id]);
    if (user.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const [result] = await db.query(
      `INSERT INTO reports (reporter_id, reported_user_id, reason, details)
       VALUES (?, ?, ?, ?)`,
      [req.user.id, reported_user_id, reason, details || null]
    );

    const [rows] = await db.query('SELECT * FROM reports WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
