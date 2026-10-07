import { z } from 'zod';
import { tx } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { validateRejection, ROLES } from '@/lib/domain';
import { jsonError } from '@/lib/http';

const schema = z.object({ reason: z.string().trim().min(1).max(1000) });

export async function POST(req, { params }) {
  const auth = await requireRole([ROLES.VERIFIER]);
  if (auth.error) return jsonError(auth.error, auth.status);
  const { id } = await params;
  try {
    const input = schema.parse(await req.json());
    const check = validateRejection(input.reason, auth.session.role);
    if (!check.ok) return jsonError(check.error, check.status);
    await tx(async client => {
      const orderQ = await client.query('SELECT status FROM cutting_orders WHERE id=$1 FOR UPDATE', [id]);
      if (!orderQ.rowCount) throw Object.assign(new Error('Order not found'), { status: 404 });
      if (orderQ.rows[0].status !== 'PENDING_VERIFICATION') throw Object.assign(new Error('Only pending orders can be rejected'), { status: 409 });
      await client.query(`UPDATE cutting_orders SET status='REJECTED', updated_at=NOW() WHERE id=$1`, [id]);
      await client.query(`
        INSERT INTO verification_logs (order_id, verifier_id, decision, rejection_note, wastage_pct, component_variances)
        VALUES ($1,$2,'REJECTED',$3,NULL,'[]'::jsonb)
      `, [id, auth.session.id, input.reason]);
    });
    return Response.json({ ok: true });
  } catch (e) {
    if (e?.name === 'ZodError') return jsonError('Rejection reason is mandatory', 422, e.flatten());
    return jsonError(e.message || 'Rejection failed', e.status || 500);
  }
}
