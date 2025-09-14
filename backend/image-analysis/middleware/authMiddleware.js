const jwt = require('jsonwebtoken');

// JWT secret - in production, this should be a strong secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'shopbrain-dev-secret-change-in-production';

/**
 * Middleware to verify JWT token and extract user information
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Access token required',
      code: 'NO_TOKEN'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }

    // Add user info to request object
    req.user = user;
    req.userId = user.userId || user.id;
    next();
  });
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    req.userId = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      req.user = null;
      req.userId = null;
    } else {
      req.user = user;
      req.userId = user.userId || user.id;
    }
    next();
  });
};

/**
 * Generate JWT token for user
 */
const generateToken = (userData) => {
  const payload = {
    userId: userData.userId || userData.id,
    name: userData.name,
    email: userData.email,
    storeDomain: userData.storeDomain,
    loggedInAt: Date.now()
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

/**
 * Verify and decode token without middleware
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

module.exports = {
  authenticateToken,
  optionalAuth,
  generateToken,
  verifyToken,
  JWT_SECRET
};
