import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// 所有用户路由都需要认证
router.use(authenticate);

router.get('/', authorize('ADMIN'), async (req, res) => {
  try {
    const { page = 1, pageSize = 10, search } = req.query;
    
    const where = search
      ? {
          OR: [
            { username: { contains: search as string } },
            { email: { contains: search as string } },
          ],
        }
      : {};

    const users = await prisma.user.findMany({
      where,
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        department: true,
        status: true,
        quota: true,
        usedQuota: true,
        createdAt: true,
      },
    });

    const total = await prisma.user.count({ where });

    res.json({ data: users, total, page: Number(page), pageSize: Number(pageSize) });
  } catch (error) {
    res.status(500).json({ message: '获取用户列表失败' });
  }
});

// 只有管理员可以添加用户
router.post('/', authorize('ADMIN'), async (req, res) => {
  try {
    const { username, email, password, role, department } = req.body;
    
    // 检查用户名是否已存在
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ message: '用户名已存在' });
    }
    
    // 检查邮箱是否已存在
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({ message: '邮箱已存在' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role: role || 'USER', // 默认创建普通用户
        department,
      },
    });

    res.status(201).json({ message: '用户创建成功', userId: user.id });
  } catch (error) {
    res.status(500).json({ message: '创建用户失败' });
  }
});

// 更新用户（仅管理员）
router.put('/:id', authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { password, ...otherData } = req.body;

    // 构建更新数据
    const updateData: any = { ...otherData };
    
    // 只有当密码字段存在且不为空时才更新密码
    if (password !== undefined && password !== null && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { username: true }
    });

    res.json({ message: '用户更新成功', username: updatedUser.username });
  } catch (error) {
    console.error('更新用户失败:', error);
    res.status(500).json({ message: '更新用户失败' });
  }
});

router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // 先查询用户信息，用于日志记录
    const user = await prisma.user.findUnique({ 
      where: { id },
      select: { username: true }
    });
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    await prisma.user.delete({ where: { id } });
    
    // 将用户名添加到响应中，供日志中间件使用
    res.json({ message: '用户删除成功', username: user.username });
  } catch (error) {
    res.status(500).json({ message: '删除用户失败' });
  }
});

export default router;
