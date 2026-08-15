// routes/offers.js — offering to help, and the owner accepting/declining.

const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/offers?role=helper|owner ---------------------------------------
// helper = offers I made. owner = offers made on my requests.
router.get('/', async (req, res, next) => {
  const role = req.query.role === 'owner' ? 'owner' : 'helper';

  try {
    const sql =
      role === 'helper'
        ? `SELECT o.*, r.title AS request_title, r.status AS request_status,
                  u.name AS owner_name
           FROM offers o
           JOIN help_requests r ON r.id = o.request_id
           JOIN users u        ON u.id = r.user_id
           WHERE o.helper_id = ?
           ORDER BY o.created_at DESC`
        : `SELECT o.*, r.title AS request_title, r.status AS request_status,
                  u.name AS helper_name,
                  (SELECT AVG(rating) FROM reviews rv WHERE rv.reviewee_id = u.id) AS helper_rating
           FROM offers o
           JOIN help_requests r ON r.id = o.request_id
           JOIN users u        ON u.id = o.helper_id
           WHERE r.user_id = ?
           ORDER BY o.created_at DESC`;

    const [rows] = await db.query(sql, [req.user.id]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/offers — offer to help on a request ---------------------------
router.post('/', async (req, res, next) => {
  const { request_id, message } = req.body;

  if (!request_id) return res.status(400).json({ message: 'request_id is required' });
  if (message && message.length > 500) {
    return res.status(400).json({ message: 'Message must be 500 characters or fewer' });
  }

  try {
    const [reqRows] = await db.query(
      'SELECT id, user_id, title, status FROM help_requests WHERE id = ?',
      [request_id]
    );
    if (reqRows.length === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const request = reqRows[0];

    // You cannot offer to help yourself.
    if (request.user_id === req.user.id) {
      return res.status(400).json({ message: 'You cannot offer help on your own request' });
    }
    if (request.status !== 'open') {
      return res.status(409).json({ message: 'This request is no longer open' });
    }

    const [existing] = await db.query(
      'SELECT id FROM offers WHERE request_id = ? AND helper_id = ?',
      [request_id, req.user.id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'You have already offered to help with this' });
    }

    const [result] = await db.query(
      'INSERT INTO offers (request_id, helper_id, message) VALUES (?, ?, ?)',
      [request_id, req.user.id, message || null]
    );

    const [rows] = await db.query('SELECT * FROM offers WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/offers/:id — accept or decline (request owner only) ------------
router.put('/:id', async (req, res, next) => {
  const { status } = req.body;

  if (!['accepted', 'declined'].includes(status)) {
    return res.status(400).json({ message: 'Status must be accepted or declined' });
  }

  try {
    // The JOIN checks ownership: only the owner of the request may decide.
    const [rows] = await db.query(
      `SELECT o.*, r.user_id AS owner_id, r.id AS request_id, r.title
       FROM offers o
       JOIN help_requests r ON r.id = o.request_id
       WHERE o.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0 || rows[0].owner_id !== req.user.id) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    const offer = rows[0];

    await db.query('UPDATE offers SET status = ? WHERE id = ?', [status, req.params.id]);

    // Accepting an offer moves the request to "matched" and declines
    // the others, so a request can only have one accepted helper.
    if (status === 'accepted') {
      await db.query("UPDATE help_requests SET status = 'matched' WHERE id = ?", [
        offer.request_id,
      ]);
      await db.query(
        "UPDATE offers SET status = 'declined' WHERE request_id = ? AND id != ? AND status = 'pending'",
        [offer.request_id, req.params.id]
      );
    }

    const [updated] = await db.query('SELECT * FROM offers WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/offers/:id — withdraw your own offer ------------------------
router.delete('/:id', async (req, res, next) => {
  try {
    const [result] = await db.query('DELETE FROM offers WHERE id = ? AND helper_id = ?', [
      req.params.id,
      req.user.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    res.json({ message: 'Offer withdrawn' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
