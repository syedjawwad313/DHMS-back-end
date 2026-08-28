import { query } from '../config/db.js';
import { calculateDomainStatus, formatDomainWithStatus } from '../utils/statusHelper.js';

/**
 * Get all domains for the logged-in user with dynamic status calculations
 * GET /api/domains
 */
export const getDomains = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status, search } = req.query;

    let sql = `
      SELECT d.*, 
             s.id AS subscription_id, 
             s.plan_id,
             p.plan_name,
             p.price_monthly
      FROM domains d
      LEFT JOIN user_subscriptions s ON d.id = s.domain_id
      LEFT JOIN hosting_plans p ON s.plan_id = p.id
      WHERE d.user_id = $1
    `;
    const params = [userId];

    if (search && search.trim() !== '') {
      params.push(`%${search.trim().toLowerCase()}%`);
      sql += ` AND (LOWER(d.domain_name) LIKE $${params.length} OR LOWER(d.registrar) LIKE $${params.length})`;
    }

    sql += ` ORDER BY d.expiry_date ASC, d.created_at DESC`;

    const result = await query(sql, params);

    // Format each domain with dynamic status calculation
    let domains = result.rows.map(formatDomainWithStatus);

    // Filter by calculated dynamic status if requested in query
    if (status && ['Active', 'Expiring Soon', 'Expired'].includes(status)) {
      domains = domains.filter((d) => d.status === status);
    }

    // Calculate aggregated metrics for the user
    const allUserDomainsResult = await query(
      'SELECT expiry_date FROM domains WHERE user_id = $1',
      [userId]
    );

    const allFormatted = allUserDomainsResult.rows.map(formatDomainWithStatus);
    const metrics = {
      total: allFormatted.length,
      active: allFormatted.filter((d) => d.status === 'Active').length,
      expiring_soon: allFormatted.filter((d) => d.status === 'Expiring Soon').length,
      expired: allFormatted.filter((d) => d.status === 'Expired').length,
    };

    return res.status(200).json({
      success: true,
      count: domains.length,
      metrics,
      domains,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single domain by ID
 * GET /api/domains/:id
 */
export const getDomainById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await query(
      `SELECT d.*, 
              s.id AS subscription_id, 
              s.plan_id,
              s.start_date AS subscription_start,
              s.next_billing_date,
              s.status AS subscription_status,
              p.plan_name,
              p.storage_gb,
              p.bandwidth_gb,
              p.price_monthly
       FROM domains d
       LEFT JOIN user_subscriptions s ON d.id = s.domain_id
       LEFT JOIN hosting_plans p ON s.plan_id = p.id
       WHERE d.id = $1 AND d.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found or access unauthorized.',
      });
    }

    const domain = formatDomainWithStatus(result.rows[0]);

    return res.status(200).json({
      success: true,
      domain,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new domain
 * POST /api/domains
 */
export const createDomain = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { domain_name, registrar, purchase_date, expiry_date } = req.body;

    if (!domain_name || !registrar || !purchase_date || !expiry_date) {
      return res.status(400).json({
        success: false,
        message: 'Domain name, registrar, purchase date, and expiry date are required.',
      });
    }

    const normalizedDomain = domain_name.trim().toLowerCase();
    const dynamicStatus = calculateDomainStatus(expiry_date);

    const insertResult = await query(
      `INSERT INTO domains (user_id, domain_name, registrar, purchase_date, expiry_date, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, normalizedDomain, registrar.trim(), purchase_date, expiry_date, dynamicStatus]
    );

    const newDomain = formatDomainWithStatus(insertResult.rows[0]);

    return res.status(201).json({
      success: true,
      message: 'Domain registered successfully.',
      domain: newDomain,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing domain
 * PUT /api/domains/:id
 */
export const updateDomain = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { domain_name, registrar, purchase_date, expiry_date } = req.body;

    // Verify ownership
    const checkResult = await query(
      'SELECT id FROM domains WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found or unauthorized to update.',
      });
    }

    const dynamicStatus = calculateDomainStatus(expiry_date);

    const updateResult = await query(
      `UPDATE domains
       SET domain_name = COALESCE($1, domain_name),
           registrar = COALESCE($2, registrar),
           purchase_date = COALESCE($3, purchase_date),
           expiry_date = COALESCE($4, expiry_date),
           status = $5
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [
        domain_name ? domain_name.trim().toLowerCase() : null,
        registrar ? registrar.trim() : null,
        purchase_date || null,
        expiry_date || null,
        dynamicStatus,
        id,
        userId,
      ]
    );

    const updatedDomain = formatDomainWithStatus(updateResult.rows[0]);

    return res.status(200).json({
      success: true,
      message: 'Domain updated successfully.',
      domain: updatedDomain,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a domain
 * DELETE /api/domains/:id
 */
export const deleteDomain = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await query(
      'DELETE FROM domains WHERE id = $1 AND user_id = $2 RETURNING id, domain_name',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found or unauthorized to delete.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Domain ${result.rows[0].domain_name} deleted successfully.`,
    });
  } catch (error) {
    next(error);
  }
};
