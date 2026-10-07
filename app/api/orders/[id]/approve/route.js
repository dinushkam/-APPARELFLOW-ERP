import { tx } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { calculateWastagePct, validateApproval, ROLES } from '@/lib/domain';
import { jsonError } from '@/lib/http';

export async function POST(_req, { params }) {
  const auth = await requireRole([ROLES.VERIFIER]);
  if (auth.error) return jsonError(auth.error, auth.status);
  const { id } = await params;
  try {
    const result = await tx(async client => {
      const orderQ = await client.query(`
        SELECT o.*, r.std_fabric_yards
        FROM cutting_orders o JOIN recipes r ON r.id=o.recipe_id
        WHERE o.id=$1 FOR UPDATE
      `, [id]);
      if (!orderQ.rowCount) throw Object.assign(new Error('Order not found'), { status: 404 });
      const order = orderQ.rows[0];
      if (order.status !== 'PENDING_VERIFICATION') throw Object.assign(new Error('Only pending orders can be approved'), { status: 409 });

      const itemsQ = await client.query(`
        SELECT vi.*, rc.component_name
        FROM verification_items vi JOIN recipe_components rc ON rc.id=vi.component_id
        WHERE vi.order_id=$1 ORDER BY vi.id
      `, [id]);
      const gate = validateApproval(itemsQ.rows, auth.session.role);
      if (!gate.ok) throw Object.assign(new Error(gate.error), { status: gate.status });

      const wastage = calculateWastagePct(order.actual_fabric_yds, order.std_fabric_yards, order.target_qty);
      const variances = itemsQ.rows.map(i => ({
        component_id: i.component_id,
        component_name: i.component_name,
        expected_qty: Number(i.expected_qty),
        actual_qty: Number(i.actual_qty),
        variance: Number(i.actual_qty) - Number(i.expected_qty),
        status: i.status
      }));

      await client.query(`UPDATE cutting_orders SET status='VERIFIED', verified_at=NOW(), updated_at=NOW() WHERE id=$1`, [id]);
      const logQ = await client.query(`
        INSERT INTO verification_logs (order_id, verifier_id, decision, rejection_note, wastage_pct, component_variances)
        VALUES ($1,$2,'APPROVED',NULL,$3,$4::jsonb)
        RETURNING *
      `, [id, auth.session.id, wastage, JSON.stringify(variances)]);
      return { wastage_pct: wastage, audit: logQ.rows[0] };
    });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return jsonError(e.message || 'Approval failed', e.status || 500);
  }
}
