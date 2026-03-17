const { findUserByAccount, createUser } = require('./services/users');
const { hashPassword } = require('./utils/password');

async function ensureDefaultAdmin() {
  const account = 'admin';
  const password = '97887509';

  const exists = await findUserByAccount(account);
  if (exists) return { created: false, account };

  const passwordHash = await hashPassword(password);
  const id = await createUser({
    account,
    passwordHash,
    username: '管理员',
    role: 'admin',
    status: 'active',
    mustChangePassword: false,
  });
  return { created: true, account, id };
}

module.exports = { ensureDefaultAdmin };

