/**
 * requireRole — RBAC middleware
 * Usage:
 *   requireRole('OWNER')                     — only OWNER
 *   requireRole(['OWNER', 'MANAGER'])         — OWNER or MANAGER
 */
const requireRole = (roles) => {
  const allowed = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: not authenticated' });
    }

    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: requires role ${allowed.join(' or ')}`,
        yourRole: req.user.role,
      });
    }

    next();
  };
};

module.exports = { requireRole };