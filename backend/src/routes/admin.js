const express = require('express');
const { z } = require('zod');

const { requireAuth, requireRole } = require('../middleware/auth');
const { listApplications, getApplicationById, updateApplicationStatus } = require('../services/applications');
const { findUserByAccount, createUser, listUsers, setUserStatus } = require('../services/users');
const { writeOperationLog } = require('../services/logs');
const { hashPassword } = require('../utils/password');

const router = express.Router();

router.use(requireAuth, requireRole(['admin', 'super_admin']));

router.get('/applications', async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : '';
    const allowed = new Set(['pending', 'approved', 'rejected', '']);
    if (!allowed.has(status)) return res.status(400).json({ message: 'status 参数错误' });
    const rows = await listApplications(status || undefined);
    res.json({ items: rows });
  } catch (e) {
    next(e);
  }
});

router.post('/applications/:id/approve', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id 参数错误' });

    const app = await getApplicationById(id);
    if (!app) return res.status(404).json({ message: '申请不存在' });
    if (app.status !== 'pending') return res.status(400).json({ message: '该申请已处理' });

    const exists = await findUserByAccount(app.account);
    if (exists) {
      await updateApplicationStatus({ id, status: 'approved', processedBy: req.user.id, remark: '账号已存在，自动标记通过' });
      return res.json({ message: '该账号已存在，已标记申请为通过' });
    }

    const initialPassword = '12345';
    const passwordHash = await hashPassword(initialPassword);
    const userId = await createUser({
      account: app.account,
      passwordHash,
      username: null,
      role: 'user',
      status: 'active',
      mustChangePassword: true,
    });

    await updateApplicationStatus({ id, status: 'approved', processedBy: req.user.id, remark: `已创建用户ID=${userId}` });

    await writeOperationLog({
      userId: req.user.id,
      operationType: 'approve_application',
      targetType: 'user_application',
      targetId: id,
      details: `approved: created_user=${userId} account=${app.account}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ message: `已通过，该用户可使用初始密码 ${initialPassword} 登录` });
  } catch (e) {
    next(e);
  }
});

router.post('/applications/:id/reject', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id 参数错误' });

    const body = z.object({ remark: z.string().max(500).optional() }).parse(req.body || {});
    const app = await getApplicationById(id);
    if (!app) return res.status(404).json({ message: '申请不存在' });
    if (app.status !== 'pending') return res.status(400).json({ message: '该申请已处理' });

    await updateApplicationStatus({ id, status: 'rejected', processedBy: req.user.id, remark: body.remark || null });

    await writeOperationLog({
      userId: req.user.id,
      operationType: 'reject_application',
      targetType: 'user_application',
      targetId: id,
      details: `rejected: account=${app.account}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ message: '已拒绝' });
  } catch (e) {
    next(e);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const users = await listUsers();
    res.json({ items: users });
  } catch (e) {
    next(e);
  }
});

router.post('/users', async (req, res, next) => {
  try {
    const body = z
      .object({
        account: z.string().min(1),
        username: z.string().max(50).optional(),
        role: z.enum(['user', 'admin', 'super_admin']).optional(),
      })
      .parse(req.body);

    const account = body.account.trim();
    const exists = await findUserByAccount(account);
    if (exists) return res.status(400).json({ message: '该账号已存在' });

    const initialPassword = '12345';
    const passwordHash = await hashPassword(initialPassword);
    const userId = await createUser({
      account,
      passwordHash,
      username: body.username || null,
      role: body.role || 'user',
      status: 'active',
      mustChangePassword: true,
    });

    await writeOperationLog({
      userId: req.user.id,
      operationType: 'create_user',
      targetType: 'user',
      targetId: userId,
      details: `created account=${account} role=${body.role || 'user'}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ message: `账号已创建，初始密码 ${initialPassword}`, userId });
  } catch (e) {
    next(e);
  }
});

router.post('/users/:id/status', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id 参数错误' });
    const body = z.object({ status: z.enum(['pending', 'active', 'disabled']) }).parse(req.body);

    await setUserStatus(id, body.status);
    await writeOperationLog({
      userId: req.user.id,
      operationType: 'update_user_status',
      targetType: 'user',
      targetId: id,
      details: `status=${body.status}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ message: '已更新' });
  } catch (e) {
    next(e);
  }
});

module.exports = { adminRouter: router };

