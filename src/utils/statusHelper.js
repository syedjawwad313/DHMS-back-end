/**
 * Calculates dynamic domain status based on expiry_date
 * @param {string|Date} expiryDate 
 * @returns {'Active' | 'Expiring Soon' | 'Expired'}
 */
export const calculateDomainStatus = (expiryDate) => {
  if (!expiryDate) return 'Active';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'Expired';
  } else if (diffDays <= 30) {
    return 'Expiring Soon';
  } else {
    return 'Active';
  }
};

/**
 * Calculates days remaining until expiry
 * @param {string|Date} expiryDate 
 * @returns {number}
 */
export const calculateDaysRemaining = (expiryDate) => {
  if (!expiryDate) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Formats domain object with dynamic status and days remaining
 * @param {Object} domain 
 * @returns {Object}
 */
export const formatDomainWithStatus = (domain) => {
  const dynamicStatus = calculateDomainStatus(domain.expiry_date);
  const daysRemaining = calculateDaysRemaining(domain.expiry_date);

  return {
    ...domain,
    status: dynamicStatus,
    days_remaining: daysRemaining,
  };
};
