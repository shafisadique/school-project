const isSuperAdmin = (req, res, next) => {
    if (req.user.role === 'superadmin') {
      next();
    } else {
      res.status(403).json({ message: 'Access denied: Super Admin only' });
    }
  };
  
  const isAdmin = (req, res, next) => {
    if (req.user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ message: 'Access denied: Admin only' });
    }
  };
  
  const isTeacher = (req, res, next) => {
    if (req.user.role === 'teacher') {
      next();
    } else {
      res.status(403).json({ message: 'Access denied: Teacher only' });
    }
  };
  
  const isStudent = (req, res, next) => {
    if (req.user.role === 'student') {
      next();
    } else {
      res.status(403).json({ message: 'Access denied: Student only' });
    }
  };
  
  const isParent = (req, res, next) => {
    if (req.user.role === 'parent') {
      next();
    } else {
      res.status(403).json({ message: 'Access denied: Parent only' });
    }
  };

  const roleMiddleware = (...allowedRoles) => {
    return (req, res, next) => {
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
      }
      next();
    };
  };
   
  const externalRoleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    console.log('Allowed roles:', allowedRoles); // Debug the raw input
    const flattenedRoles = Array.isArray(allowedRoles[0]) ? allowedRoles[0] : allowedRoles;
    console.log('Flattened allowed roles:', flattenedRoles);
    const userRole = req.user?.role; // Safely access role
    console.log('User role:', userRole, typeof userRole); // Log type to debug
    if (!req.user || !flattenedRoles.includes(String(userRole))) { // Convert to string if needed
      console.log('Access denied due to role mismatch');
      return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
    }
    next();
  };
};
  
  module.exports = { isSuperAdmin, isAdmin, isTeacher, isStudent, isParent ,roleMiddleware,externalRoleMiddleware};