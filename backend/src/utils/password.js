const bcrypt = require('bcryptjs');

async function hashPassword(plain) {
  const saltRounds = 10;
  return bcrypt.hash(String(plain), saltRounds);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(String(plain), String(hash));
}

module.exports = { hashPassword, verifyPassword };

