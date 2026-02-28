import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logSecurity } from '../utils/logger.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const ip = req.ip || req.connection.remoteAddress;
    
    if (!token) {
      return res.status(401).json({ message: '未授权访问' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = decoded;
    next();
  } catch (error) {
    const ip = req.ip || req.connection.remoteAddress;
    
    if (error instanceof jwt.TokenExpiredError) {
      logSecurity({
        eventType: 'TOKEN_EXPIRED',
        ip: ip,
        severity: 'LOW',
      }).catch(console.error);
      return res.status(401).json({ message: 'Token已过期，请重新登录' });
    }
    
    logSecurity({
      eventType: 'TOKEN_INVALID',
      ip: ip,
      severity: 'MEDIUM',
    }).catch(console.error);
    
    return res.status(401).json({ message: 'Token无效或已过期' });
  }
};

export const authorize = (...roles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const ip = req.ip || req.connection.remoteAddress;
    
    if (!req.user || !roles.includes(req.user.role)) {
      await logSecurity({
        userId: req.user?.id,
        eventType: 'PERMISSION_DENIED',
        ip: ip,
        details: { 
          requiredRoles: roles, 
          userRole: req.user?.role,
          path: req.path,
          method: req.method,
        },
        severity: 'HIGH',
      }).catch(console.error);
      
      return res.status(403).json({ message: '权限不足' });
    }
    next();
  };
};

export const authorizeReadOnly = (...allowedRoles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const ip = req.ip || req.connection.remoteAddress;
    
    if (!req.user) {
      return res.status(401).json({ message: '未授权访问' });
    }
    
    if (req.method === 'GET') {
      return next();
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      await logSecurity({
        userId: req.user.id,
        eventType: 'PERMISSION_DENIED',
        ip: ip,
        details: { 
          requiredRoles: allowedRoles, 
          userRole: req.user.role,
          path: req.path,
          method: req.method,
          reason: 'write_permission_denied',
        },
        severity: 'MEDIUM',
      }).catch(console.error);
      
      return res.status(403).json({ message: '您没有权限执行此操作' });
    }
    
    next();
  };
};