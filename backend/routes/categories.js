// routes/categories.js — read-only category list for normal users.
// (Admins get full CRUD in routes/admin.js.)

const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/categories ------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, description FROM categories WHERE is_active = TRUE ORDER BY name'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
