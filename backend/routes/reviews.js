// routes/reviews.js — reviews left after a completed request.
//
// Rule that keeps ratings honest: you can only review someone you
// actually worked with, on a request that is completed.

const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/reviews — the Reviews tab --------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const [recent] = await db.query(
      `SELECT rv.*, reviewer.name AS reviewer_name, reviewee.name AS reviewee_name,
              r.title AS request_title
       FROM reviews rv
       JOIN users reviewer ON reviewer.id = rv.reviewer_id
       JOIN users reviewee ON reviewee.id = rv.reviewee_id
       JOIN help_requests r ON r.id = rv.request_id
       ORDER BY rv.created_at DESC
       LIMIT 20`
    );

    // Community-wide totals. These come from the same table the list
    // does, so the numbers can never disagree with the reviews shown.
    const [[stats]] = await db.query(
      `SELECT COUNT(*) AS total_reviews,
              COALESCE(ROUND(AVG(rating), 1), 0) AS average_rating,
              COUNT(DISTINCT reviewee_id) AS reviewed_users
       FROM reviews`
    );

    const [topRated] = await db.query(
      `SELECT u.id, u.name,
              ROUND(AVG(rv.rating), 1) AS avg_rating,
              COUNT(rv.id) AS review_count
       FROM users u
       JOIN reviews rv ON rv.reviewee_id = u.id
       WHERE u.is_active = TRUE
       GROUP BY u.id, u.name
       HAVING COUNT(rv.id) >= 1
       ORDER BY avg_rating DESC, review_count DESC
       LIMIT 5`
    );

    res.json({
      stats: {
        total_reviews: Number(stats.total_reviews),
        average_rating: Number(stats.average_rating),
        reviewed_users: Number(stats.reviewed_users),
      },
      top_rated: topRated.map((t) => ({
        ...t,
        avg_rating: Number(t.avg_rating),
        review_count: Number(t.review_count),
      })),
      recent,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reviews/reviewable — requests I can still review ---------------
// Powers the "leave a review" dropdown, so the button is never a dead end.
router.get('/reviewable', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT r.id AS request_id, r.title,
              CASE WHEN r.user_id = ? THEN o.helper_id ELSE r.user_id END AS other_user_id,
              CASE WHEN r.user_id = ? THEN helper.name ELSE owner.name END AS other_user_name
       FROM help_requests r
       JOIN offers o      ON o.request_id = r.id AND o.status = 'accepted'
       JOIN users helper  ON helper.id = o.helper_id
       JOIN users owner   ON owner.id = r.user_id
       WHERE r.status = 'completed'
         AND (r.user_id = ? OR o.helper_id = ?)
         AND NOT EXISTS (
           SELECT 1 FROM reviews rv
           WHERE rv.request_id = r.id AND rv.reviewer_id = ?
         )`,
      [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/reviews --------------------------------------------------------
router.post('/', async (req, res, next) => {
  const { request_id, rating, comment } = req.body;

  if (!request_id) return res.status(400).json({ message: 'request_id is required' });
  if (!rating) return res.status(400).json({ message: 'Please choose a rating' });
  if (!Number.isInteger(Number(rating)) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be a whole number from 1 to 5' });
  }
  if (comment && comment.length > 500) {
    return res.status(400).json({ message: 'Comment must be 500 characters or fewer' });
  }

  try {
    // Find the completed request and work out who the other party is.
    const [rows] = await db.query(
      `SELECT r.id, r.user_id AS owner_id, r.status, r.title, o.helper_id
       FROM help_requests r
       LEFT JOIN offers o ON o.request_id = r.id AND o.status = 'accepted'
       WHERE r.id = ?`,
      [request_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const r = rows[0];

    if (r.status !== 'completed') {
      return res
        .status(400)
        .json({ message: 'You can only review a request once it is completed' });
    }

    // Am I the owner or the helper? If neither, I have no business here.
    let revieweeId;
    if (r.owner_id === req.user.id) {
      revieweeId = r.helper_id;
    } else if (r.helper_id === req.user.id) {
      revieweeId = r.owner_id;
    } else {
      return res.status(403).json({ message: 'You were not involved in this request' });
    }

    if (!revieweeId) {
      return res.status(400).json({ message: 'This request had no accepted helper' });
    }

    const [existing] = await db.query(
      'SELECT id FROM reviews WHERE request_id = ? AND reviewer_id = ?',
      [request_id, req.user.id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'You have already reviewed this request' });
    }

    const [result] = await db.query(
      `INSERT INTO reviews (request_id, reviewer_id, reviewee_id, rating, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [request_id, req.user.id, revieweeId, rating, comment || null]
    );

    const [created] = await db.query('SELECT * FROM reviews WHERE id = ?', [result.insertId]);
    res.status(201).json(created[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
