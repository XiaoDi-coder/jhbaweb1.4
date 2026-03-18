/**
 * 用户模块数据库服务层 (User Services)
 * 负责所有与用户表 (users) 相关的直接数据库交互
 */
const { pool } = require('../db');

/**
 * 根据账号（邮箱或手机号）查找单个用户
 * @param {string} account - 用户账号
 * @returns {Object|null} 用户对象或 null
 */
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

/**
 * 根据用户ID查找单个用户
 * @param {number} id - 用户ID
 * @returns {Object|null} 用户对象或 null
 */
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

/**
 * 创建新用户（直接入库）
 * @param {Object} userData - 用户数据
 * @returns {number} 新创建的用户的 ID
 */
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

/**
 * 更新用户的最后登录时间为当前时间
 * @param {number} userId - 用户ID
 */
async function updateLastLoginAt(userId) {
  await pool.execute(`UPDATE users SET last_login_at = NOW() WHERE id = :id`, { id: userId });
}

/**
 * 修改用户密码及是否需要强制修改密码的状态
 * @param {number} userId - 用户ID
 * @param {string} passwordHash - 新密码的哈希值
 * @param {boolean} mustChangePassword - 首次登录是否强制改密
 */
async function updatePassword(userId, passwordHash, mustChangePassword) {
  await pool.execute(
    `UPDATE users SET password = :password, must_change_password = :mustChangePassword WHERE id = :id`,
    { id: userId, password: passwordHash, mustChangePassword: !!mustChangePassword },
  );
}

/**
 * 获取所有用户列表（供管理员后台使用）
 * @returns {Array} 用户列表数组
 */
async function listUsers() {
  const [rows] = await pool.execute(
    `SELECT id, account, username, role, status, must_change_password, created_at, updated_at, last_login_at
     FROM users
     ORDER BY id DESC`,
  );
  return rows;
}

/**
 * 更改指定用户的账号状态 (pending/active/disabled)
 * @param {number} id - 用户ID
 * @param {string} status - 新状态
 */
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