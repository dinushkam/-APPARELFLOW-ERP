import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'apparelflow_session';

function key() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
  return new TextEncoder().encode(secret);
}

export async function createSession(user) {
  return new SignJWT({ role: user.role, name: user.full_name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(key());
}

export async function setSessionCookie(token) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
}

export async function getSession() {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, key());
    return { id: Number(payload.sub), role: payload.role, full_name: payload.name };
  } catch {
    return null;
  }
}

export async function requireRole(roles) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized', status: 401 };
  if (!roles.includes(session.role)) return { error: 'Forbidden', status: 403 };
  return { session };
}
