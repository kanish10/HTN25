const express = require('express');
const { generateToken, verifyToken, authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * POST /auth/login - Login user and generate JWT token
 */
router.post('/login', async (req, res) => {
  try {
    const { name, email, storeDomain } = req.body;

    if (!name || !storeDomain) {
      return res.status(400).json({
        error: 'Name and store domain are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Generate a unique user ID based on store domain and name
    const userId = `user_${storeDomain.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;

    const userData = {
      userId,
      name,
      email: email || '',
      storeDomain,
      loggedInAt: Date.now()
    };

    // Generate JWT token
    const token = generateToken(userData);

    res.json({
      success: true,
      message: 'Login successful',
      user: userData,
      token,
      expiresIn: '7d'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      details: error.message
    });
  }
});

/**
 * POST /auth/verify - Verify JWT token and return user info
 */
router.post('/verify', (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Token is required',
        code: 'NO_TOKEN'
      });
    }

    const userData = verifyToken(token);

    if (!userData) {
      return res.status(401).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }

    res.json({
      success: true,
      user: userData,
      valid: true
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      error: 'Token verification failed',
      details: error.message
    });
  }
});

/**
 * GET /auth/profile - Get current user profile (protected route)
 */
router.get('/profile', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

/**
 * POST /auth/logout - Logout (client-side token removal)
 */
router.post('/logout', (req, res) => {
  // Since we're using JWT, logout is handled client-side by removing the token
  // This endpoint exists for consistency and potential future server-side session management
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

/**
 * GET /auth/status - Check authentication status
 */
router.get('/status', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.json({
      authenticated: false,
      user: null
    });
  }

  const userData = verifyToken(token);

  res.json({
    authenticated: !!userData,
    user: userData
  });
});

module.exports = router;
