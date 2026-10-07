import { z } from 'zod';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { classifyCount, ROLES } from '@/lib/domain';
import { jsonError } from '@/lib/http';

const schema = z.object({ item_id: z.coerce.number().int().positive(), actual_qty: z.coerce.number().int().min(0) });

export async function PUT(req, { params }) {
  const auth = await requireRole([ROLES.VERIFIER]);
  if (auth.error) return jsonError(auth.error, auth.status);
  const { id } = await params;
  try {
    const input = schema.parse(await req.json());
    const found = await db.query(`
      SELECT vi.id, vi.expected_qty, o.status
      FROM verification_items vi JOIN cutting_orders o ON o.id = vi.order_id
      WHERE vi.id = $1 AND vi.order_id = $2
    `, [input.item_id, id]);
    if (!found.rowCount) return jsonError('Verification item not found', 404);
    if (found.rows[0].status !== 'PENDING_VERIFICATION') return jsonError('Counts can only be edited while pending verification', 409);
    const status = classifyCount(input.actual_qty, Number(found.rows[0].expected_qty));
    const { rows } = await db.query(`UPDATE verification_items SET actual_qty=$1,status=$2 WHERE id=$3 RETURNING *`, [input.actual_qty, status, input.item_id]);
    return Response.json({ item: rows[0] });
  } catch (e) {
    if (e?.name === 'ZodError') return jsonError('Actual quantity must be a non-negative whole number', 400, e.flatten());
    return jsonError(e.message || 'Count update failed', 500);
  }
}
