import { z } from 'zod';
import { db, tx } from '@/lib/db';
import { requireRole, getSession } from '@/lib/auth';
import { ROLES } from '@/lib/domain';
import { jsonError } from '@/lib/http';

const createSchema = z.object({
  recipe_id: z.coerce.number().int().positive(),
  target_qty: z.coerce.number().int().positive().max(100000),
  fabric_roll_id: z.string().trim().min(2).max(100),
  actual_fabric_yds: z.coerce.number().positive().max(1000000)
});

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError('Unauthorized', 401);

  let where = 'TRUE';
  const params = [];
  if (session.role === ROLES.VERIFIER) where = `o.status = 'PENDING_VERIFICATION'`;
  if (session.role === ROLES.SEWING) where = `o.status = 'VERIFIED'`;

  const { rows } = await db.query(`
    SELECT o.*, r.name AS recipe_name, r.recipe_code, r.std_fabric_yards, r.wastage_cap,
      u.full_name AS created_by_name,
      COALESCE(json_agg(json_build_object(
        'id', vi.id,
        'component_id', vi.component_id,
        'component_name', rc.component_name,
        'expected_qty', vi.expected_qty,
        'actual_qty', vi.actual_qty,
        'status', vi.status
      ) ORDER BY vi.id) FILTER (WHERE vi.id IS NOT NULL), '[]') AS items
    FROM cutting_orders o
    JOIN recipes r ON r.id = o.recipe_id
    JOIN users u ON u.id = o.created_by
    LEFT JOIN verification_items vi ON vi.order_id = o.id
    LEFT JOIN recipe_components rc ON rc.id = vi.component_id
    WHERE ${where}
    GROUP BY o.id, r.id, u.id
    ORDER BY o.created_at DESC
  `, params);
  return Response.json({ orders: rows });
}

export async function POST(req) {
  const auth = await requireRole([ROLES.SUPERVISOR]);
  if (auth.error) return jsonError(auth.error, auth.status);
  try {
    const input = createSchema.parse(await req.json());
    const created = await tx(async client => {
      const recipe = await client.query('SELECT id FROM recipes WHERE id = $1', [input.recipe_id]);
      if (!recipe.rowCount) throw Object.assign(new Error('Recipe not found'), { status: 404 });
      const components = await client.query('SELECT id, pieces_per_garment FROM recipe_components WHERE recipe_id = $1 ORDER BY id', [input.recipe_id]);
      if (!components.rowCount) throw Object.assign(new Error('Recipe has no components'), { status: 422 });

      const orderNo = `CUT-${Date.now().toString().slice(-8)}`;
      const result = await client.query(`
        INSERT INTO cutting_orders (order_no, recipe_id, target_qty, fabric_roll_id, actual_fabric_yds, status, created_by)
        VALUES ($1,$2,$3,$4,$5,'PENDING_VERIFICATION',$6)
        RETURNING *
      `, [orderNo, input.recipe_id, input.target_qty, input.fabric_roll_id, input.actual_fabric_yds, auth.session.id]);
      const order = result.rows[0];
      for (const c of components.rows) {
        await client.query(`
          INSERT INTO verification_items (order_id, component_id, expected_qty, actual_qty, status)
          VALUES ($1,$2,$3,NULL,NULL)
        `, [order.id, c.id, input.target_qty * c.pieces_per_garment]);
      }
      return order;
    });
    return Response.json({ order: created }, { status: 201 });
  } catch (e) {
    if (e?.name === 'ZodError') return jsonError('Invalid order payload. Quantity must be a positive whole number; fabric must be positive.', 400, e.flatten());
    return jsonError(e.message || 'Order creation failed', e.status || 500);
  }
}
