-- Domain & Hosting Management System (DHMS)
-- Database Schema for PostgreSQL / Neon / Supabase

-- 1. Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK (role IN ('user', 'admin')) DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Domains Table
CREATE TABLE IF NOT EXISTS domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    domain_name TEXT NOT NULL,
    registrar TEXT NOT NULL,
    purchase_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    status TEXT CHECK (status IN ('Active', 'Expiring Soon', 'Expired')) DEFAULT 'Active',
    domain_cost NUMERIC(10,2) DEFAULT 0.00,
    has_hosting BOOLEAN DEFAULT FALSE,
    hosting_registrar TEXT,
    hosting_purchase_date DATE,
    hosting_expiry_date DATE,
    hosting_cost NUMERIC(10,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Hosting Plans Table
CREATE TABLE IF NOT EXISTS hosting_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_name TEXT NOT NULL,
    storage_gb INT NOT NULL,
    bandwidth_gb INT NOT NULL,
    price_monthly NUMERIC(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. User Subscriptions Table
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

-- 6. Contact Messages Table
CREATE TABLE IF NOT EXISTS contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT CHECK (status IN ('open', 'closed')) DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for optimized querying and foreign keys
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_domains_user_id ON domains(user_id);
CREATE INDEX IF NOT EXISTS idx_domains_expiry ON domains(expiry_date);
CREATE INDEX IF NOT EXISTS idx_subs_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subs_domain_id ON user_subscriptions(domain_id);
CREATE INDEX IF NOT EXISTS idx_contact_status ON contact_messages(status);

-- Seed Initial Hosting Tiers
INSERT INTO hosting_plans (plan_name, storage_gb, bandwidth_gb, price_monthly, is_active)
SELECT 'Starter', 10, 100, 5.00, true
WHERE NOT EXISTS (SELECT 1 FROM hosting_plans WHERE plan_name = 'Starter');

INSERT INTO hosting_plans (plan_name, storage_gb, bandwidth_gb, price_monthly, is_active)
SELECT 'Business', 50, 500, 15.00, true
WHERE NOT EXISTS (SELECT 1 FROM hosting_plans WHERE plan_name = 'Business');

INSERT INTO hosting_plans (plan_name, storage_gb, bandwidth_gb, price_monthly, is_active)
SELECT 'Enterprise', 200, 2000, 30.00, true
WHERE NOT EXISTS (SELECT 1 FROM hosting_plans WHERE plan_name = 'Enterprise');
