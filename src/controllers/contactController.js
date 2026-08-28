import { query } from '../config/db.js';

/**
 * Submit a public contact message/inquiry
 * POST /api/contact
 */
export const submitContact = async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields (name, email, subject, message) are required.',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    const insertResult = await query(
      `INSERT INTO contact_messages (name, email, subject, message, status)
       VALUES ($1, $2, $3, $4, 'open')
       RETURNING *`,
      [name.trim(), email.trim().toLowerCase(), subject.trim(), message.trim()]
    );

    return res.status(201).json({
      success: true,
      message: 'Your inquiry has been received. Our support team will get back to you shortly.',
      ticket: insertResult.rows[0],
    });
  } catch (error) {
    next(error);
  }
};
