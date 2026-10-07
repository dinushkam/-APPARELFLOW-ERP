import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { createSession, setSessionCookie } from '@/lib/auth';
import { jsonError } from '@/lib/http';

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req) {
  try {
    const body = schema.parse(await req.json());
    const { rows } = await db.query('SELECT id, email, password_hash, role, full_name FROM users WHERE email = $1', [body.email.toLowerCase()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(body.password, user.password_hash))) return jsonError('Invalid credentials', 401);
    const token = await createSession(user);
    await setSessionCookie(token);
    return Response.json({ user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name } });
  } catch (e) {
    if (e?.name === 'ZodError') return jsonError('Invalid login payload', 400, e.flatten());
    console.error(e);
    return jsonError('Login failed', 500);
  }
}
