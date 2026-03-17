/**
 * 数据库连接池配置
 * 使用 mysql2/promise 连接 MySQL（默认端口 3306，用户名 jhbaweb，数据库 jhbaweb）
 * 所有业务代码通过导出的 pool 执行 SQL
 */
const mysql = require('mysql2/promise');
const { config } = require('./config');

// 创建全局连接池，避免每次请求都新建连接
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  connectionLimit: 10,
  waitForConnections: true,
  namedPlaceholders: true, // 支持 :name 形式的命名参数
  dateStrings: true, // 将日期字段返回为字符串，避免时区问题
});

/**
 * 简单的数据库连通性检查，用于启动时确认数据库可用
 */
async function pingDb() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

module.exports = { pool, pingDb };


