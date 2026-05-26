import mongoose from "mongoose";

const savedAddressSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    addressLine1: {
      type: String,
      required: true,
      trim: true,
    },
    addressLine2: {
      type: String,
      default: "",
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: true,
  }
);

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    avatarUrl: {
      type: String,
      default: "",
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    resetPasswordOtpHash: {
      type: String,
      default: "",
    },
    resetPasswordOtpExpiresAt: {
      type: Date,
      default: null,
    },
    deleteAccountOtpHash: {
      type: String,
      default: "",
    },
    deleteAccountOtpExpiresAt: {
      type: Date,
      default: null,
    },
    role: {
      type: String,
      enum: ["customer", "helper", "admin"],
      default: "customer",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    savedHelpers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "HelperProfile",
      },
    ],
    savedAddresses: [savedAddressSchema],
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

export default User;
