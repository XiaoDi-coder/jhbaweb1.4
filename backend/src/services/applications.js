const { pool } = require('../db');

async function createApplication(account) {
  const [ret] = await pool.execute(
    `INSERT INTO user_applications (account, status)
     VALUES (:account, 'pending')`,
    { account },
  );
  return ret.insertId;
}

async function findApplicationByAccount(account) {
  const [rows] = await pool.execute(
    `SELECT id, account, status, applied_at, processed_by, processed_at, remark
     FROM user_applications
     WHERE account = :account
     ORDER BY id DESC
     LIMIT 1`,
    { account },
  );
  return rows[0] || null;
}

async function listApplications(status) {
  const where = status ? 'WHERE ua.status = :status' : '';
  const [rows] = await pool.execute(
    `SELECT ua.id, ua.account, ua.status, ua.applied_at, ua.processed_at, ua.remark,
            u.username AS processed_by_name
     FROM user_applications ua
     LEFT JOIN users u ON ua.processed_by = u.id
     ${where}
     ORDER BY ua.id DESC`,
    status ? { status } : {},
  );
  return rows;
}

async function updateApplicationStatus({ id, status, processedBy, remark }) {
  await pool.execute(
    `UPDATE user_applications
     SET status = :status,
         processed_by = :processedBy,
         processed_at = NOW(),
         remark = :remark
     WHERE id = :id`,
    { id, status, processedBy, remark: remark || null },
  );
}

async function getApplicationById(id) {
  const [rows] = await pool.execute(
    `SELECT id, account, status, applied_at, processed_by, processed_at, remark
     FROM user_applications
     WHERE id = :id
     LIMIT 1`,
    { id },
  );
  return rows[0] || null;
}

module.exports = {
  createApplication,
  findApplicationByAccount,
  listApplications,
  updateApplicationStatus,
  getApplicationById,
};

