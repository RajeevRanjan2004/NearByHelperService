import { Router } from "express";
import { getCategories } from "../controllers/categoryController.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(getCategories));

export default router;
