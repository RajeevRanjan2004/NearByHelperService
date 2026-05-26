import { Router } from "express";
import { handleRazorpayWebhook } from "../controllers/paymentController.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

router.post("/razorpay/webhook", asyncHandler(handleRazorpayWebhook));

export default router;
