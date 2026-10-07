import { tx } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/domain';
import { jsonError } from '@/lib/http';

export async function POST(_req, { params }) {
  const auth = await requireRole([ROLES.SUPERVISOR]);
  if (auth.error) return jsonError(auth.error, auth.status);
  const { id } = await params;
  try {
    await tx(async client => {
      const q = await client.query('SELECT status FROM cutting_orders WHERE id=$1 FOR UPDATE', [id]);
      if (!q.rowCount) throw Object.assign(new Error('Order not found'), { status: 404 });
      if (q.rows[0].status !== 'REJECTED') throw Object.assign(new Error('Only rejected orders can be resubmitted'), { status: 409 });
      await client.query(`UPDATE verification_items SET actual_qty=NULL,status=NULL WHERE order_id=$1`, [id]);
      await client.query(`UPDATE cutting_orders SET status='PENDING_VERIFICATION', updated_at=NOW() WHERE id=$1`, [id]);
    });
    return Response.json({ ok: true });
  } catch (e) {
    return jsonError(e.message || 'Resubmission failed', e.status || 500);
  }
}
