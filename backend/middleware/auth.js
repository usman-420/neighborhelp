// middleware/auth.js — token check + admin check.

const jwt = require('jsonwebtoken');
require('dotenv').config();

// Runs before any protected route. Rejects the request if there is no
// valid token; otherwise puts the verified user on req.user.
function auth(req, res, next) {
  const header = req.headers.authorization;

  // The `code` matters: the frontend only force-logs-out when a 401 is
  // about the TOKEN. A 401 meaning "wrong password" (e.g. on the change
  // password form) must NOT destroy the user's session.
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided', code: 'TOKEN_MISSING' });
  }

  try {
    const payload = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    req.user = { id: payload.id, email: payload.email, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token', code: 'TOKEN_INVALID' });
  }
}

// Runs AFTER auth. 403 not 401: we know who you are, you just may not
// do this. Note the role comes from the signed token, never the body.
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

module.exports = { auth, adminOnly };
