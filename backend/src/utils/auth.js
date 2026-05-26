import jwt from "jsonwebtoken";
import env from "../config/env.js";

function createToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
    },
    env.jwtSecret,
    {
      expiresIn: "7d",
    }
  );
}

function sanitizeUser(user) {
  const item = user && typeof user.toObject === "function" ? user.toObject() : user;

  return {
    id: item._id?.toString?.() || item.id,
    fullName: item.fullName,
    email: item.email,
    phone: item.phone,
    avatarUrl: item.avatarUrl || "",
    savedAddresses: Array.isArray(item.savedAddresses)
      ? item.savedAddresses.map((address) => ({
          id: address._id?.toString?.() || address.id || "",
          label: address.label || "",
          addressLine1: address.addressLine1 || "",
          addressLine2: address.addressLine2 || "",
          city: address.city || "",
          state: address.state || "",
          postalCode: address.postalCode || "",
        }))
      : [],
    role: item.role,
    isActive: item.isActive,
  };
}

export { createToken, sanitizeUser };
