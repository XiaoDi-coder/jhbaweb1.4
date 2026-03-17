const express = require('express');
const { z } = require('zod');

const { findUserByAccount, createUser } = require('../services/users');
const { findApplicationByAccount, createApplication } = require('../services/applications');
const { writeOperationLog } = require('../services/logs');
const { hashPassword } = require('../utils/password');

const router = express.Router();

router.post('/applications', async (req, res, next) => {
  try {
    const body = z.object({ account: z.string().min(1) }).parse(req.body);
    const account = body.account.trim();

    const exists = await findUserByAccount(account);
    if (exists) return res.status(400).json({ message: '该账号已存在，请直接登录' });

    const last = await findApplicationByAccount(account);
    if (last && last.status === 'pending') return res.status(400).json({ message: '该账号已提交过申请，请等待管理员审核' });

    const id = await createApplication(account);

    await writeOperationLog({
      operationType: 'apply_account',
      targetType: 'user_application',
      targetId: id,
      details: `apply: ${account}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ message: '申请已提交，请等待管理员审核' });
  } catch (e) {
    return next(e);
  }
});

module.exports = { publicRouter: router };

