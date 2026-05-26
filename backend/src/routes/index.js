import { Router } from "express";
import adminRoutes from "./adminRoutes.js";
import authRoutes from "./authRoutes.js";
import bookingRoutes from "./bookingRoutes.js";
import categoryRoutes from "./categoryRoutes.js";
import complaintRoutes from "./complaintRoutes.js";
import healthRoutes from "./healthRoutes.js";
import helperRoutes from "./helperRoutes.js";
import paymentRoutes from "./paymentRoutes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/categories", categoryRoutes);
router.use("/complaints", complaintRoutes);
router.use("/helpers", helperRoutes);
router.use("/bookings", bookingRoutes);
router.use("/payments", paymentRoutes);

export default router;
