const path = require('path');

function required(name, val) {
  if (val === undefined || val === null || String(val).trim() === '') {
    throw new Error(`Missing required env: ${name}`);
  }
  return val;
}

const config = {
  port: Number(process.env.PORT || 3001),
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    // 数据库端口，默认使用 MySQL 标准端口 3306
    port: Number(process.env.DB_PORT || 3306),
    // 数据库用户名，默认 jhbaweb
    user: process.env.DB_USER || 'jhbaweb',
    password: process.env.DB_PASSWORD || '97887509',
    // 数据库名称，默认 jhbaweb
    database: process.env.DB_NAME || 'jhbaweb',
  },
  jwt: {
    secret: required('JWT_SECRET', process.env.JWT_SECRET || 'please_change_me'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  uploads: {
    dir: process.env.UPLOAD_DIR
      ? path.resolve(process.cwd(), process.env.UPLOAD_DIR)
      : path.resolve(process.cwd(), 'uploads'),
    maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 50) * 1024 * 1024,
  },
};

module.exports = { config };

