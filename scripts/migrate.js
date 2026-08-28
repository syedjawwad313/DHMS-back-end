import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_dp9wkG1IgKle@ep-frosty-surf-a5oc5xdg-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function migrate() {
  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('Connecting to Neon PostgreSQL database...');
    await pool.query(`
      ALTER TABLE domains 
      ADD COLUMN IF NOT EXISTS domain_cost NUMERIC(10,2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS has_hosting BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS hosting_registrar TEXT,
      ADD COLUMN IF NOT EXISTS hosting_purchase_date DATE,
      ADD COLUMN IF NOT EXISTS hosting_expiry_date DATE,
      ADD COLUMN IF NOT EXISTS hosting_cost NUMERIC(10,2) DEFAULT 0.00;
    `);

    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'domains';
    `);

    console.log('✅ Neon DB Migration Succeeded! Current columns on domains:');
    cols.rows.forEach((c) => console.log(`  - ${c.column_name} (${c.data_type})`));
    await pool.end();
  } catch (e) {
    console.error('Migration error:', e.message);
  }
}

migrate();
