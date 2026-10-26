const { verifyToken } = require('../utils/token');

const COOKIE_NAME = process.env.COOKIE_NAME || 'spotters_token';

/**
 * requireAuth
 * Blocks unauthenticated requests. Reads the JWT from the httpOnly
 * cookie set at login, verifies it, and attaches the decoded user
 * payload to req.user for downstream handlers.
 */
function requireAuth(req, res, next) {
  const token = req.cookies ? req.cookies[COOKIE_NAME] : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded; // { id, email, role, fullName }
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid. Please log in again.' });
  }
}

/**
 * requireRole(...roles)
 * Restricts a route to specific roles (e.g. 'doctor', 'admin').
 * Used by future Doctor/Contributor portal endpoints.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to access this resource.' });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole, COOKIE_NAME };
