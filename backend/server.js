// server.js — entry point. Wires middleware and routes together.

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { auth, adminOnly } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const requestRoutes = require('./routes/requests');
const offerRoutes = require('./routes/offers');
const userRoutes = require('./routes/users');
const reviewRoutes = require('./routes/reviews');
const reportRoutes = require('./routes/reports');
const profileRoutes = require('./routes/profile');
const adminRoutes = require('./routes/admin');
const categoryRoutes = require('./routes/categories');

const app = express();

// --- Global middleware ----------------------------------------------------

// CORS: the Vue dev server is on :5173, this API on :3000. Different
// origins, so the browser needs explicit permission.
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));

// Turn incoming JSON bodies into req.body.
app.use(express.json());

// Tiny request logger — useful when demoing which endpoint fires.
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// --- Routes ---------------------------------------------------------------

// Public
app.use('/api/auth', authRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Protected — `auth` runs before every route in these routers
app.use('/api/categories', auth, categoryRoutes);
app.use('/api/requests', auth, requestRoutes);
app.use('/api/offers', auth, offerRoutes);
app.use('/api/users', auth, userRoutes);
app.use('/api/reviews', auth, reviewRoutes);
app.use('/api/reports', auth, reportRoutes);
app.use('/api/profile', auth, profileRoutes);

// Admin — two middleware in a row: must be logged in AND an admin
app.use('/api/admin', auth, adminOnly, adminRoutes);

// --- Error handling -------------------------------------------------------

// Nothing matched.
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Central error handler. Routes call next(err) and end up here, so the
// error response format is identical everywhere.
// Four arguments is what tells Express this is the error handler.
app.use((err, req, res, next) => {
  console.error('[error]', err.message);

  // Turn known MySQL errors into sensible status codes.
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'That record already exists' });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ message: 'Referenced record does not exist' });
  }

  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`NeighborHelp API running on http://localhost:${PORT}`);
});
