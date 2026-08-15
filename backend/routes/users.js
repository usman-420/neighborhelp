// routes/users.js — the Community and Map tabs.
//
// PRIVACY: this is the endpoint that in the original prototype leaked
// every user's full street address to anyone logged in. Here:
//   - house numbers are stripped (streetOnly)
//   - map coordinates are blurred to roughly a 150 m circle
//   - email addresses are never returned for other users

const express = require('express');
const db = require('../db');
const { streetOnly, blurCoordinates, distanceKm } = require('../utils/geo');

const router = express.Router();

// GET /api/users — the community list -------------------------------------
// Optional: ?category_id=3 to filter by skill, ?search=name
router.get('/', async (req, res, next) => {
  const { category_id, search } = req.query;

  let sql = `
    SELECT u.id, u.name, u.street, u.bio, u.city, u.latitude, u.longitude, u.created_at,
           (SELECT AVG(rating) FROM reviews rv WHERE rv.reviewee_id = u.id) AS avg_rating,
           (SELECT COUNT(*)    FROM reviews rv WHERE rv.reviewee_id = u.id) AS review_count,
           (SELECT COUNT(*) FROM offers o WHERE o.helper_id = u.id AND o.status = 'accepted') AS helps_given,
           (SELECT GROUP_CONCAT(c.name ORDER BY c.name)
              FROM user_skills us JOIN categories c ON c.id = us.category_id
              WHERE us.user_id = u.id) AS skills
    FROM users u
    WHERE u.is_active = TRUE`;
  const params = [];

  if (category_id) {
    sql += ' AND EXISTS (SELECT 1 FROM user_skills us WHERE us.user_id = u.id AND us.category_id = ?)';
    params.push(category_id);
  }
  if (search) {
    sql += ' AND u.name LIKE ?';
    params.push(`%${search}%`);
  }

  sql += ' ORDER BY u.name';

  try {
    const [rows] = await db.query(sql, params);
    const [[me]] = await db.query('SELECT latitude, longitude FROM users WHERE id = ?', [
      req.user.id,
    ]);

    const cleaned = rows.map((u) => {
      const isMe = u.id === req.user.id;
      const blurred = blurCoordinates(u.latitude, u.longitude, u.id);
      const km = distanceKm(me.latitude, me.longitude, u.latitude, u.longitude);

      return {
        id: u.id,
        name: u.name,
        bio: u.bio,
        city: u.city,
        // Street name only — never the house number.
        street: isMe ? u.street : streetOnly(u.street),
        // Blurred coordinates for the map.
        latitude: isMe ? Number(u.latitude) : blurred.latitude,
        longitude: isMe ? Number(u.longitude) : blurred.longitude,
        avg_rating: u.avg_rating === null ? null : Number(Number(u.avg_rating).toFixed(1)),
        review_count: Number(u.review_count),
        helps_given: Number(u.helps_given),
        skills: u.skills ? u.skills.split(',') : [],
        distance_km: km === null ? null : Number(km.toFixed(1)),
        is_me: isMe,
      };
    });

    res.json(cleaned);
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id — one public profile ---------------------------------
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.street, u.bio, u.city, u.created_at,
              (SELECT AVG(rating) FROM reviews rv WHERE rv.reviewee_id = u.id) AS avg_rating,
              (SELECT COUNT(*)    FROM reviews rv WHERE rv.reviewee_id = u.id) AS review_count,
              (SELECT COUNT(*) FROM offers o WHERE o.helper_id = u.id AND o.status = 'accepted') AS helps_given,
              (SELECT GROUP_CONCAT(c.name ORDER BY c.name)
                 FROM user_skills us JOIN categories c ON c.id = us.category_id
                 WHERE us.user_id = u.id) AS skills
       FROM users u WHERE u.id = ? AND u.is_active = TRUE`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const u = rows[0];
    res.json({
      ...u,
      street: u.id === req.user.id ? u.street : streetOnly(u.street),
      avg_rating: u.avg_rating === null ? null : Number(Number(u.avg_rating).toFixed(1)),
      review_count: Number(u.review_count),
      helps_given: Number(u.helps_given),
      skills: u.skills ? u.skills.split(',') : [],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
