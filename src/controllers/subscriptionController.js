import { query } from '../config/db.js';

/**
 * Retrieve user's linked subscriptions with joined domain and plan details
 * GET /api/subscriptions
 */
export const getSubscriptions = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT s.id,
              s.user_id,
              s.domain_id,
              s.plan_id,
              s.start_date,
              s.next_billing_date,
              s.status,
              s.created_at,
              d.domain_name,
              d.registrar,
              d.expiry_date AS domain_expiry,
              d.status AS domain_status,
              p.plan_name,
              p.storage_gb,
              p.bandwidth_gb,
              p.price_monthly
       FROM user_subscriptions s
       JOIN domains d ON s.domain_id = d.id
       JOIN hosting_plans p ON s.plan_id = p.id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      subscriptions: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Attach an active hosting plan to a registered domain owned by the user
 * POST /api/subscriptions
 */
export const createSubscription = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { domain_id, plan_id } = req.body;

    if (!domain_id || !plan_id) {
      return res.status(400).json({
        success: false,
        message: 'Both domain_id and plan_id are required.',
      });
    }

    // 1. Verify that the domain belongs to the logged-in user
    const domainCheck = await query(
      'SELECT id, domain_name FROM domains WHERE id = $1 AND user_id = $2',
      [domain_id, userId]
    );

    if (domainCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found or you do not have permission to attach hosting to it.',
      });
    }

    // 2. Verify that the plan exists and is active
    const planCheck = await query(
      'SELECT id, plan_name, price_monthly FROM hosting_plans WHERE id = $1 AND is_active = true',
      [plan_id]
    );

    if (planCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'The selected hosting plan is inactive or does not exist.',
      });
    }

    // 3. Check if the domain already has an active subscription; if so, update it or create new
    const existingSub = await query(
      'SELECT id FROM user_subscriptions WHERE domain_id = $1',
      [domain_id]
    );

    let subscription;
    if (existingSub.rows.length > 0) {
      // Update existing subscription to new plan
      const updateResult = await query(
        `UPDATE user_subscriptions
         SET plan_id = $1,
             start_date = CURRENT_DATE,
             next_billing_date = CURRENT_DATE + INTERVAL '30 days',
             status = 'Active'
         WHERE id = $2
         RETURNING *`,
        [plan_id, existingSub.rows[0].id]
      );
      subscription = updateResult.rows[0];
    } else {
      // Insert new subscription
      const insertResult = await query(
        `INSERT INTO user_subscriptions (user_id, domain_id, plan_id, start_date, next_billing_date, status)
         VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 'Active')
         RETURNING *`,
        [userId, domain_id, plan_id]
      );
      subscription = insertResult.rows[0];
    }

    return res.status(201).json({
      success: true,
      message: `Hosting plan '${planCheck.rows[0].plan_name}' attached to domain '${domainCheck.rows[0].domain_name}' successfully.`,
      subscription,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel or remove a subscription
 * DELETE /api/subscriptions/:id
 */
export const cancelSubscription = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await query(
      'DELETE FROM user_subscriptions WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found or unauthorized to cancel.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully.',
    });
  } catch (error) {
    next(error);
  }
};
