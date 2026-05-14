const jwt = require('jsonwebtoken');
const { AppError }             = require('../utils/errors');
const { getCachedPermissions } = require('../repositories/permissions');

function requireAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('UNAUTHORIZED', 'Authentication required.', 'تصدیق ضروری ہے۔', 401));
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    if (payload.type !== 'access') {
      throw new Error('wrong token type');
    }
    req.user = {
      id:        payload.sub,
      roles:     payload.roles || [],
      center_id: payload.center_id || null,
    };

    // Lazy getter: first access triggers a Redis lookup (or DB fallback).
    // Subsequent accesses on the same request reuse the same Promise.
    let _permPromise = null;
    Object.defineProperty(req, 'userPermissions', {
      get() {
        if (!_permPromise) _permPromise = getCachedPermissions(req.user.id);
        return _permPromise;
      },
      configurable: true,
    });

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('TOKEN_EXPIRED', 'Access token has expired.', 'ٹوکن کی میعاد ختم ہو گئی ہے۔', 401));
    }
    next(new AppError('INVALID_TOKEN', 'Invalid token.', 'ٹوکن غلط ہے۔', 401));
  }
}

module.exports = requireAuth;
