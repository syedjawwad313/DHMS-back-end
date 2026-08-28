import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { pool, query } from '../src/config/db.js';

dotenv.config();

async function runSeed() {
  console.log('🌱 Starting DHMS database migration and seeding...');

  try {
    // 1. Ensure pgcrypto extension is enabled
    await query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    // 2. Create tables if they do not exist
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT CHECK (role IN ('user', 'admin')) DEFAULT 'user',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS domains (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        domain_name TEXT NOT NULL,
        registrar TEXT NOT NULL,
        purchase_date DATE NOT NULL,
        expiry_date DATE NOT NULL,
        status TEXT CHECK (status IN ('Active', 'Expiring Soon', 'Expired')) DEFAULT 'Active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS hosting_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_name TEXT NOT NULL,
        storage_gb INT NOT NULL,
        bandwidth_gb INT NOT NULL,
        price_monthly NUMERIC(10,2) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
        plan_id UUID REFERENCES hosting_plans(id) ON DELETE RESTRICT,
        start_date DATE DEFAULT CURRENT_DATE,
        next_billing_date DATE NOT NULL,
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT CHECK (status IN ('open', 'closed')) DEFAULT 'open',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('✅ Schema tables verified/created successfully.');

    // 3. Seed Default Hosting Plans
    const plans = [
      { name: 'Starter', storage: 10, bandwidth: 100, price: 5.00 },
      { name: 'Business', storage: 50, bandwidth: 500, price: 15.00 },
      { name: 'Enterprise', storage: 200, bandwidth: 2000, price: 30.00 },
    ];

    for (const plan of plans) {
      const existingPlan = await query(
        'SELECT id FROM hosting_plans WHERE plan_name = $1',
        [plan.name]
      );
      if (existingPlan.rows.length === 0) {
        await query(
          `INSERT INTO hosting_plans (plan_name, storage_gb, bandwidth_gb, price_monthly, is_active)
           VALUES ($1, $2, $3, $4, true)`,
          [plan.name, plan.storage, plan.bandwidth, plan.price]
        );
        console.log(`📦 Seeded Hosting Plan: ${plan.name} ($${plan.price}/mo)`);
      }
    }

    // 4. Seed Demo Users
    const saltRounds = 10;

    // Demo Admin: admin@dhms.com / AdminPass123!
    const adminEmail = 'admin@dhms.com';
    const adminPassword = 'AdminPass123!';
    const adminHash = await bcrypt.hash(adminPassword, saltRounds);

    let adminUser = await query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (adminUser.rows.length === 0) {
      const insertAdmin = await query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, 'admin')
         RETURNING id, email, role`,
        [adminEmail, adminHash]
      );
      console.log(`👤 Seeded Demo Admin: ${adminEmail} (Role: admin)`);
      adminUser = insertAdmin;
    } else {
      // Update hash in case it changed
      await query('UPDATE users SET password_hash = $1, role = $2 WHERE email = $3', [
        adminHash,
        'admin',
        adminEmail,
      ]);
      console.log(`🔄 Updated Demo Admin: ${adminEmail}`);
    }

    // Demo User: user@dhms.com / UserPass123!
    const userEmail = 'user@dhms.com';
    const userPassword = 'UserPass123!';
    const userHash = await bcrypt.hash(userPassword, saltRounds);

    let demoUser = await query('SELECT id FROM users WHERE email = $1', [userEmail]);
    let demoUserId;
    if (demoUser.rows.length === 0) {
      const insertUser = await query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, 'user')
         RETURNING id, email, role`,
        [userEmail, userHash]
      );
      demoUserId = insertUser.rows[0].id;
      console.log(`👤 Seeded Demo User: ${userEmail} (Role: user)`);
    } else {
      demoUserId = demoUser.rows[0].id;
      await query('UPDATE users SET password_hash = $1, role = $2 WHERE email = $3', [
        userHash,
        'user',
        userEmail,
      ]);
      console.log(`🔄 Updated Demo User: ${userEmail}`);
    }

    // 5. Seed Sample Domains for Demo User
    const existingDomains = await query('SELECT id FROM domains WHERE user_id = $1', [demoUserId]);
    if (existingDomains.rows.length === 0) {
      const today = new Date();

      // Domain 1: Active (expiring in 180 days)
      const exp1 = new Date();
      exp1.setDate(today.getDate() + 180);
      const res1 = await query(
        `INSERT INTO domains (user_id, domain_name, registrar, purchase_date, expiry_date, status)
         VALUES ($1, 'techcorp-solutions.io', 'Namecheap', CURRENT_DATE - INTERVAL '185 days', $2, 'Active')
         RETURNING id`,
        [demoUserId, exp1.toISOString().split('T')[0]]
      );

      // Domain 2: Expiring Soon (expiring in 14 days)
      const exp2 = new Date();
      exp2.setDate(today.getDate() + 14);
      const res2 = await query(
        `INSERT INTO domains (user_id, domain_name, registrar, purchase_date, expiry_date, status)
         VALUES ($1, 'cloudnexus-app.com', 'GoDaddy', CURRENT_DATE - INTERVAL '351 days', $2, 'Expiring Soon')
         RETURNING id`,
        [demoUserId, exp2.toISOString().split('T')[0]]
      );

      // Domain 3: Expired (expired 10 days ago)
      const exp3 = new Date();
      exp3.setDate(today.getDate() - 10);
      await query(
        `INSERT INTO domains (user_id, domain_name, registrar, purchase_date, expiry_date, status)
         VALUES ($1, 'legacy-portal.net', 'Google Domains', CURRENT_DATE - INTERVAL '375 days', $2, 'Expired')`,
        [demoUserId, exp3.toISOString().split('T')[0]]
      );

      console.log('🌐 Seeded 3 sample domains for Demo User (Active, Expiring Soon, Expired)');

      // 6. Seed Subscriptions for Demo User
      const businessPlan = await query("SELECT id FROM hosting_plans WHERE plan_name = 'Business' LIMIT 1");
      if (businessPlan.rows.length > 0 && res1.rows.length > 0) {
        await query(
          `INSERT INTO user_subscriptions (user_id, domain_id, plan_id, start_date, next_billing_date, status)
           VALUES ($1, $2, $3, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '30 days', 'Active')`,
          [demoUserId, res1.rows[0].id, businessPlan.rows[0].id]
        );
        console.log('⚡ Attached Business Hosting Subscription to techcorp-solutions.io');
      }
    }

    // 7. Seed Sample Contact Messages
    const sampleMsgs = await query('SELECT COUNT(*)::int AS count FROM contact_messages');
    if (sampleMsgs.rows[0].count === 0) {
      await query(`
        INSERT INTO contact_messages (name, email, subject, message, status)
        VALUES 
        ('Sarah Jenkins', 'sarah.j@enterprise.co', 'Custom SLA Inquiry for High-Traffic Domain', 'We are looking for guaranteed 99.99% uptime and custom DNS zone clustering for 50+ corporate domains.', 'open'),
        ('Michael Chang', 'm.chang@developer.dev', 'Billing cycle question regarding Annual discounts', 'Does DHMS support annual upfront invoicing with a 20% discount on Enterprise plans?', 'closed'),
        ('Elena Rostova', 'elena@crypto-labs.xyz', 'Domain transfer assistance for .tech and .io TLDs', 'Need assistance transferring our 5 portfolio domains from Cloudflare registrar.', 'open');
      `);
      console.log('✉️  Seeded sample contact inquiries.');
    }

    console.log('=============================================');
    console.log('🎉 Database seeding completed successfully!');
    console.log('Demo Credentials:');
    console.log('   👤 User:  user@dhms.com  / UserPass123!');
    console.log('   🛡️ Admin: admin@dhms.com / AdminPass123!');
    console.log('=============================================');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await pool.end();
  }
}

runSeed();
