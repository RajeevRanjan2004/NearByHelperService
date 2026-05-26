import { Router } from "express";
import {
  deleteMyAccount,
  forgotPassword,
  getCurrentUser,
  login,
  requestDeleteAccountOtp,
  register,
  resetPassword,
  updateProfile,
} from "../controllers/authController.js";
import requireAuth from "../middleware/requireAuth.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.post("/forgot-password", asyncHandler(forgotPassword));
router.post("/reset-password", asyncHandler(resetPassword));
router.post("/request-delete-otp", requireAuth, asyncHandler(requestDeleteAccountOtp));
router.delete("/account", requireAuth, asyncHandler(deleteMyAccount));
router.get("/me", requireAuth, getCurrentUser);
router.patch("/profile", requireAuth, asyncHandler(updateProfile));

export default router;
