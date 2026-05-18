const { AppError }           = require('../utils/errors');
const { getCachedPermissions } = require('../repositories/permissions');

// requirePermission('centers.create')
// Passes if the user's resolved permission set includes the given key.
// The set is fetched from Redis (TTL 5 min) or computed from DB on cache miss.
// super_admin short-circuit: all permissions are included via seed data.
function requirePermission(permissionKey) {
  return async (req, _res, next) => {
    try {
      const perms = await req.userPermissions;
      if (!perms.has(permissionKey)) {
        return next(new AppError(
          'FORBIDDEN',
          `Permission '${permissionKey}' is required.`,
          'آپ کو یہ کارروائی کرنے کی اجازت نہیں ہے۔',
          403,
        ));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

// requireAnyPermission('enrollments.withdraw', 'enrollments.transfer')
// Passes if the user has at least ONE of the listed permission keys.
function requireAnyPermission(...permissionKeys) {
  return async (req, _res, next) => {
    try {
      const perms = await req.userPermissions;
      const granted = permissionKeys.some((key) => perms.has(key));
      if (!granted) {
        return next(new AppError(
          'FORBIDDEN',
          `One of [${permissionKeys.join(', ')}] is required.`,
          'آپ کو یہ کارروائی کرنے کی اجازت نہیں ہے۔',
          403,
        ));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requirePermission, requireAnyPermission };
