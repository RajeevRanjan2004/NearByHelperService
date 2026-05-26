import { Router } from "express";
import {
  createHelperProfile,
  getCurrentHelperProfile,
  getHelperById,
  getHelpers,
} from "../controllers/helperController.js";
import requireAuth from "../middleware/requireAuth.js";
import requireRole from "../middleware/requireRole.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

router.post(
  "/profile",
  requireAuth,
  requireRole("helper", "admin"),
  asyncHandler(createHelperProfile)
);
router.get(
  "/profile/me",
  requireAuth,
  requireRole("helper", "admin"),
  asyncHandler(getCurrentHelperProfile)
);
router.get("/", asyncHandler(getHelpers));
router.get("/:id", asyncHandler(getHelperById));

export default router;
