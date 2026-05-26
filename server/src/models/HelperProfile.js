import mongoose from "mongoose";

const helperProfileSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    headline: {
      type: String,
      default: "",
      trim: true,
    },
    bio: {
      type: String,
      default: "",
      trim: true,
    },
    yearsOfExperience: {
      type: Number,
      default: 0,
    },
    serviceCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ServiceCategory",
      },
    ],
    pricing: {
      minPrice: {
        type: Number,
        default: 0,
      },
      maxPrice: {
        type: Number,
        default: 0,
      },
      priceUnit: {
        type: String,
        enum: ["per_visit", "per_hour", "per_day"],
        default: "per_visit",
      },
    },
    serviceArea: {
      city: String,
      state: String,
      postalCodes: [String],
      radiusInKm: {
        type: Number,
        default: 5,
      },
      coordinates: {
        type: [Number],
        index: "2dsphere",
      },
    },
    availability: {
      days: [String],
      startTime: String,
      endTime: String,
      slotDurationMinutes: {
        type: Number,
        default: 60,
      },
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    verificationDocumentLabel: {
      type: String,
      default: "",
      trim: true,
    },
    verificationDocumentUrl: {
      type: String,
      default: "",
      trim: true,
    },
    verificationSubmittedAt: {
      type: Date,
      default: null,
    },
    portfolioPhotos: [
      {
        type: String,
        default: "",
        trim: true,
      },
    ],
    averageRating: {
      type: Number,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    completedJobs: {
      type: Number,
      default: 0,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const HelperProfile = mongoose.model("HelperProfile", helperProfileSchema);

export default HelperProfile;
