const { pool } = require('../db');

async function writeOperationLog({
  userId,
  operationType,
  targetType,
  targetId,
  details,
  ipAddress,
  userAgent,
}) {
  try {
    await pool.execute(
      `INSERT INTO operation_logs
        (user_id, operation_type, target_type, target_id, details, ip_address, user_agent)
       VALUES
        (:userId, :operationType, :targetType, :targetId, :details, :ipAddress, :userAgent)`,
      {
        userId: userId || null,
        operationType,
        targetType: targetType || null,
        targetId: targetId || null,
        details: details ? String(details).slice(0, 5000) : null,
        ipAddress: ipAddress || null,
        userAgent: userAgent ? String(userAgent).slice(0, 1000) : null,
      },
    );
  } catch (e) {
    // Best-effort logging; never break main request.
  }
}

module.exports = { writeOperationLog };

