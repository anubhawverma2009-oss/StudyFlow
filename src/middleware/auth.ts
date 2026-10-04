import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  userId?: string;
  userEmail?: string;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    req.userId = decodedToken.uid;
    req.userEmail = decodedToken.email || `${decodedToken.uid}@studyflow.app`;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = decodedToken;
      req.userId = decodedToken.uid;
      req.userEmail = decodedToken.email || `${decodedToken.uid}@studyflow.app`;
      return next();
    } catch {
      // Fallback to guest header if provided
    }
  }

  // Fallback to client session identity header if present (for seamless guest/offline fallback)
  const clientUid = req.headers['x-user-id'] as string;
  if (clientUid) {
    req.userId = clientUid;
    req.userEmail = (req.headers['x-user-email'] as string) || `${clientUid}@studyflow.app`;
  } else {
    req.userId = 'guest_user';
    req.userEmail = 'guest@studyflow.app';
  }
  next();
};
