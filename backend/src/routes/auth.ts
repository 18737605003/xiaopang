import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { logOperation } from '../middleware/logging.js';
import { logSecurity, logger } from '../utils/logger.js';

const router = Router();
const prisma = new PrismaClient();

router.post('/login', async (req, res) => {
  const startTime = Date.now();
  const ip = req.ip || req.connection.remoteAddress;
  
  try {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      await logSecurity({
        eventType: 'LOGIN_FAILED',
        ip: ip,
        details: { username, reason: 'user_not_found' },
        severity: 'MEDIUM',
      });
      return res.status(401).json({ message: '用户名或密码错误' });
    }

    if (user.status !== 'ACTIVE') {
      await logSecurity({
        userId: user.id,
        eventType: 'LOGIN_FAILED',
        ip: ip,
        details: { username, reason: 'account_inactive' },
        severity: 'HIGH',
      });
      return res.status(401).json({ message: '账户已被禁用' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      await logSecurity({
        userId: user.id,
        eventType: 'LOGIN_FAILED',
        ip: ip,
        details: { username, reason: 'invalid_password' },
        severity: 'MEDIUM',
      });
      return res.status(401).json({ message: '用户名或密码错误' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '10m' }
    );

    await logSecurity({
      userId: user.id,
      eventType: 'LOGIN_SUCCESS',
      ip: ip,
      severity: 'LOW',
    });

    await logOperation({
      userId: user.id,
      username: user.username,
      action: 'LOGIN',
      resource: 'auth',
      status: 'SUCCESS',
      ip: ip,
      userAgent: req.headers['user-agent'],
      duration: Date.now() - startTime,
    });

    await logger.info('auth', `用户 ${username} 登录成功`, { userId: user.id, ip });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
      token,
    });
  } catch (error) {
    await logger.error('auth', '登录失败', undefined, { error });
    res.status(500).json({ message: '登录失败' });
  }
});

router.post('/logout', authenticate, async (req: AuthRequest, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  
  try {
    await logSecurity({
      userId: req.user?.id,
      eventType: 'LOGOUT',
      ip: ip,
      severity: 'LOW',
    });

    await logOperation({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'LOGOUT',
      resource: 'auth',
      status: 'SUCCESS',
      ip: ip,
    });

    res.json({ message: '退出成功' });
  } catch (error) {
    res.status(500).json({ message: '退出失败' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        avatar: true,
        department: true,
        quota: true,
        usedQuota: true,
      },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: '获取用户信息失败' });
  }
});

router.post('/change-password', authenticate, async (req: AuthRequest, res) => {
  const startTime = Date.now();
  const ip = req.ip || req.connection.remoteAddress;
  
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: '请提供旧密码和新密码' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ message: '新密码长度至少为6位' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user?.id },
    });

    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) {
      await logSecurity({
        userId: req.user?.id,
        eventType: 'PASSWORD_CHANGE',
        ip: ip,
        details: { reason: 'invalid_old_password' },
        severity: 'MEDIUM',
      });
      return res.status(401).json({ message: '旧密码错误' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user?.id },
      data: { password: hashedPassword },
    });

    await logSecurity({
      userId: req.user?.id,
      eventType: 'PASSWORD_CHANGE',
      ip: ip,
      severity: 'MEDIUM',
    });

    await logOperation({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'UPDATE',
      resource: 'auth',
      status: 'SUCCESS',
      ip: ip,
      duration: Date.now() - startTime,
      details: { action: 'password_change' },
    });

    await logger.info('auth', `用户 ${req.user?.username} 修改密码成功`, { userId: req.user?.id });

    res.json({ message: '密码修改成功，请重新登录' });
  } catch (error) {
    await logger.error('auth', '修改密码失败', undefined, { error });
    res.status(500).json({ message: '修改密码失败' });
  }
});

export default router;