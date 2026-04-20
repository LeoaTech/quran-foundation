const db = require('../db/knex');

function findByPhone(phone) {
  return db('users').where({ phone, is_active: true }).first();
}

function findById(id) {
  return db('users').where({ id, is_active: true }).first();
}

// Returns all active role rows for the user across all centers.
// Each row: { role: 'teacher', center_id: uuid | null }
function getUserRoles(userId) {
  return db('user_roles as ur')
    .join('roles as r', 'ur.role_id', 'r.id')
    .where('ur.user_id', userId)
    .where('r.is_active', true)
    .select('r.name as role', 'ur.center_id');
}

function updateLastLogin(userId) {
  return db('users').where({ id: userId }).update({ last_login_at: db.fn.now() });
}

function updatePassword(userId, passwordHash) {
  return db('users').where({ id: userId }).update({
    password_hash: passwordHash,
    updated_at: db.fn.now(),
  });
}

module.exports = { findByPhone, findById, getUserRoles, updateLastLogin, updatePassword };
