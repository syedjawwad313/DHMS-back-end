import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';

/**
 * Get global platform metrics for Admin Dashboard
 * GET /api/admin/metrics
 */
export const getMetrics = async (req, res, next) => {
  try {
    const [
      usersResult,
      domainsResult,
      subsResult,
      messagesResult,
      plansResult,
    ] = await Promise.all([
      query('SELECT COUNT(*)::int AS count FROM users'),
      query('SELECT COUNT(*)::int AS count FROM domains'),
      query("SELECT COUNT(*)::int AS count FROM user_subscriptions WHERE status = 'Active'"),
      query("SELECT COUNT(*)::int AS count FROM contact_messages WHERE status = 'open'"),
      query('SELECT COUNT(*)::int AS count FROM hosting_plans WHERE is_active = true'),
    ]);

    const totalUsers = usersResult.rows[0].count;
    const totalDomains = domainsResult.rows[0].count;
    const activeSubscriptions = subsResult.rows[0].count;
    const openTickets = messagesResult.rows[0].count;
    const activePlans = plansResult.rows[0].count;

    return res.status(200).json({
      success: true,
      metrics: {
        total_users: totalUsers,
        total_domains: totalDomains,
        active_subscriptions: activeSubscriptions,
        open_tickets: openTickets,
        active_plans: activePlans,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get list of all registered users with their domain and subscription counts
 * GET /api/admin/users
 */
export const getUsers = async (req, res, next) => {
  try {
    const sql = `
      SELECT u.id,
             u.email,
             u.role,
             u.is_suspended,
             u.created_at,
             COUNT(DISTINCT d.id)::int AS domain_count,
             COUNT(DISTINCT s.id)::int AS subscription_count
      FROM users u
      LEFT JOIN domains d ON u.id = d.user_id
      LEFT JOIN user_subscriptions s ON u.id = s.user_id
      GROUP BY u.id, u.email, u.role, u.is_suspended, u.created_at
      ORDER BY u.created_at DESC
    `;

    const result = await query(sql);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      users: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all contact messages with optional status filter
 * GET /api/admin/messages
 */
export const getMessages = async (req, res, next) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM contact_messages';
    const params = [];

    if (status && ['open', 'closed'].includes(status)) {
      params.push(status);
      sql += ' WHERE status = $1';
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      messages: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle or update contact message status ('open' | 'closed')
 * PATCH /api/admin/messages/:id
 */
export const updateMessageStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    let newStatus = status;

    // If status is not explicitly passed in body, toggle between open and closed
    if (!newStatus) {
      const current = await query('SELECT status FROM contact_messages WHERE id = $1', [id]);
      if (current.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Contact message not found.',
        });
      }
      newStatus = current.rows[0].status === 'open' ? 'closed' : 'open';
    }

    if (!['open', 'closed'].includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'open' or 'closed'.",
      });
    }

    const result = await query(
      `UPDATE contact_messages
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [newStatus, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Message marked as ${newStatus}.`,
      ticket: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new hosting plan (Admin only)
 * POST /api/admin/plans
 */
export const createPlan = async (req, res, next) => {
  try {
    const { plan_name, storage_gb, bandwidth_gb, price_monthly, is_active = true } = req.body;

    if (!plan_name || storage_gb === undefined || bandwidth_gb === undefined || price_monthly === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Plan name, storage (GB), bandwidth (GB), and monthly price are required.',
      });
    }

    const result = await query(
      `INSERT INTO hosting_plans (plan_name, storage_gb, bandwidth_gb, price_monthly, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [plan_name.trim(), parseInt(storage_gb, 10), parseInt(bandwidth_gb, 10), parseFloat(price_monthly), Boolean(is_active)]
    );

    return res.status(201).json({
      success: true,
      message: 'Hosting plan created successfully.',
      plan: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing hosting plan (Admin only)
 * PUT /api/admin/plans/:id
 */
export const updatePlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { plan_name, storage_gb, bandwidth_gb, price_monthly, is_active } = req.body;

    const check = await query('SELECT * FROM hosting_plans WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Hosting plan not found.',
      });
    }

    const current = check.rows[0];

    const updatedPlanName = plan_name !== undefined ? plan_name.trim() : current.plan_name;
    const updatedStorage = storage_gb !== undefined ? parseInt(storage_gb, 10) : current.storage_gb;
    const updatedBandwidth = bandwidth_gb !== undefined ? parseInt(bandwidth_gb, 10) : current.bandwidth_gb;
    const updatedPrice = price_monthly !== undefined ? parseFloat(price_monthly) : current.price_monthly;
    const updatedActive = is_active !== undefined ? Boolean(is_active) : current.is_active;

    const result = await query(
      `UPDATE hosting_plans
       SET plan_name = $1,
           storage_gb = $2,
           bandwidth_gb = $3,
           price_monthly = $4,
           is_active = $5
       WHERE id = $6
       RETURNING *`,
      [updatedPlanName, updatedStorage, updatedBandwidth, updatedPrice, updatedActive, id]
    );

    return res.status(200).json({
      success: true,
      message: 'Hosting plan updated successfully.',
      plan: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle plan active status or delete (Admin only)
 * DELETE /api/admin/plans/:id
 */
export const deletePlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { hardDelete } = req.query;

    const check = await query('SELECT * FROM hosting_plans WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Hosting plan not found.',
      });
    }

    // Check if subscriptions are referencing this plan
    const subCheck = await query('SELECT id FROM user_subscriptions WHERE plan_id = $1 LIMIT 1', [id]);

    if (hardDelete === 'true') {
      if (subCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot permanently delete plan because users have active subscriptions linked to it. You can deactivate the plan instead.',
        });
      }

      await query('DELETE FROM hosting_plans WHERE id = $1', [id]);
      return res.status(200).json({
        success: true,
        message: `Hosting plan '${check.rows[0].plan_name}' permanently deleted.`,
      });
    }

    // Toggle is_active status
    const result = await query(
      'UPDATE hosting_plans SET is_active = NOT is_active WHERE id = $1 RETURNING *',
      [id]
    );

    return res.status(200).json({
      success: true,
      message: `Hosting plan '${result.rows[0].plan_name}' is now ${result.rows[0].is_active ? 'Active' : 'Inactive'}.`,
      plan: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all domains platform-wide for Admin
 * GET /api/admin/domains
 */
export const getAdminDomains = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT d.*, 
             u.email AS user_email,
             s.id AS subscription_id, 
             s.plan_id,
             p.plan_name,
             p.price_monthly
      FROM domains d
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN user_subscriptions s ON d.id = s.domain_id
      LEFT JOIN hosting_plans p ON s.plan_id = p.id
      ORDER BY d.expiry_date ASC, d.created_at DESC
    `);

    // Helper dynamic status import
    const { formatDomainWithStatus } = await import('../utils/statusHelper.js');
    const domains = result.rows.map(formatDomainWithStatus);

    return res.status(200).json({
      success: true,
      count: domains.length,
      domains,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin Create Domain for any user
 * POST /api/admin/domains
 */
export const createAdminDomain = async (req, res, next) => {
  try {
    const {
      user_id,
      domain_name,
      registrar,
      purchase_date,
      expiry_date,
      domain_cost = 0.00,
      has_hosting = false,
      hosting_registrar = null,
      hosting_purchase_date = null,
      hosting_expiry_date = null,
      hosting_cost = 0.00,
    } = req.body;

    if (!user_id || !domain_name || !registrar || !purchase_date || !expiry_date) {
      return res.status(400).json({
        success: false,
        message: 'User ID, Domain name, registrar, purchase date, and expiry date are required.',
      });
    }

    const isHosting = Boolean(has_hosting);
    const finalHostingRegistrar = isHosting && hosting_registrar ? hosting_registrar.trim() : null;
    const finalHostingPurchaseDate = isHosting && hosting_purchase_date ? hosting_purchase_date : null;
    const finalHostingExpiryDate = isHosting && hosting_expiry_date ? hosting_expiry_date : null;
    const finalHostingCost = isHosting && hosting_cost ? parseFloat(hosting_cost) : 0.00;
    const finalDomainCost = domain_cost ? parseFloat(domain_cost) : 0.00;

    const { calculateDomainStatus, formatDomainWithStatus } = await import('../utils/statusHelper.js');
    const dynamicStatus = calculateDomainStatus(expiry_date);

    const insertResult = await query(
      `INSERT INTO domains (
        user_id,
        domain_name,
        registrar,
        purchase_date,
        expiry_date,
        status,
        domain_cost,
        has_hosting,
        hosting_registrar,
        hosting_purchase_date,
        hosting_expiry_date,
        hosting_cost
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        user_id,
        domain_name.trim().toLowerCase(),
        registrar.trim(),
        purchase_date,
        expiry_date,
        dynamicStatus,
        finalDomainCost,
        isHosting,
        finalHostingRegistrar,
        finalHostingPurchaseDate,
        finalHostingExpiryDate,
        finalHostingCost,
      ]
    );

    const newDomain = formatDomainWithStatus(insertResult.rows[0]);

    return res.status(201).json({
      success: true,
      message: 'Domain registered by administrator successfully.',
      domain: newDomain,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin Update Domain details
 * PUT /api/admin/domains/:id
 */
export const updateAdminDomain = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      domain_name,
      registrar,
      purchase_date,
      expiry_date,
      user_id,
      domain_cost,
      has_hosting,
      hosting_registrar,
      hosting_purchase_date,
      hosting_expiry_date,
      hosting_cost,
    } = req.body;

    const check = await query('SELECT * FROM domains WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found.',
      });
    }

    const { calculateDomainStatus, formatDomainWithStatus } = await import('../utils/statusHelper.js');
    const dynamicStatus = expiry_date ? calculateDomainStatus(expiry_date) : check.rows[0].status;

    const isHosting = has_hosting !== undefined ? Boolean(has_hosting) : check.rows[0].has_hosting;
    const finalHostingRegistrar = isHosting ? (hosting_registrar ? hosting_registrar.trim() : check.rows[0].hosting_registrar) : null;
    const finalHostingPurchaseDate = isHosting ? (hosting_purchase_date || check.rows[0].hosting_purchase_date) : null;
    const finalHostingExpiryDate = isHosting ? (hosting_expiry_date || check.rows[0].hosting_expiry_date) : null;
    const finalHostingCost = isHosting ? (hosting_cost !== undefined ? parseFloat(hosting_cost) : check.rows[0].hosting_cost) : 0.00;
    const finalDomainCost = domain_cost !== undefined ? parseFloat(domain_cost) : check.rows[0].domain_cost || 0.00;

    const result = await query(
      `UPDATE domains
       SET domain_name = COALESCE($1, domain_name),
           registrar = COALESCE($2, registrar),
           purchase_date = COALESCE($3, purchase_date),
           expiry_date = COALESCE($4, expiry_date),
           user_id = COALESCE($5, user_id),
           status = $6,
           domain_cost = $7,
           has_hosting = $8,
           hosting_registrar = $9,
           hosting_purchase_date = $10,
           hosting_expiry_date = $11,
           hosting_cost = $12
       WHERE id = $13
       RETURNING *`,
      [
        domain_name ? domain_name.trim().toLowerCase() : null,
        registrar ? registrar.trim() : null,
        purchase_date || null,
        expiry_date || null,
        user_id || null,
        dynamicStatus,
        finalDomainCost,
        isHosting,
        finalHostingRegistrar,
        finalHostingPurchaseDate,
        finalHostingExpiryDate,
        finalHostingCost,
        id,
      ]
    );

    const updated = formatDomainWithStatus(result.rows[0]);

    return res.status(200).json({
      success: true,
      message: 'Domain updated by administrator successfully.',
      domain: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin Delete Domain
 * DELETE /api/admin/domains/:id
 */
export const deleteAdminDomain = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM domains WHERE id = $1 RETURNING id, domain_name', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Domain '${result.rows[0].domain_name}' deleted by administrator.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin Delete User
 * DELETE /api/admin/users/:id
 */
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Self-deletion protection
    if (req.user && req.user.id === id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own admin account.',
      });
    }

    const check = await query('SELECT id, email, role FROM users WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    const targetUser = check.rows[0];

    // Delete user from database (Foreign keys automatically cascade to domains and subscriptions)
    await query('DELETE FROM users WHERE id = $1', [id]);

    return res.status(200).json({
      success: true,
      message: `User account '${targetUser.email}' and all associated domains/records removed successfully.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin Provision New User
 * POST /api/admin/users
 */
export const createUser = async (req, res, next) => {
  try {
    const { email, password, role = 'user' } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Temporary password must be at least 6 characters long.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const sanitizedRole = role === 'admin' ? 'admin' : 'user';

    const check = await query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    if (check.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const insertResult = await query(
      `INSERT INTO users (email, password_hash, role, is_suspended)
       VALUES ($1, $2, $3, false)
       RETURNING id, email, role, is_suspended, created_at`,
      [normalizedEmail, passwordHash, sanitizedRole]
    );

    const newUser = insertResult.rows[0];

    return res.status(201).json({
      success: true,
      message: `User account '${newUser.email}' provisioned successfully.`,
      user: newUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin Toggle User Suspension
 * PATCH /api/admin/users/:id/suspend
 */
export const toggleUserSuspension = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Self-suspension protection
    if (req.user && req.user.id === id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot suspend your own active administrator account.',
      });
    }

    const check = await query('SELECT id, email, role, is_suspended FROM users WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    const result = await query(
      'UPDATE users SET is_suspended = NOT is_suspended WHERE id = $1 RETURNING id, email, role, is_suspended',
      [id]
    );

    const updatedUser = result.rows[0];
    const actionText = updatedUser.is_suspended ? 'suspended' : 'reactivated';

    return res.status(200).json({
      success: true,
      message: `User '${updatedUser.email}' has been ${actionText} successfully.`,
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};
