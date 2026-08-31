# Domain & Hosting Management System (DHMS)

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black?style=flat&logo=next.js)](https://nextjs.org/)
[![Express.js](https://img.shields.io/badge/Backend-Express.js-green?style=flat&logo=express)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%2F%20Neon-blue?style=flat&logo=postgresql)](https://neon.tech/)
[![TailwindCSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A scalable, production-grade **Domain & Hosting Management System (DHMS)** engineered with a modular REST API backend (Node.js & Express), PostgreSQL database (Neon / Supabase), and a Next.js 14 App Router frontend with Tailwind CSS styling and Role-Based Access Control (RBAC).

---

## 📑 Table of Contents

1. [Architecture & System Design](#-architecture--system-design)
2. [Mandatory Tech Stack](#-mandatory-tech-stack)
3. [Core Functional Modules](#-core-functional-modules)
4. [Test Accounts & Credentials](#-test-accounts--verification-credentials)
5. [Local Development & Setup](#-local-development--setup)
6. [Database Schema & Migrations](#-database-schema--migrations)
7. [REST API Endpoint Reference](#-rest-api-endpoint-reference)
8. [Postman Collection](#-postman-collection)
9. [Production Deployment Guide](#-production-deployment-guide)

---

## 🏗 Architecture & System Design

```mermaid
graph TD
    Client[Next.js 14 Client App Router] -->|Bearer JWT / REST| API[Express.js REST API Server]
    API -->|Auth / RBAC Guards| Controllers[Controllers: Domains, Plans, Subscriptions, Admin]
    Controllers -->|pg.Pool with SSL| DB[(PostgreSQL / Neon / Supabase)]
    
    subgraph Frontend Layer
        Client --> Pages[Landing, Contact, Login, Register]
        Client --> UserDash[User Dashboard: Domain CRUD & Hosting Link]
        Client --> AdminDash[Admin Console: Metrics, Directory, Tickets, Plans]
    end

    subgraph Backend Layer
        API --> AuthMW[authMiddleware.js - JWT Verification]
        API --> RbacMW[rbacMiddleware.js - Admin Guard]
        API --> StatusHelper[statusHelper.js - Dynamic Expiry Calculator]
    end
```

### Monorepo Structure
```
DHMS/
├── backend/
│   ├── database/
│   │   └── schema.sql              # Database schema with UUIDs & seed plans
│   ├── scripts/
│   │   └── seed.js                 # Seed script (Demo User, Demo Admin, Plans)
│   ├── src/
│   │   ├── config/db.js            # PostgreSQL connection pool with SSL
│   │   ├── controllers/            # Auth, Domains, Plans, Subscriptions, Contact, Admin
│   │   ├── middleware/             # JWT authMiddleware, rbacMiddleware, errorHandler
│   │   ├── routes/                 # Express route definitions
│   │   ├── utils/statusHelper.js   # Dynamic domain status calculator (<=30d, <0d)
│   │   └── server.js               # Express application entry point
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── app/
│   │   ├── admin/page.js           # Admin Dashboard & telemetry
│   │   ├── contact/page.js         # Dynamic contact form
│   │   ├── dashboard/page.js       # Client domain management & hosting attachment
│   │   ├── login/page.js           # Login with 1-click Demo credentials
│   │   ├── register/page.js        # Registration with role toggle
│   │   ├── globals.css             # Glassmorphic utilities & dark theme
│   │   ├── layout.js               # Root layout with AuthProvider & Navbar
│   │   └── page.js                 # Landing page with domain lookup simulator & pricing
│   ├── components/                 # Modals, Badges, Toast, Navbar, Footer, RouteGuards
│   ├── context/AuthContext.js      # Session hydration & JWT storage
│   ├── lib/api.js                  # Axios client with automatic Bearer interceptor
│   ├── .env.example
│   └── tailwind.config.js
│
├── dhms_postman_collection.json    # Complete Postman Collection v2.1.0
└── README.md                       # Documentation & Deployment Guide
```

---

## 🛠 Mandatory Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14 (App Router), React 18 | Client & Server Components, fast hydration |
| **Styling** | Tailwind CSS & Glassmorphism | Custom dark slate palette, responsive grids, micro-animations |
| **Backend API** | Node.js (ESM), Express.js | Modular RESTful architecture with CORS & JSON body parsing |
| **Database** | PostgreSQL (Neon / Supabase) | Relational database with UUIDs (`pgcrypto`), foreign keys, and indexes |
| **Authentication** | JWT (`jsonwebtoken`) & `bcryptjs` | Bearer token auth with salted password hashing |
| **Icons & Utilities** | Lucide React, Axios, clsx | Modern iconography and HTTP client |

---

## 🔐 Test Accounts & Verification Credentials

For assessment and grading evaluation, use the pre-configured credentials below to test Role-Based Access Control (RBAC):

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Demo Admin** | `admin@dhms.com` | `AdminPass123!` | Full SuperAdmin Authority (`/admin`): Metrics telemetry, user suspension/deletion, plan CRUD, domain provisioning, support ticket toggling |
| **Demo User** | `user@dhms.com` | `UserPass123!` | Standard Client Portal (`/dashboard`): Personal domain CRUD, dynamic expiry alerts, hosting plan attachment |

> 💡 **Quick Fill:** The `/login` page includes 1-click autofill buttons for both test accounts.

---

### 🚀 Live Production Links
- **Frontend (Vercel)**: `https://<your-frontend-vercel-url>.vercel.app`
- **Backend REST API (Render)**: `https://<your-backend-render-url>.onrender.com`
- **API Base Endpoint**: `https://<your-backend-render-url>.onrender.com/api`
- **Postman Collection**: `dhms_postman_collection.json` (located at repository root)

---

## 🚀 Local Development & Setup

### Prerequisites
- Node.js `v18.x` or later
- PostgreSQL database instance (local or hosted on [Neon.tech](https://neon.tech) / [Supabase](https://supabase.com))

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/dhms.git
cd DHMS
```

### 2. Backend Setup
```bash
cd backend
npm install

# Configure environment variables
cp .env.example .env
```

Edit `backend/.env`:
```env
PORT=5000
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
JWT_SECRET=dhms_super_secret_jwt_key_2026
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

#### Run Database Seed Script
```bash
node scripts/seed.js
```
*This command creates the schema tables, default hosting tiers (Starter, Business, Enterprise), demo accounts, sample domains, and sample contact inquiries.*

#### Start Backend Server
```bash
npm run dev
# Server runs on http://localhost:5000
# Health check: http://localhost:5000/api/health
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install

# Configure environment variables
cp .env.example .env.local
```

Edit `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

#### Start Frontend Application
```bash
npm run dev
# Next.js development server runs on http://localhost:3000
```

---

## 📊 Database Schema & Migrations

The database is built on PostgreSQL with the following relational structure:

```sql
-- 1. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK (role IN ('user', 'admin')) DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Domains Table
CREATE TABLE domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    domain_name TEXT NOT NULL,
    registrar TEXT NOT NULL,
    purchase_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    status TEXT CHECK (status IN ('Active', 'Expiring Soon', 'Expired')) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Hosting Plans Table
CREATE TABLE hosting_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_name TEXT NOT NULL,
    storage_gb INT NOT NULL,
    bandwidth_gb INT NOT NULL,
    price_monthly NUMERIC(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. User Subscriptions Table
CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES hosting_plans(id) ON DELETE RESTRICT,
    start_date DATE DEFAULT CURRENT_DATE,
    next_billing_date DATE NOT NULL,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Contact Messages Table
CREATE TABLE contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT CHECK (status IN ('open', 'closed')) DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Dynamic Domain Status Resolution Logic
- **`Expired`**: `expiry_date < CURRENT_DATE` (0 days or overdue)
- **`Expiring Soon`**: `expiry_date - CURRENT_DATE <= 30 days`
- **`Active`**: `expiry_date - CURRENT_DATE > 30 days`

---

## 📡 REST API Endpoint Reference

### Authentication (`/api/auth`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register user (`email`, `password`, `role`) |
| `POST` | `/api/auth/login` | Public | Log in user and receive signed JWT |
| `GET` | `/api/auth/me` | Bearer | Get authenticated user profile details |

### Domain Management (`/api/domains`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/domains` | Bearer | Get all user domains with computed status |
| `GET` | `/api/domains/:id` | Bearer | Get single domain by ID with subscription info |
| `POST` | `/api/domains` | Bearer | Create a new domain record |
| `PUT` | `/api/domains/:id` | Bearer | Update domain details |
| `DELETE`| `/api/domains/:id` | Bearer | Delete domain and linked subscriptions |

### Hosting Plans & Subscriptions (`/api/plans` & `/api/subscriptions`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/plans` | Public | List all active hosting tiers |
| `GET` | `/api/plans/:id` | Public | Get single hosting plan details |
| `GET` | `/api/subscriptions` | Bearer | Retrieve user's linked subscriptions with plan specs |
| `POST` | `/api/subscriptions` | Bearer | Attach active hosting plan to registered domain |
| `DELETE`| `/api/subscriptions/:id`| Bearer | Cancel / remove hosting subscription |

### Contact & Support (`/api/contact`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/contact` | Public | Submit support inquiry into `contact_messages` |

### Admin Management (`/api/admin` - Role: `admin` required)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/metrics` | Admin | Total users, domains, active subs, open tickets |
| `GET` | `/api/admin/users` | Admin | Registered user directory with domain counts |
| `GET` | `/api/admin/messages` | Admin | List all submitted support tickets |
| `PATCH` | `/api/admin/messages/:id` | Admin | Toggle inquiry status (`open` / `closed`) |
| `POST` | `/api/admin/plans` | Admin | Create a new hosting tier |
| `PUT` | `/api/admin/plans/:id` | Admin | Update hosting tier specifications |
| `DELETE`| `/api/admin/plans/:id` | Admin | Toggle plan active status or delete |

---

## 📬 Postman Collection

Import `dhms_postman_collection.json` located in the project root:
1. Open **Postman** -> Click **Import** -> Select `dhms_postman_collection.json`.
2. The collection uses variables `{{baseUrl}}` (defaults to `http://localhost:5000/api`), `{{authToken}}`, and `{{adminToken}}`.
3. Executing **Login User** or **Login Admin** automatically saves the returned JWT into the collection variables for subsequent requests.

---

## ☁️ Production Deployment Guide

### 1. Database (Neon / Supabase)
1. Create a new PostgreSQL database on [Neon.tech](https://neon.tech) or [Supabase](https://supabase.com).
2. Copy the Connection String URI (with SSL enabled).
3. Execute `backend/database/schema.sql` in the SQL Editor or run `node scripts/seed.js` with `DATABASE_URL` set.

### 2. Backend Deployment (Render / Railway)
1. Push this repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com/):
   - Click **New Web Service** -> Connect GitHub repo.
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/server.js`
3. Add Environment Variables:
   - `PORT` = `5000`
   - `DATABASE_URL` = `<Your_PostgreSQL_Connection_String>`
   - `JWT_SECRET` = `<Your_Production_JWT_Secret>`
   - `CLIENT_URL` = `https://your-frontend-app.vercel.app`
   - `NODE_ENV` = `production`

### 3. Frontend Deployment (Vercel)
1. In [Vercel Dashboard](https://vercel.com/):
   - Click **Add New Project** -> Connect GitHub repo.
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Next.js`
2. Add Environment Variables:
   - `NEXT_PUBLIC_API_URL` = `https://your-backend-api.onrender.com/api`
3. Click **Deploy**.

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
