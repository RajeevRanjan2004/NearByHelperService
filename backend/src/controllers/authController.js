import crypto from "crypto";
import bcrypt from "bcryptjs";
import HelperProfile from "../models/HelperProfile.js";
import User from "../models/User.js";
import { createToken, sanitizeUser } from "../utils/auth.js";
import { isEmailOtpConfigured, sendOtpEmail } from "../utils/email.js";
import { normalizeAvatarUrl } from "../utils/profile.js";
import {
  checkTwilioVerification,
  isTwilioVerifyConfigured,
  normalizeVerificationTarget,
  startTwilioVerification,
} from "../utils/twilioVerify.js";

const OTP_TTL_MS = 10 * 60 * 1000;

function validateRegisterPayload(body) {
  const requiredFields = ["fullName", "email", "phone", "password", "role"];
  const missingFields = requiredFields.filter((field) => !body[field]);

  if (missingFields.length) {
    return `Missing required fields: ${missingFields.join(", ")}`;
  }

  if (!["customer", "helper"].includes(body.role)) {
    return "Role must be either customer or helper";
  }

  if (String(body.password).length < 6) {
    return "Password must be at least 6 characters long";
  }

  return null;
}

function normalizeSavedAddress(address = {}) {
  return {
    label: String(address.label || "").trim(),
    addressLine1: String(address.addressLine1 || "").trim(),
    addressLine2: String(address.addressLine2 || "").trim(),
    city: String(address.city || "").trim(),
    state: String(address.state || "").trim(),
    postalCode: String(address.postalCode || "").trim(),
  };
}

function validateSavedAddresses(savedAddresses) {
  if (savedAddresses === undefined) {
    return null;
  }

  if (!Array.isArray(savedAddresses)) {
    return "Saved addresses must be a list";
  }

  if (savedAddresses.length > 6) {
    return "You can save up to 6 addresses";
  }

  for (const address of savedAddresses) {
    const item = normalizeSavedAddress(address);
    const requiredFields = ["label", "addressLine1", "city", "state", "postalCode"];
    const missingFields = requiredFields.filter((field) => !item[field]);

    if (missingFields.length) {
      return `Each saved address requires: ${missingFields.join(", ")}`;
    }

    if (
      item.label.length > 40 ||
      item.addressLine1.length > 160 ||
      item.addressLine2.length > 160 ||
      item.city.length > 60 ||
      item.state.length > 60 ||
      item.postalCode.length > 20
    ) {
      return "Saved address fields are too long";
    }
  }

  return null;
}

function normalizeSavedAddresses(savedAddresses = []) {
  return savedAddresses.map(normalizeSavedAddress);
}

function normalizeIdentifier(identifier) {
  return String(identifier || "").trim();
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(String(otp)).digest("hex");
}

function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function getOtpExpiry() {
  return new Date(Date.now() + OTP_TTL_MS);
}

async function findUserByIdentifier(identifier) {
  const normalizedIdentifier = normalizeIdentifier(identifier);

  if (!normalizedIdentifier) {
    return null;
  }

  return User.findOne({
    $or: [{ email: normalizedIdentifier.toLowerCase() }, { phone: normalizedIdentifier }],
  });
}

function clearResetPasswordOtp(user) {
  user.resetPasswordOtpHash = "";
  user.resetPasswordOtpExpiresAt = null;
}

function clearDeleteAccountOtp(user) {
  user.deleteAccountOtpHash = "";
  user.deleteAccountOtpExpiresAt = null;
}

function storeOtpForMode(user, mode, otp) {
  const otpHash = hashOtp(otp);
  const expiresAt = getOtpExpiry();

  if (mode === "reset") {
    user.resetPasswordOtpHash = otpHash;
    user.resetPasswordOtpExpiresAt = expiresAt;
    clearDeleteAccountOtp(user);
  } else {
    user.deleteAccountOtpHash = otpHash;
    user.deleteAccountOtpExpiresAt = expiresAt;
    clearResetPasswordOtp(user);
  }

  return expiresAt;
}

async function sendOtpOrFallback({ user, identifier, mode }) {
  const normalizedTarget = normalizeVerificationTarget(identifier);

  if (normalizedTarget.channel === "email") {
    if (!isEmailOtpConfigured()) {
      throw new Error("Email OTP service is not configured on the server");
    }

    const otpCode = generateOtp();
    const expiresAt = storeOtpForMode(user, mode, otpCode);
    await user.save();

    try {
      await sendOtpEmail({
        toEmail: normalizedTarget.to,
        userName: user.fullName,
        otpCode,
        purpose: mode === "reset" ? "password-reset" : "account-delete",
      });
    } catch (error) {
      if (mode === "reset") {
        clearResetPasswordOtp(user);
      } else {
        clearDeleteAccountOtp(user);
      }

      await user.save();
      throw error;
    }

    return {
      provider: "email",
      channel: "email",
      identifier: normalizedTarget.to,
      expiresAt,
    };
  }

  if (!isTwilioVerifyConfigured()) {
    throw new Error("SMS OTP delivery provider is not configured on the server");
  }

  const providerResult = await startTwilioVerification(normalizedTarget.to);

  if (mode === "reset") {
    clearResetPasswordOtp(user);
  } else {
    clearDeleteAccountOtp(user);
  }

  await user.save();

  return {
    provider: providerResult.provider,
    channel: providerResult.channel,
    identifier: providerResult.to,
    expiresAt: providerResult.expiresAt,
  };
}

async function verifyOtpOrProvider({ user, identifier, otp, mode }) {
  const localHash =
    mode === "reset" ? user.resetPasswordOtpHash : user.deleteAccountOtpHash;
  const localExpiresAt =
    mode === "reset" ? user.resetPasswordOtpExpiresAt : user.deleteAccountOtpExpiresAt;

  if (localHash) {
    return localHash === hashOtp(otp) && Boolean(localExpiresAt) && localExpiresAt > new Date();
  }

  if (!isTwilioVerifyConfigured()) {
    return false;
  }

  try {
    return await checkTwilioVerification(identifier, otp);
  } catch (_error) {
    return false;
  }
}

async function register(request, response) {
  const validationError = validateRegisterPayload(request.body);

  if (validationError) {
    return response.status(400).json({
      success: false,
      message: validationError,
    });
  }

  const { fullName, email, phone, password, role } = request.body;
  const normalizedEmail = String(email).toLowerCase().trim();
  const trimmedPhone = String(phone).trim();
  const avatarUrl = normalizeAvatarUrl(request.body.avatarUrl);

  if (request.body.avatarUrl !== undefined && avatarUrl === null) {
    return response.status(400).json({
      success: false,
      message: "Profile photo must be a valid image URL or uploaded image",
    });
  }

  const existingUser = await User.findOne({
    $or: [{ email: normalizedEmail }, { phone: trimmedPhone }],
  });

  if (existingUser) {
    return response.status(409).json({
      success: false,
      message: "An account with this email or phone already exists",
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({
    fullName: String(fullName).trim(),
    email: normalizedEmail,
    phone: trimmedPhone,
    avatarUrl: avatarUrl || "",
    passwordHash,
    role,
    isActive: true,
  });

  const token = createToken(user);

  return response.status(201).json({
    success: true,
    message: "Registration successful",
    data: {
      token,
      user: sanitizeUser(user),
    },
  });
}

async function login(request, response) {
  const identifier = request.body.emailOrPhone || request.body.email || request.body.phone;
  const password = request.body.password;

  if (!identifier || !password) {
    return response.status(400).json({
      success: false,
      message: "Email or phone and password are required",
    });
  }

  const user = await findUserByIdentifier(identifier);

  if (!user || !user.isActive) {
    return response.status(401).json({
      success: false,
      message: "Invalid credentials",
    });
  }

  const isPasswordValid = await bcrypt.compare(String(password), user.passwordHash);

  if (!isPasswordValid) {
    return response.status(401).json({
      success: false,
      message: "Invalid credentials",
    });
  }

  const token = createToken(user);

  return response.json({
    success: true,
    message: "Login successful",
    data: {
      token,
      user: sanitizeUser(user),
    },
  });
}

async function forgotPassword(request, response) {
  const identifier = request.body.emailOrPhone || request.body.email || request.body.phone;

  if (!identifier) {
    return response.status(400).json({
      success: false,
      message: "Email or phone is required",
    });
  }

  const normalizedIdentifier = normalizeIdentifier(identifier);
  const user = await findUserByIdentifier(normalizedIdentifier);

  if (!user || !user.isActive) {
    return response.json({
      success: true,
      message: "If an account exists, a reset OTP has been prepared.",
      data: null,
    });
  }

  let otpDelivery;

  try {
    otpDelivery = await sendOtpOrFallback({
      user,
      identifier: normalizedIdentifier,
      mode: "reset",
    });
  } catch (error) {
    return response.status(503).json({
      success: false,
      message: error.message || "OTP could not be delivered right now",
    });
  }

  return response.json({
    success: true,
    message: "Reset OTP sent successfully.",
    data: {
      provider: otpDelivery.provider,
      channel: otpDelivery.channel,
      identifier: otpDelivery.identifier || normalizedIdentifier,
      resetLinkPath: `/reset-password?identifier=${encodeURIComponent(normalizedIdentifier)}`,
      expiresAt: otpDelivery.expiresAt,
    },
  });
}

function getUserOtpTarget(user, deliveryTarget) {
  if (deliveryTarget === "phone") {
    return user.phone;
  }

  if (deliveryTarget === "email") {
    return user.email;
  }

  return user.phone || user.email;
}

async function resetPassword(request, response) {
  const identifier = request.body.emailOrPhone || request.body.email || request.body.phone;
  const { otp, password } = request.body;

  if (!identifier || !otp || !password) {
    return response.status(400).json({
      success: false,
      message: "Email or phone, OTP, and new password are required",
    });
  }

  if (String(password).length < 6) {
    return response.status(400).json({
      success: false,
      message: "Password must be at least 6 characters long",
    });
  }

  const user = await findUserByIdentifier(identifier);

  const isOtpVerified =
    user && user.isActive
      ? await verifyOtpOrProvider({
          user,
          identifier,
          otp,
          mode: "reset",
        })
      : false;

  if (!isOtpVerified) {
    return response.status(400).json({
      success: false,
      message: "OTP is invalid or expired",
    });
  }

  user.passwordHash = await bcrypt.hash(String(password), 10);
  clearResetPasswordOtp(user);
  await user.save();

  return response.json({
    success: true,
    message: "Password reset successful. You can now log in with the new password.",
    data: null,
  });
}

async function requestDeleteAccountOtp(request, response) {
  const user = request.user;
  const deliveryTarget = request.body?.deliveryTarget || "";
  const identifier = getUserOtpTarget(user, deliveryTarget);

  if (!identifier) {
    return response.status(400).json({
      success: false,
      message: "No valid registered email or phone is available for OTP delivery",
    });
  }

  let otpDelivery;

  try {
    otpDelivery = await sendOtpOrFallback({
      user,
      identifier,
      mode: "delete",
    });
  } catch (error) {
    return response.status(503).json({
      success: false,
      message: error.message || "Delete-account OTP could not be delivered right now",
    });
  }

  return response.json({
    success: true,
    message: "Delete-account OTP sent successfully.",
    data: {
      provider: otpDelivery.provider,
      channel: otpDelivery.channel,
      identifier: otpDelivery.identifier,
      expiresAt: otpDelivery.expiresAt,
    },
  });
}

async function deleteMyAccount(request, response) {
  const user = request.user;
  const { password, otp } = request.body || {};

  if (!password && !otp) {
    return response.status(400).json({
      success: false,
      message: "Provide either your password or a delete-account OTP",
    });
  }

  let isVerified = false;

  if (password) {
    isVerified = await bcrypt.compare(String(password), user.passwordHash);
  }

  if (!isVerified && otp) {
    isVerified = await verifyOtpOrProvider({
      user,
      identifier: user.email || user.phone,
      otp,
      mode: "delete",
    });
  }

  if (!isVerified) {
    return response.status(401).json({
      success: false,
      message: "Password or OTP verification failed",
    });
  }

  const deletionStamp = Date.now();
  const userSuffix = user._id.toString().slice(-6);

  user.isActive = false;
  user.deletedAt = new Date();
  user.email = `deleted.${deletionStamp}.${userSuffix}@nearbyhelper.local`;
  user.phone = `deleted-${deletionStamp}-${userSuffix}`;
  user.passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
  clearResetPasswordOtp(user);
  clearDeleteAccountOtp(user);
  await user.save();

  await HelperProfile.findOneAndUpdate(
    { user: user._id },
    {
      isAvailable: false,
      isVerified: false,
      verificationStatus: "rejected",
    }
  );

  return response.json({
    success: true,
    message: "Account deleted successfully",
    data: null,
  });
}

function getCurrentUser(request, response) {
  return response.json({
    success: true,
    message: "Session fetched successfully",
    data: sanitizeUser(request.user),
  });
}

async function updateProfile(request, response) {
  const avatarUrl = normalizeAvatarUrl(request.body?.avatarUrl);
  const savedAddresses = request.body?.savedAddresses;
  const addressError = validateSavedAddresses(savedAddresses);

  if (request.body?.avatarUrl !== undefined && avatarUrl === null) {
    return response.status(400).json({
      success: false,
      message: "Profile photo must be a valid image URL or uploaded image",
    });
  }

  if (addressError) {
    return response.status(400).json({
      success: false,
      message: addressError,
    });
  }

  if (request.body?.avatarUrl !== undefined) {
    request.user.avatarUrl = avatarUrl || "";
  }

  if (savedAddresses !== undefined) {
    request.user.savedAddresses = normalizeSavedAddresses(savedAddresses);
  }

  await request.user.save();

  return response.json({
    success: true,
    message: "Profile updated successfully",
    data: sanitizeUser(request.user),
  });
}

export {
  deleteMyAccount,
  forgotPassword,
  getCurrentUser,
  login,
  register,
  requestDeleteAccountOtp,
  resetPassword,
  updateProfile,
};
