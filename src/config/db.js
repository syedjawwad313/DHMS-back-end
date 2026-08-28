import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

let isPgConnected = false;
let pool = null;

// Initialize in-memory fallback store for local testing when cloud database is not connected
const inMemoryStore = {
  users: [
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      email: 'admin@dhms.com',
      password_hash: bcrypt.hashSync('AdminPass123!', 10),
      role: 'admin',
      created_at: new Date('2026-01-01T00:00:00Z'),
    },
    {
      id: 'u0000000-0000-0000-0000-000000000002',
      email: 'user@dhms.com',
      password_hash: bcrypt.hashSync('UserPass123!', 10),
      role: 'user',
      created_at: new Date('2026-01-15T00:00:00Z'),
    },
  ],
  hosting_plans: [
    {
      id: 'p0000000-0000-0000-0000-000000000001',
      plan_name: 'Starter',
      storage_gb: 10,
      bandwidth_gb: 100,
      price_monthly: 5.0,
      is_active: true,
      created_at: new Date(),
    },
    {
      id: 'p0000000-0000-0000-0000-000000000002',
      plan_name: 'Business',
      storage_gb: 50,
      bandwidth_gb: 500,
      price_monthly: 15.0,
      is_active: true,
      created_at: new Date(),
    },
    {
      id: 'p0000000-0000-0000-0000-000000000003',
      plan_name: 'Enterprise',
      storage_gb: 200,
      bandwidth_gb: 2000,
      price_monthly: 30.0,
      is_active: true,
      created_at: new Date(),
    },
  ],
  domains: [
    {
      id: 'd0000000-0000-0000-0000-000000000001',
      user_id: 'u0000000-0000-0000-0000-000000000002',
      domain_name: 'techcorp-solutions.io',
      registrar: 'Namecheap',
      purchase_date: new Date(Date.now() - 185 * 86400000).toISOString().split('T')[0],
      expiry_date: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
      status: 'Active',
      created_at: new Date(Date.now() - 185 * 86400000),
    },
    {
      id: 'd0000000-0000-0000-0000-000000000002',
      user_id: 'u0000000-0000-0000-0000-000000000002',
      domain_name: 'cloudnexus-app.com',
      registrar: 'GoDaddy',
      purchase_date: new Date(Date.now() - 351 * 86400000).toISOString().split('T')[0],
      expiry_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      status: 'Expiring Soon',
      created_at: new Date(Date.now() - 351 * 86400000),
    },
    {
      id: 'd0000000-0000-0000-0000-000000000003',
      user_id: 'u0000000-0000-0000-0000-000000000002',
      domain_name: 'legacy-portal.net',
      registrar: 'Google Domains',
      purchase_date: new Date(Date.now() - 375 * 86400000).toISOString().split('T')[0],
      expiry_date: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0],
      status: 'Expired',
      created_at: new Date(Date.now() - 375 * 86400000),
    },
  ],
  user_subscriptions: [
    {
      id: 's0000000-0000-0000-0000-000000000001',
      user_id: 'u0000000-0000-0000-0000-000000000002',
      domain_id: 'd0000000-0000-0000-0000-000000000001',
      plan_id: 'p0000000-0000-0000-0000-000000000002',
      start_date: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
      next_billing_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      status: 'Active',
      created_at: new Date(Date.now() - 30 * 86400000),
    },
  ],
  contact_messages: [
    {
      id: 'm0000000-0000-0000-0000-000000000001',
      name: 'Sarah Jenkins',
      email: 'sarah.j@enterprise.co',
      subject: 'Custom SLA Inquiry for High-Traffic Domain',
      message: 'We are looking for guaranteed 99.99% uptime and custom DNS zone clustering for 50+ corporate domains.',
      status: 'open',
      created_at: new Date(Date.now() - 2 * 86400000),
    },
    {
      id: 'm0000000-0000-0000-0000-000000000002',
      name: 'Michael Chang',
      email: 'm.chang@developer.dev',
      subject: 'Billing cycle question regarding Annual discounts',
      message: 'Does DHMS support annual upfront invoicing with a 20% discount on Enterprise plans?',
      status: 'closed',
      created_at: new Date(Date.now() - 5 * 86400000),
    },
  ],
};

// Automated schema migration and seeding for live PostgreSQL database
async function initializePostgres(clientPool) {
  try {
    // 1. Create Tables
    await clientPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS hosting_plans (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        plan_name VARCHAR(100) NOT NULL,
        storage_gb INT NOT NULL,
        bandwidth_gb INT NOT NULL,
        price_monthly NUMERIC(10,2) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS domains (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        domain_name VARCHAR(255) NOT NULL,
        registrar VARCHAR(100) NOT NULL,
        purchase_date DATE NOT NULL,
        expiry_date DATE NOT NULL,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
        plan_id UUID REFERENCES hosting_plans(id) ON DELETE CASCADE,
        start_date DATE DEFAULT CURRENT_DATE,
        next_billing_date DATE,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS contact_messages (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        subject VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'open',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Seed Default Users if empty
    const usersCheck = await clientPool.query('SELECT COUNT(*) FROM users');
    if (parseInt(usersCheck.rows[0].count, 10) === 0) {
      const adminPass = await bcrypt.hash('AdminPass123!', 10);
      const userPass = await bcrypt.hash('UserPass123!', 10);

      const adminRes = await clientPool.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
        ['admin@dhms.com', adminPass, 'admin']
      );

      const userRes = await clientPool.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
        ['user@dhms.com', userPass, 'user']
      );

      const userId = userRes.rows[0].id;

      // 3. Seed Default Plans if empty
      const p1 = await clientPool.query(
        'INSERT INTO hosting_plans (plan_name, storage_gb, bandwidth_gb, price_monthly, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        ['Starter', 10, 100, 5.00, true]
      );
      const p2 = await clientPool.query(
        'INSERT INTO hosting_plans (plan_name, storage_gb, bandwidth_gb, price_monthly, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        ['Business', 50, 500, 15.00, true]
      );
      const p3 = await clientPool.query(
        'INSERT INTO hosting_plans (plan_name, storage_gb, bandwidth_gb, price_monthly, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        ['Enterprise', 200, 2000, 30.00, true]
      );

      // 4. Seed Sample Domains for user
      const today = new Date();
      const nextYear = new Date();
      nextYear.setFullYear(today.getFullYear() + 1);

      const soonDate = new Date();
      soonDate.setDate(today.getDate() + 14);

      const d1 = await clientPool.query(
        'INSERT INTO domains (user_id, domain_name, registrar, purchase_date, expiry_date, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [userId, 'cloud-scale.com', 'Namecheap', today.toISOString().split('T')[0], nextYear.toISOString().split('T')[0], 'Active']
      );

      const d2 = await clientPool.query(
        'INSERT INTO domains (user_id, domain_name, registrar, purchase_date, expiry_date, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [userId, 'api-gateway.io', 'Cloudflare', today.toISOString().split('T')[0], soonDate.toISOString().split('T')[0], 'Expiring Soon']
      );

      // 5. Seed Subscriptions
      const nextMonth = new Date();
      nextMonth.setMonth(today.getMonth() + 1);

      await clientPool.query(
        'INSERT INTO user_subscriptions (user_id, domain_id, plan_id, start_date, next_billing_date, status) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, d1.rows[0].id, p2.rows[0].id, today.toISOString().split('T')[0], nextMonth.toISOString().split('T')[0], 'Active']
      );

      console.log('🌱 Seeded default Neon PostgreSQL tables, admin & user accounts, plans, and domain assets successfully.');
    }
  } catch (initErr) {
    console.error('⚠️ Database schema initialization error:', initErr.message);
  }
}

// Try connecting to PostgreSQL
if (connectionString && !connectionString.includes('ep-sample') && !connectionString.includes('ep-quick-pool')) {
  try {
    const poolConfig = {
      connectionString: connectionString,
    };

    if (process.env.NODE_ENV === 'production' || !connectionString.includes('localhost')) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }

    pool = new Pool(poolConfig);

    pool.query('SELECT 1', async (err) => {
      if (err) {
        console.warn('⚠️ PostgreSQL connection failed, operating with In-Memory store for local testing:', err.message);
        isPgConnected = false;
      } else {
        isPgConnected = true;
        console.log('✅ Connected to Neon PostgreSQL database successfully.');
        await initializePostgres(pool);
      }
    });
  } catch (e) {
    console.error('Database connection exception:', e.message);
    isPgConnected = false;
  }
} else {
  console.log('ℹ️ Using Built-in In-Memory DB (Preloaded with Demo User & Admin) for instant local verification.');
}

/**
 * Universal Query Engine: Routes to PostgreSQL if connected, or executes in-memory fallback
 */
export const query = async (text, params = []) => {
  if (isPgConnected && pool) {
    return pool.query(text, params);
  }

  // Handle in-memory fallback
  const cleanSql = text.trim().replace(/\s+/g, ' ');

  // 1. USERS
  if (cleanSql.includes('FROM users') && cleanSql.includes('LOWER(email) = $1')) {
    const email = params[0]?.toLowerCase();
    const rows = inMemoryStore.users.filter((u) => u.email.toLowerCase() === email);
    return { rows, rowCount: rows.length };
  }

  if (cleanSql.includes('FROM users') && cleanSql.includes('WHERE id = $1')) {
    const rows = inMemoryStore.users.filter((u) => u.id === params[0]);
    return { rows, rowCount: rows.length };
  }

  if (cleanSql.includes('INSERT INTO users')) {
    const newUser = {
      id: crypto.randomUUID(),
      email: params[0],
      password_hash: params[1],
      role: params[2] || 'user',
      created_at: new Date(),
    };
    inMemoryStore.users.push(newUser);
    return { rows: [newUser], rowCount: 1 };
  }

  // 2. HOSTING PLANS
  if (cleanSql.includes('INSERT INTO hosting_plans')) {
    const newPlan = {
      id: crypto.randomUUID(),
      plan_name: params[0],
      storage_gb: Number(params[1]),
      bandwidth_gb: Number(params[2]),
      price_monthly: Number(params[3]),
      is_active: params[4] !== undefined ? Boolean(params[4]) : true,
      created_at: new Date(),
    };
    inMemoryStore.hosting_plans.push(newPlan);
    return { rows: [newPlan], rowCount: 1 };
  }

  if (cleanSql.includes('UPDATE hosting_plans')) {
    if (cleanSql.includes('SET is_active = NOT is_active')) {
      const planId = params[0];
      const plan = inMemoryStore.hosting_plans.find((p) => p.id === planId);
      if (plan) plan.is_active = !plan.is_active;
      return { rows: plan ? [plan] : [], rowCount: plan ? 1 : 0 };
    }
    const planId = params[params.length - 1];
    const plan = inMemoryStore.hosting_plans.find((p) => p.id === planId);
    if (plan) {
      if (params[0] !== undefined) plan.plan_name = params[0];
      if (params[1] !== undefined) plan.storage_gb = Number(params[1]);
      if (params[2] !== undefined) plan.bandwidth_gb = Number(params[2]);
      if (params[3] !== undefined) plan.price_monthly = Number(params[3]);
      if (params[4] !== undefined) plan.is_active = Boolean(params[4]);
    }
    return { rows: plan ? [plan] : [], rowCount: plan ? 1 : 0 };
  }

  if (cleanSql.includes('DELETE FROM hosting_plans')) {
    const planId = params[0];
    const idx = inMemoryStore.hosting_plans.findIndex((p) => p.id === planId);
    if (idx !== -1) inMemoryStore.hosting_plans.splice(idx, 1);
    return { rows: [], rowCount: 1 };
  }

  if (cleanSql.includes('FROM hosting_plans')) {
    if (cleanSql.includes('WHERE id = $1')) {
      const rows = inMemoryStore.hosting_plans.filter((p) => p.id === params[0]);
      return { rows, rowCount: rows.length };
    }
    if (cleanSql.includes('WHERE is_active = true') || cleanSql.includes('is_active = true')) {
      const rows = inMemoryStore.hosting_plans.filter((p) => p.is_active);
      return { rows, rowCount: rows.length };
    }
    const rows = [...inMemoryStore.hosting_plans];
    return { rows, rowCount: rows.length };
  }

  // 3. USER SUBSCRIPTIONS
  if (cleanSql.includes('FROM user_subscriptions') && cleanSql.includes('WHERE plan_id = $1')) {
    const rows = inMemoryStore.user_subscriptions.filter((s) => s.plan_id === params[0]);
    return { rows, rowCount: rows.length };
  }

  if (cleanSql.includes('FROM user_subscriptions') && cleanSql.includes('WHERE domain_id = $1')) {
    const rows = inMemoryStore.user_subscriptions.filter((s) => s.domain_id === params[0]);
    return { rows, rowCount: rows.length };
  }

  if (cleanSql.includes('FROM user_subscriptions') && cleanSql.includes('WHERE s.user_id = $1')) {
    const rows = inMemoryStore.user_subscriptions
      .filter((s) => s.user_id === params[0])
      .map((s) => {
        const domain = inMemoryStore.domains.find((d) => d.id === s.domain_id);
        const plan = inMemoryStore.hosting_plans.find((p) => p.id === s.plan_id);
        return {
          ...s,
          domain_name: domain?.domain_name || 'unknown.com',
          registrar: domain?.registrar || 'Unknown',
          domain_expiry: domain?.expiry_date || null,
          domain_status: domain?.status || 'Active',
          plan_name: plan?.plan_name || 'Standard',
          storage_gb: plan?.storage_gb || 10,
          bandwidth_gb: plan?.bandwidth_gb || 100,
          price_monthly: plan?.price_monthly || 5.0,
        };
      });
    return { rows, rowCount: rows.length };
  }

  if (cleanSql.includes('INSERT INTO user_subscriptions')) {
    const newSub = {
      id: crypto.randomUUID(),
      user_id: params[0],
      domain_id: params[1],
      plan_id: params[2],
      start_date: new Date().toISOString().split('T')[0],
      next_billing_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      status: 'Active',
      created_at: new Date(),
    };
    inMemoryStore.user_subscriptions.push(newSub);
    return { rows: [newSub], rowCount: 1 };
  }

  if (cleanSql.includes('DELETE FROM user_subscriptions')) {
    const id = params[0];
    const userId = params[1];
    const idx = inMemoryStore.user_subscriptions.findIndex((s) => s.id === id && (!userId || s.user_id === userId));
    if (idx !== -1) inMemoryStore.user_subscriptions.splice(idx, 1);
    return { rows: [{ id }], rowCount: 1 };
  }

  // 4. DOMAINS
  if (cleanSql.includes('FROM domains') && cleanSql.includes('LEFT JOIN users')) {
    const rows = inMemoryStore.domains.map((d) => {
      const user = inMemoryStore.users.find((u) => u.id === d.user_id);
      const sub = inMemoryStore.user_subscriptions.find((s) => s.domain_id === d.id);
      const plan = sub ? inMemoryStore.hosting_plans.find((p) => p.id === sub.plan_id) : null;
      return {
        ...d,
        user_email: user?.email || 'unknown@dhms.com',
        subscription_id: sub?.id || null,
        plan_id: plan?.id || null,
        plan_name: plan?.plan_name || null,
        price_monthly: plan?.price_monthly || null,
      };
    });
    return { rows, rowCount: rows.length };
  }

  if (cleanSql.includes('FROM domains') && cleanSql.includes('WHERE d.user_id = $1')) {
    let rows = inMemoryStore.domains
      .filter((d) => d.user_id === params[0])
      .map((d) => {
        const sub = inMemoryStore.user_subscriptions.find((s) => s.domain_id === d.id);
        const plan = sub ? inMemoryStore.hosting_plans.find((p) => p.id === sub.plan_id) : null;
        return {
          ...d,
          subscription_id: sub?.id || null,
          plan_id: plan?.id || null,
          plan_name: plan?.plan_name || null,
          price_monthly: plan?.price_monthly || null,
        };
      });

    if (params[1]) {
      const search = params[1].replace(/%/g, '').toLowerCase();
      rows = rows.filter(
        (r) => r.domain_name.toLowerCase().includes(search) || r.registrar.toLowerCase().includes(search)
      );
    }
    return { rows, rowCount: rows.length };
  }

  if (cleanSql.includes('FROM domains') && cleanSql.includes('WHERE d.id = $1')) {
    const domain = inMemoryStore.domains.find((d) => d.id === params[0] && (params[1] ? d.user_id === params[1] : true));
    if (!domain) return { rows: [], rowCount: 0 };
    const sub = inMemoryStore.user_subscriptions.find((s) => s.domain_id === domain.id);
    const plan = sub ? inMemoryStore.hosting_plans.find((p) => p.id === sub.plan_id) : null;
    const row = {
      ...domain,
      subscription_id: sub?.id || null,
      plan_id: plan?.id || null,
      subscription_start: sub?.start_date || null,
      next_billing_date: sub?.next_billing_date || null,
      subscription_status: sub?.status || null,
      plan_name: plan?.plan_name || null,
      storage_gb: plan?.storage_gb || null,
      bandwidth_gb: plan?.bandwidth_gb || null,
      price_monthly: plan?.price_monthly || null,
    };
    return { rows: [row], rowCount: 1 };
  }

  if (cleanSql.includes('FROM domains WHERE id = $1')) {
    const domain = inMemoryStore.domains.find((d) => d.id === params[0]);
    return { rows: domain ? [domain] : [], rowCount: domain ? 1 : 0 };
  }

  if (cleanSql.includes('INSERT INTO domains')) {
    const newDomain = {
      id: crypto.randomUUID(),
      user_id: params[0],
      domain_name: params[1],
      registrar: params[2],
      purchase_date: params[3],
      expiry_date: params[4],
      status: params[5] || 'Active',
      created_at: new Date(),
    };
    inMemoryStore.domains.push(newDomain);
    return { rows: [newDomain], rowCount: 1 };
  }

  if (cleanSql.includes('UPDATE domains')) {
    const id = params[params.length - 1];
    const domain = inMemoryStore.domains.find((d) => d.id === id);
    if (domain) {
      if (params[0]) domain.domain_name = params[0];
      if (params[1]) domain.registrar = params[1];
      if (params[2]) domain.purchase_date = params[2];
      if (params[3]) domain.expiry_date = params[3];
      if (params[4] && params.length >= 7) domain.user_id = params[4];
      if (params[5]) domain.status = params[5];
    }
    return { rows: domain ? [domain] : [], rowCount: domain ? 1 : 0 };
  }

  if (cleanSql.includes('DELETE FROM domains')) {
    const id = params[0];
    const userId = params[1];
    const idx = inMemoryStore.domains.findIndex((d) => d.id === id && (!userId || d.user_id === userId));
    let deleted = null;
    if (idx !== -1) {
      deleted = inMemoryStore.domains[idx];
      inMemoryStore.domains.splice(idx, 1);
      inMemoryStore.user_subscriptions = inMemoryStore.user_subscriptions.filter((s) => s.domain_id !== id);
    }
    return { rows: deleted ? [deleted] : [], rowCount: deleted ? 1 : 0 };
  }

  if (cleanSql.includes('SELECT id FROM domains WHERE id = $1')) {
    const rows = inMemoryStore.domains.filter((d) => d.id === params[0] && (params[1] ? d.user_id === params[1] : true));
    return { rows, rowCount: rows.length };
  }

  if (cleanSql.includes('SELECT id, domain_name FROM domains WHERE id = $1')) {
    const rows = inMemoryStore.domains.filter((d) => d.id === params[0] && (params[1] ? d.user_id === params[1] : true));
    return { rows, rowCount: rows.length };
  }

  if (cleanSql.includes('SELECT expiry_date FROM domains WHERE user_id = $1')) {
    const rows = inMemoryStore.domains.filter((d) => d.user_id === params[0]).map((d) => ({ expiry_date: d.expiry_date }));
    return { rows, rowCount: rows.length };
  }

  // 5. CONTACT MESSAGES
  if (cleanSql.includes('INSERT INTO contact_messages')) {
    const newMsg = {
      id: crypto.randomUUID(),
      name: params[0],
      email: params[1],
      subject: params[2],
      message: params[3],
      status: 'open',
      created_at: new Date(),
    };
    inMemoryStore.contact_messages.unshift(newMsg);
    return { rows: [newMsg], rowCount: 1 };
  }

  if (cleanSql.includes('FROM contact_messages')) {
    let rows = [...inMemoryStore.contact_messages];
    if (params[0]) {
      rows = rows.filter((m) => m.status === params[0]);
    }
    return { rows, rowCount: rows.length };
  }

  if (cleanSql.includes('UPDATE contact_messages')) {
    const id = params[1];
    const newStatus = params[0];
    const msg = inMemoryStore.contact_messages.find((m) => m.id === id);
    if (msg) msg.status = newStatus;
    return { rows: msg ? [msg] : [], rowCount: msg ? 1 : 0 };
  }

  if (cleanSql.includes('SELECT status FROM contact_messages WHERE id = $1')) {
    const rows = inMemoryStore.contact_messages.filter((m) => m.id === params[0]);
    return { rows, rowCount: rows.length };
  }

  // 6. METRICS & DIRECTORIES
  if (cleanSql.includes('COUNT(*)::int AS count FROM users')) {
    return { rows: [{ count: inMemoryStore.users.length }] };
  }
  if (cleanSql.includes('COUNT(*)::int AS count FROM domains')) {
    return { rows: [{ count: inMemoryStore.domains.length }] };
  }
  if (cleanSql.includes("COUNT(*)::int AS count FROM user_subscriptions WHERE status = 'Active'")) {
    return { rows: [{ count: inMemoryStore.user_subscriptions.filter((s) => s.status === 'Active').length }] };
  }
  if (cleanSql.includes("COUNT(*)::int AS count FROM contact_messages WHERE status = 'open'")) {
    return { rows: [{ count: inMemoryStore.contact_messages.filter((m) => m.status === 'open').length }] };
  }
  if (cleanSql.includes('COUNT(*)::int AS count FROM hosting_plans')) {
    return { rows: [{ count: inMemoryStore.hosting_plans.filter((p) => p.is_active).length }] };
  }

  if (cleanSql.includes('FROM users u LEFT JOIN domains d')) {
    const rows = inMemoryStore.users.map((u) => {
      const userDomains = inMemoryStore.domains.filter((d) => d.user_id === u.id);
      const userSubs = inMemoryStore.user_subscriptions.filter((s) => s.user_id === u.id);
      return {
        id: u.id,
        email: u.email,
        role: u.role,
        created_at: u.created_at,
        domain_count: userDomains.length,
        subscription_count: userSubs.length,
      };
    });
    return { rows, rowCount: rows.length };
  }

  return { rows: [], rowCount: 0 };
};

export { pool };
export default { pool, query };
