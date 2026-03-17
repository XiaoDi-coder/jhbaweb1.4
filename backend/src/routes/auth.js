const express = require('express');
const { z } = require('zod');

const { requireAuth } = require('../middleware/auth');
const { writeOperationLog } = require('../services/logs');
const { findUserByAccount, updateLastLoginAt, updatePassword } = require('../services/users');
const { verifyPassword, hashPassword } = require('../utils/password');
const { signAccessToken } = require('../utils/tokens');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const body = z
      .object({
        account: z.string().min(1),
        password: z.string().min(1),
      })
      .parse(req.body);

    const account = body.account.trim();
    const user = await findUserByAccount(account);
    if (!user) {
      await writeOperationLog({
        operationType: 'login',
        targetType: 'user',
        details: `login_failed: account_not_found: ${account}`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      return res.status(400).json({ message: '账号或密码错误' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ message: user.status === 'pending' ? '账号待审核' : '账号已禁用' });
    }
    const ok = await verifyPassword(body.password, user.password);
    if (!ok) {
      await writeOperationLog({
        userId: user.id,
        operationType: 'login',
        targetType: 'user',
        targetId: user.id,
        details: 'login_failed: bad_password',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      return res.status(400).json({ message: '账号或密码错误' });
    }

    await updateLastLoginAt(user.id);
    const token = signAccessToken({
      sub: user.id,
      id: user.id,
      account: user.account,
      username: user.username,
      role: user.role,
    });

    await writeOperationLog({
      userId: user.id,
      operationType: 'login',
      targetType: 'user',
      targetId: user.id,
      details: 'login_success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({
      token,
      user: {
        id: user.id,
        account: user.account,
        username: user.username,
        role: user.role,
        mustChangePassword: !!user.must_change_password,
      },
    });
  } catch (e) {
    return next(e);
  }
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      account: req.user.account,
      username: req.user.username || req.user.account,
      role: req.user.role,
    },
  });
});

router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const body = z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6),
      })
      .parse(req.body);

    const user = await findUserByAccount(req.user.account);
    if (!user) return res.status(401).json({ message: '未登录' });

    const ok = await verifyPassword(body.currentPassword, user.password);
    if (!ok) return res.status(400).json({ message: '当前密码错误' });

    const newHash = await hashPassword(body.newPassword);
    await updatePassword(user.id, newHash, false);

    await writeOperationLog({
      userId: user.id,
      operationType: 'change_password',
      targetType: 'user',
      targetId: user.id,
      details: 'password_changed',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ message: '密码已修改，请重新登录' });
  } catch (e) {
    return next(e);
  }
});

module.exports = { authRouter: router };

