import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});

await client.connect();

try {
  await client.query('BEGIN');

  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('cutting_supervisor','cutting_verifier','sewing_supervisor')),
      full_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id BIGSERIAL PRIMARY KEY,
      recipe_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      std_fabric_yards NUMERIC(10,2) NOT NULL CHECK (std_fabric_yards > 0),
      wastage_cap NUMERIC(5,2) NOT NULL CHECK (wastage_cap >= 0)
    );

    CREATE TABLE IF NOT EXISTS recipe_components (
      id BIGSERIAL PRIMARY KEY,
      recipe_id BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      component_name TEXT NOT NULL,
      pieces_per_garment INTEGER NOT NULL CHECK (pieces_per_garment > 0),
      image_url TEXT,
      UNIQUE(recipe_id, component_name)
    );

    CREATE TABLE IF NOT EXISTS cutting_orders (
      id BIGSERIAL PRIMARY KEY,
      order_no TEXT UNIQUE NOT NULL,
      recipe_id BIGINT NOT NULL REFERENCES recipes(id),
      target_qty INTEGER NOT NULL CHECK (target_qty > 0),
      fabric_roll_id TEXT NOT NULL,
      actual_fabric_yds NUMERIC(12,2) NOT NULL CHECK (actual_fabric_yds > 0),
      status TEXT NOT NULL CHECK (status IN ('CUTTING_IN_PROGRESS','PENDING_VERIFICATION','REJECTED','VERIFIED','SEWING')),
      created_by BIGINT NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      verified_at TIMESTAMPTZ,
      sewing_started_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS verification_items (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES cutting_orders(id) ON DELETE CASCADE,
      component_id BIGINT NOT NULL REFERENCES recipe_components(id),
      expected_qty INTEGER NOT NULL CHECK (expected_qty >= 0),
      actual_qty INTEGER CHECK (actual_qty >= 0),
      status TEXT CHECK (status IN ('GREEN','YELLOW','RED')),
      UNIQUE(order_id, component_id)
    );

    CREATE TABLE IF NOT EXISTS verification_logs (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES cutting_orders(id),
      verifier_id BIGINT NOT NULL REFERENCES users(id),
      decision TEXT NOT NULL CHECK (decision IN ('APPROVED','REJECTED')),
      rejection_note TEXT,
      wastage_pct NUMERIC(10,4),
      component_variances JSONB NOT NULL DEFAULT '[]'::jsonb,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK ((decision='REJECTED' AND rejection_note IS NOT NULL AND LENGTH(TRIM(rejection_note)) > 0) OR decision='APPROVED')
    );

    CREATE INDEX IF NOT EXISTS idx_cutting_orders_status ON cutting_orders(status);
    CREATE INDEX IF NOT EXISTS idx_verification_items_order ON verification_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_verification_logs_order ON verification_logs(order_id);
  `);

  await client.query(`
    CREATE OR REPLACE FUNCTION block_verification_log_mutation()
    RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'verification_logs is append-only and immutable';
    END;
    $$ LANGUAGE plpgsql;
  `);
  await client.query('DROP TRIGGER IF EXISTS verification_logs_immutable_update ON verification_logs');
  await client.query('DROP TRIGGER IF EXISTS verification_logs_immutable_delete ON verification_logs');
  await client.query(`CREATE TRIGGER verification_logs_immutable_update BEFORE UPDATE ON verification_logs FOR EACH ROW EXECUTE FUNCTION block_verification_log_mutation()`);
  await client.query(`CREATE TRIGGER verification_logs_immutable_delete BEFORE DELETE ON verification_logs FOR EACH ROW EXECUTE FUNCTION block_verification_log_mutation()`);

  const recipeA = await client.query(`
    INSERT INTO recipes (recipe_code,name,category,std_fabric_yards,wastage_cap)
    VALUES ('REC-BL01','Casual Blouse','Blouse',1.8,5.0)
    ON CONFLICT (recipe_code) DO UPDATE SET name=EXCLUDED.name
    RETURNING id
  `);
  const recipeB = await client.query(`
    INSERT INTO recipes (recipe_code,name,category,std_fabric_yards,wastage_cap)
    VALUES ('REC-CT02','Crop Top','Crop Top',1.1,8.0)
    ON CONFLICT (recipe_code) DO UPDATE SET name=EXCLUDED.name
    RETURNING id
  `);

  const componentsA = [
    ['Front Body Panel',1],['Back Body Panel',1],['Sleeves (Left & Right)',2],['Collar & Stand',1],['Sleeve Cuffs',2]
  ];
  const componentsB = [
    ['Front Chest Panel',1],['Back Support Panel',1],['Neck Binding Strip',1],['Hem Elastic Casing',1],['Side Strap Accents',2]
  ];

  for (const [name, pieces] of componentsA) {
    await client.query(`INSERT INTO recipe_components(recipe_id,component_name,pieces_per_garment) VALUES($1,$2,$3) ON CONFLICT(recipe_id,component_name) DO UPDATE SET pieces_per_garment=EXCLUDED.pieces_per_garment`, [recipeA.rows[0].id,name,pieces]);
  }
  for (const [name, pieces] of componentsB) {
    await client.query(`INSERT INTO recipe_components(recipe_id,component_name,pieces_per_garment) VALUES($1,$2,$3) ON CONFLICT(recipe_id,component_name) DO UPDATE SET pieces_per_garment=EXCLUDED.pieces_per_garment`, [recipeB.rows[0].id,name,pieces]);
  }

  const demoUsers = [
    ['supervisor@apparelflow.demo','Supervisor123!','cutting_supervisor','Nadeesha Perera'],
    ['verifier@apparelflow.demo','Verifier123!','cutting_verifier','Ishara Silva'],
    ['sewing@apparelflow.demo','Sewing123!','sewing_supervisor','Malini Fernando']
  ];

  for (const [email,password,role,fullName] of demoUsers) {
    const hash = await bcrypt.hash(password, 12);
    await client.query(`
      INSERT INTO users(email,password_hash,role,full_name)
      VALUES($1,$2,$3,$4)
      ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,role=EXCLUDED.role,full_name=EXCLUDED.full_name
    `,[email,hash,role,fullName]);
  }

  await client.query('COMMIT');
  console.log('Database initialized successfully.');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  await client.end();
}
