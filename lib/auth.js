import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// JWT secret is read lazily so that a missing env var does not crash the
// build. In production it MUST be provided via the deployment secrets
// manager; if it is missing at request time we throw a clear error.
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    // Non-production fallback only; NEVER used for real users.
    return 'dev-only-insecure-secret-do-not-use-in-prod';
  }
  return secret;
}

export async function hashPassword(password) {
  return await bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

export function generateToken(userId, username) {
  return jwt.sign(
    { userId, username },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (error) {
    return null;
  }
}

export function getUserFromToken(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    return decoded;
  } catch (error) {
    return null;
  }
}