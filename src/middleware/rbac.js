const { AppError } = require('../utils/errors');

// Factory — declare required roles on a route:
//   router.get('/...', requireAuth, requireRoles('teacher', 'center_manager'), controller)
//
// super_admin always passes regardless of listed roles.
function requireRoles(...allowed) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('UNAUTHORIZED', 'Authentication required.', 'تصدیق ضروری ہے۔', 401));
    }
    if (req.user.roles.includes('super_admin')) return next();

    const hasRole = req.user.roles.some((r) => allowed.includes(r));
    if (!hasRole) {
      return next(new AppError(
        'FORBIDDEN',
        'You do not have permission to perform this action.',
        'آپ کو یہ کارروائی کرنے کی اجازت نہیں ہے۔',
        403,
      ));
    }
    next();
  };
}

module.exports = requireRoles;
