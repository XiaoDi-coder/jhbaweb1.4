const { pool } = require('../db');

async function findUserByAccount(account) {
  const [rows] = await pool.execute(
    `SELECT id, account, password, username, role, status, must_change_password, last_login_at
     FROM users
     WHERE account = :account
     LIMIT 1`,
    { account },
  );
  return rows[0] || null;
}

async function findUserById(id) {
  const [rows] = await pool.execute(
    `SELECT id, account, username, role, status, must_change_password, last_login_at
     FROM users
     WHERE id = :id
     LIMIT 1`,
    { id },
  );
  return rows[0] || null;
}

async function createUser({ account, passwordHash, username, role = 'user', status = 'pending', mustChangePassword = true }) {
  const [ret] = await pool.execute(
    `INSERT INTO users (account, password, username, role, status, must_change_password)
     VALUES (:account, :password, :username, :role, :status, :mustChangePassword)`,
    {
      account,
      password: passwordHash,
      username: username || null,
      role,
      status,
      mustChangePassword: !!mustChangePassword,
    },
  );
  return ret.insertId;
}

async function updateLastLoginAt(userId) {
  await pool.execute(`UPDATE users SET last_login_at = NOW() WHERE id = :id`, { id: userId });
}

async function updatePassword(userId, passwordHash, mustChangePassword) {
  await pool.execute(
    `UPDATE users SET password = :password, must_change_password = :mustChangePassword WHERE id = :id`,
    { id: userId, password: passwordHash, mustChangePassword: !!mustChangePassword },
  );
}

async function listUsers() {
  const [rows] = await pool.execute(
    `SELECT id, account, username, role, status, must_change_password, created_at, updated_at, last_login_at
     FROM users
     ORDER BY id DESC`,
  );
  return rows;
}

async function setUserStatus(id, status) {
  await pool.execute(`UPDATE users SET status = :status WHERE id = :id`, { id, status });
}

module.exports = {
  findUserByAccount,
  findUserById,
  createUser,
  updateLastLoginAt,
  updatePassword,
  listUsers,
  setUserStatus,
};

