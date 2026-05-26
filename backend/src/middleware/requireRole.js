function requireRole(...allowedRoles) {
  return function checkRole(request, response, next) {
    if (!request.user || !allowedRoles.includes(request.user.role)) {
      return response.status(403).json({
        success: false,
        message: "You do not have access to this resource",
      });
    }

    return next();
  };
}

export default requireRole;
