import mongoose from "mongoose";
import HelperProfile from "../models/HelperProfile.js";
import Review from "../models/Review.js";

async function refreshHelperReviewSummary(helperProfileId) {
  if (!helperProfileId) {
    return null;
  }

  const normalizedId = new mongoose.Types.ObjectId(helperProfileId);
  const [summary] = await Review.aggregate([
    {
      $match: {
        helperProfile: normalizedId,
        status: "published",
      },
    },
    {
      $group: {
        _id: "$helperProfile",
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  const averageRating = summary?.averageRating
    ? Number(summary.averageRating.toFixed(1))
    : 0;
  const totalReviews = summary?.totalReviews || 0;

  await HelperProfile.findByIdAndUpdate(helperProfileId, {
    averageRating,
    totalReviews,
  });

  return {
    averageRating,
    totalReviews,
  };
}

async function fetchPublishedHelperReviews(helperProfileId, limit = 5) {
  if (!helperProfileId) {
    return [];
  }

  return Review.find({
    helperProfile: helperProfileId,
    status: "published",
  })
    .populate("customer", "fullName avatarUrl")
    .sort({ createdAt: -1 })
    .limit(limit);
}

export { fetchPublishedHelperReviews, refreshHelperReviewSummary };
