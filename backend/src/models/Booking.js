import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerEmail: {
      type: String,
      default: "",
      trim: true,
    },
    helperProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HelperProfile",
      required: true,
    },
    serviceCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceCategory",
      required: true,
    },
    address: {
      label: String,
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      postalCode: String,
      coordinates: [Number],
    },
    scheduledDate: {
      type: Date,
      required: true,
    },
    lastRescheduledAt: {
      type: Date,
      default: null,
    },
    rescheduleReason: {
      type: String,
      default: "",
      trim: true,
    },
    rescheduleCount: {
      type: Number,
      default: 0,
    },
    issueDescription: {
      type: String,
      required: true,
      trim: true,
    },
    contactPhone: {
      type: String,
      required: true,
    },
    estimatedPrice: {
      type: Number,
      default: 0,
    },
    finalPrice: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "INR",
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "card", "wallet"],
      default: "cash",
    },
    paymentStatus: {
      type: String,
      enum: ["cash_on_service", "pending", "paid", "failed"],
      default: "cash_on_service",
    },
    paymentReference: {
      type: String,
      default: "",
      trim: true,
    },
    paymentProvider: {
      type: String,
      enum: ["", "razorpay"],
      default: "",
    },
    paymentGatewayOrderId: {
      type: String,
      default: "",
      trim: true,
    },
    paymentGatewayPaymentId: {
      type: String,
      default: "",
      trim: true,
    },
    paymentGatewaySignature: {
      type: String,
      default: "",
      trim: true,
    },
    paymentFailureReason: {
      type: String,
      default: "",
      trim: true,
    },
    paymentCapturedAt: {
      type: Date,
      default: null,
    },
    refundedAmount: {
      type: Number,
      default: 0,
    },
    refundStatus: {
      type: String,
      enum: ["none", "pending", "partial", "refunded", "failed"],
      default: "none",
    },
    refunds: [
      {
        refundId: {
          type: String,
          default: "",
          trim: true,
        },
        amount: {
          type: Number,
          default: 0,
        },
        currency: {
          type: String,
          default: "INR",
          trim: true,
        },
        status: {
          type: String,
          default: "created",
          trim: true,
        },
        receipt: {
          type: String,
          default: "",
          trim: true,
        },
        speedRequested: {
          type: String,
          default: "",
          trim: true,
        },
        speedProcessed: {
          type: String,
          default: "",
          trim: true,
        },
        notes: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
        createdAt: {
          type: Date,
          default: null,
        },
      },
    ],
    review: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Review",
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      default: "",
      trim: true,
    },
    cancelledByRole: {
      type: String,
      enum: ["", "customer", "helper", "admin"],
      default: "",
    },
    status: {
      type: String,
      enum: ["requested", "accepted", "rejected", "in_progress", "completed", "cancelled"],
      default: "requested",
    },
  },
  {
    timestamps: true,
  }
);

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
