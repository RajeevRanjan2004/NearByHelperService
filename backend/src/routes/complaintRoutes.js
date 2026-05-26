import { Router } from "express";
import { createComplaint, getMyComplaints } from "../controllers/complaintController.js";
import requireAuth from "../middleware/requireAuth.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

router.get("/my", requireAuth, asyncHandler(getMyComplaints));
router.post("/", requireAuth, asyncHandler(createComplaint));

export default router;
