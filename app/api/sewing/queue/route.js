import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/domain';
import { jsonError } from '@/lib/http';

export async function GET() {
  const auth = await requireRole([ROLES.SEWING]);
  if (auth.error) return jsonError(auth.error, auth.status);
  const { rows } = await db.query(`
    SELECT o.id, o.order_no, o.target_qty, o.fabric_roll_id, o.actual_fabric_yds, o.status, o.verified_at,
      r.name AS recipe_name, r.recipe_code,
      vl.verifier_id, vu.full_name AS verifier_name, vl.wastage_pct, vl.component_variances, vl.timestamp AS verification_timestamp
    FROM cutting_orders o
    JOIN recipes r ON r.id=o.recipe_id
    JOIN LATERAL (
      SELECT * FROM verification_logs x
      WHERE x.order_id=o.id AND x.decision='APPROVED'
      ORDER BY x.timestamp DESC LIMIT 1
    ) vl ON TRUE
    JOIN users vu ON vu.id=vl.verifier_id
    WHERE o.status = 'VERIFIED'
    ORDER BY o.verified_at ASC
  `);
  return Response.json({ queue: rows });
}
