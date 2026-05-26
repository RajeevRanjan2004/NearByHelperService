import jwt from "jsonwebtoken";
import env from "../config/env.js";
import User from "../models/User.js";

async function requireAuth(request, response, next) {
  try {
    const authorizationHeader = request.headers.authorization || "";
    const token = authorizationHeader.startsWith("Bearer ")
      ? authorizationHeader.slice(7)
      : null;

    if (!token) {
      return response.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub);

    if (!user || !user.isActive) {
      return response.status(401).json({
        success: false,
        message: "Session is no longer valid",
      });
    }

    request.user = user;
    return next();
  } catch (_error) {
    return response.status(401).json({
      success: false,
      message: "Invalid or expired session",
    });
  }
}

export default requireAuth;
