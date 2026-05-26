import { Router } from "express";
import {
  cancelBooking,
  createBooking,
  createBookingMessage,
  createBookingReview,
  createBookingPaymentOrder,
  getBookingById,
  getBookingMessages,
  getHelperBookings,
  getMyBookings,
  rescheduleBooking,
  syncBookingPayment,
  updateBookingStatus,
  verifyBookingPayment,
} from "../controllers/bookingController.js";
import requireAuth from "../middleware/requireAuth.js";
import requireRole from "../middleware/requireRole.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

router.get("/my", requireAuth, asyncHandler(getMyBookings));
router.get(
  "/helper",
  requireAuth,
  requireRole("helper", "admin"),
  asyncHandler(getHelperBookings)
);
router.get("/:id", requireAuth, asyncHandler(getBookingById));
router.get("/:id/messages", requireAuth, asyncHandler(getBookingMessages));
router.post("/", requireAuth, asyncHandler(createBooking));
router.post("/:id/messages", requireAuth, asyncHandler(createBookingMessage));
router.post("/:id/review", requireAuth, requireRole("customer", "admin"), asyncHandler(createBookingReview));
router.post("/:id/payment-order", requireAuth, asyncHandler(createBookingPaymentOrder));
router.post("/:id/verify-payment", requireAuth, asyncHandler(verifyBookingPayment));
router.post("/:id/sync-payment", requireAuth, asyncHandler(syncBookingPayment));
router.patch(
  "/:id/reschedule",
  requireAuth,
  requireRole("customer", "admin"),
  asyncHandler(rescheduleBooking)
);
router.patch(
  "/:id/cancel",
  requireAuth,
  requireRole("customer", "admin"),
  asyncHandler(cancelBooking)
);
router.patch(
  "/:id/status",
  requireAuth,
  requireRole("helper", "admin"),
  asyncHandler(updateBookingStatus)
);

export default router;
