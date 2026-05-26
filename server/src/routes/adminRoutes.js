import { Router } from "express";
import {
  getAdminComplaints,
  getAdminOverview,
  getPendingVerificationHelpers,
  issueBookingRefund,
  updateComplaintStatus,
  updateHelperVerification,
} from "../controllers/adminController.js";
import requireAuth from "../middleware/requireAuth.js";
import requireRole from "../middleware/requireRole.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/overview", asyncHandler(getAdminOverview));
router.get("/complaints", asyncHandler(getAdminComplaints));
router.get("/helpers/pending-verification", asyncHandler(getPendingVerificationHelpers));
router.post("/bookings/:id/refund", asyncHandler(issueBookingRefund));
router.patch("/complaints/:id/status", asyncHandler(updateComplaintStatus));
router.patch("/helpers/:id/verification", asyncHandler(updateHelperVerification));

export default router;
