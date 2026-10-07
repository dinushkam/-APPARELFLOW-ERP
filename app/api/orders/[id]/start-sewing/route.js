import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/domain';
import { jsonError } from '@/lib/http';

export async function POST(_req, { params }) {
  const auth = await requireRole([ROLES.SEWING]);
  if (auth.error) return jsonError(auth.error, auth.status);
  const { id } = await params;
  const { rows } = await db.query(`
    UPDATE cutting_orders SET status='SEWING', sewing_started_at=NOW(), updated_at=NOW()
    WHERE id=$1 AND status='VERIFIED' RETURNING *
  `, [id]);
  if (!rows.length) return jsonError('Only VERIFIED orders can start sewing', 422);
  return Response.json({ order: rows[0] });
}
