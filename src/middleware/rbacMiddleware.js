export const rbacMiddleware = (requiredRole = 'admin') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. Authentication required.',
      });
    }

    const userRole = req.user.role ? req.user.role.toLowerCase().trim() : '';
    const targetRole = requiredRole.toLowerCase().trim();

    if (userRole !== targetRole) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Requires '${requiredRole}' role to access this resource.`,
      });
    }

    next();
  };
};

export const requireAdmin = rbacMiddleware('admin');

export default rbacMiddleware;
