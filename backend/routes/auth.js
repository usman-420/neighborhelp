// routes/auth.js — register and login.

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
require('dotenv').config();

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '4h' }
  );
}

// Mechelen city centre — new users are placed near here so the map and
// distance matching have something to work with before they set an address.
const DEFAULT_LAT = 51.0259;
const DEFAULT_LNG = 4.4776;

// POST /api/auth/register --------------------------------------------------
router.post('/register', async (req, res, next) => {
  const { name, email, password, street } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  if (name.trim().length < 2) {
    return res.status(400).json({ message: 'Please enter your name' });
  }

  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'That email is already registered' });
    }

    const hash = await bcrypt.hash(password, 10);

    // Small spread around the centre so markers don't stack on one point.
    const lat = DEFAULT_LAT + (Math.random() - 0.5) * 0.02;
    const lng = DEFAULT_LNG + (Math.random() - 0.5) * 0.03;

    const [result] = await db.query(
      `INSERT INTO users (name, email, password, street, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), email, hash, street || null, lat, lng]
    );

    const user = { id: result.insertId, name: name.trim(), email, role: 'user' };
    res.status(201).json({ token: createToken(user), user });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login -----------------------------------------------------
router.post('/login', async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    // Identical message for both failures so we don't reveal which
    // email addresses exist.
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const found = rows[0];

    if (!found.is_active) {
      return res.status(403).json({ message: 'This account has been deactivated' });
    }

    const match = await bcrypt.compare(password, found.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = { id: found.id, name: found.name, email: found.email, role: found.role };
    res.json({ token: createToken(user), user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
