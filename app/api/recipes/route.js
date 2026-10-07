import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { rows } = await db.query(`
    SELECT r.*, COALESCE(json_agg(json_build_object(
      'id', rc.id,
      'component_name', rc.component_name,
      'pieces_per_garment', rc.pieces_per_garment,
      'image_url', rc.image_url
    ) ORDER BY rc.id) FILTER (WHERE rc.id IS NOT NULL), '[]') AS components
    FROM recipes r
    LEFT JOIN recipe_components rc ON rc.recipe_id = r.id
    GROUP BY r.id
    ORDER BY r.id
  `);
  return Response.json({ recipes: rows });
}
