import jwt from 'jsonwebtoken';

export default function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    const token = header.slice(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: decoded.id, username: decoded.username };
    } catch {
      // ignore; treat as unauthenticated
    }
  }
  next();
}
