import { query } from '../config/db.js';

/**
 * Get all active hosting tiers
 * GET /api/plans
 */
export const getPlans = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM hosting_plans WHERE is_active = true ORDER BY price_monthly ASC'
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      plans: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single plan by ID
 * GET /api/plans/:id
 */
export const getPlanById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM hosting_plans WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Hosting plan not found.',
      });
    }

    return res.status(200).json({
      success: true,
      plan: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};
