import mongoose from "mongoose";
import {
  bookings as mockBookings,
  complaints as mockComplaints,
  helpers as mockHelpers,
} from "../data/mockData.js";
import Booking from "../models/Booking.js";
import Complaint from "../models/Complaint.js";
import HelperProfile from "../models/HelperProfile.js";
import User from "../models/User.js";
import { issueBookingRefund } from "./paymentController.js";
import { isDatabaseReady } from "../utils/dbState.js";
import { formatBooking, formatComplaint } from "../utils/serializers.js";

function formatAdminHelper(helperProfile) {
  const item =
    helperProfile && typeof helperProfile.toObject === "function"
      ? helperProfile.toObject()
      : helperProfile;

  if (item.name && item.category) {
    return {
      id: item.id,
      slug: item.id,
      name: item.name,
      avatarUrl: item.avatarUrl || "",
      email: item.email || "",
      phone: item.phone || "",
      category: item.category,
      area: item.area,
      verificationStatus: item.verificationStatus || (item.verified ? "approved" : "pending"),
      isVerified: Boolean(item.verified),
      verificationDocumentUrl: item.verificationDocumentUrl || "",
      verificationDocumentLabel: item.verificationDocumentLabel || "",
      verificationSubmittedAt: item.verificationSubmittedAt || null,
      averageRating: item.rating || 0,
      totalReviews: item.totalReviews || 0,
      completedJobs: item.completedJobs || 0,
      createdAt: item.createdAt || new Date().toISOString(),
    };
  }

  return {
    id: item._id?.toString(),
    slug: item.slug || item._id?.toString(),
    name: item.user?.fullName || "Local Helper",
    avatarUrl: item.user?.avatarUrl || "",
    email: item.user?.email || "",
    phone: item.user?.phone || "",
    category: item.serviceCategories?.[0]?.name || "General Service",
    area: [item.serviceArea?.city, item.serviceArea?.state].filter(Boolean).join(", "),
    verificationStatus: item.verificationStatus || "pending",
    isVerified: Boolean(item.isVerified),
    verificationDocumentUrl: item.verificationDocumentUrl || "",
    verificationDocumentLabel: item.verificationDocumentLabel || "",
    verificationSubmittedAt: item.verificationSubmittedAt || null,
    averageRating: item.averageRating || 0,
    totalReviews: item.totalReviews || 0,
    completedJobs: item.completedJobs || 0,
    createdAt: item.createdAt,
  };
}

async function getAdminOverview(_request, response) {
  if (!isDatabaseReady()) {
    return response.json({
      success: true,
      message: "Admin overview fetched successfully",
      data: {
        totalUsers: 0,
        totalHelpers: mockHelpers.length,
        totalBookings: mockBookings.length,
        pendingVerifications: mockHelpers.filter(
          (helper) => (helper.verificationStatus || "pending") === "pending"
        ).length,
        openComplaints: mockComplaints.filter((complaint) => complaint.status === "open").length,
        recentBookings: mockBookings.slice().reverse().slice(0, 5).map(formatBooking),
      },
    });
  }

  const [
    totalUsers,
    totalHelpers,
    totalBookings,
    pendingVerifications,
    openComplaints,
    recentBookings,
  ] = await Promise.all([
    User.countDocuments(),
    HelperProfile.countDocuments(),
    Booking.countDocuments(),
    HelperProfile.countDocuments({ verificationStatus: "pending" }),
    Complaint.countDocuments({ status: { $in: ["open", "in_review"] } }),
    Booking.find()
      .populate({
        path: "helperProfile",
        populate: { path: "user", select: "fullName" },
      })
      .populate("serviceCategory", "name")
      .sort({ createdAt: -1 })
      .limit(5),
  ]);

  return response.json({
    success: true,
    message: "Admin overview fetched successfully",
    data: {
      totalUsers,
      totalHelpers,
      totalBookings,
      pendingVerifications,
      openComplaints,
      recentBookings: recentBookings.map(formatBooking),
    },
  });
}

async function getPendingVerificationHelpers(_request, response) {
  if (!isDatabaseReady()) {
    return response.json({
      success: true,
      message: "Pending verification helpers fetched successfully",
      data: mockHelpers
        .filter((helper) => (helper.verificationStatus || "pending") === "pending")
        .map(formatAdminHelper),
    });
  }

  const helpers = await HelperProfile.find({ verificationStatus: "pending" })
    .populate("user", "fullName email phone avatarUrl")
    .populate("serviceCategories", "name slug")
    .sort({ createdAt: -1 });

  return response.json({
    success: true,
    message: "Pending verification helpers fetched successfully",
    data: helpers.map(formatAdminHelper),
  });
}

async function updateHelperVerification(request, response) {
  const { id } = request.params;
  const { status } = request.body;

  if (!["approved", "rejected"].includes(status)) {
    return response.status(400).json({
      success: false,
      message: "Verification status must be approved or rejected",
    });
  }

  if (!isDatabaseReady()) {
    const helper = mockHelpers.find((item) => item.id === id);

    if (!helper) {
      return response.status(404).json({
        success: false,
        message: "Helper not found",
      });
    }

    helper.verificationStatus = status;
    helper.verified = status === "approved";

    return response.json({
      success: true,
      message: "Helper verification updated successfully",
      data: formatAdminHelper(helper),
    });
  }

  const query = mongoose.isValidObjectId(id) ? { $or: [{ _id: id }, { slug: id }] } : { slug: id };

  const helper = await HelperProfile.findOne(query)
    .populate("user", "fullName email phone avatarUrl")
    .populate("serviceCategories", "name slug");

  if (!helper) {
    return response.status(404).json({
      success: false,
      message: "Helper not found",
    });
  }

  helper.verificationStatus = status;
  helper.isVerified = status === "approved";
  await helper.save();

  const updatedHelper = await HelperProfile.findById(helper._id)
    .populate("user", "fullName email phone avatarUrl")
    .populate("serviceCategories", "name slug");

  return response.json({
    success: true,
    message: "Helper verification updated successfully",
    data: formatAdminHelper(updatedHelper),
  });
}

async function getAdminComplaints(_request, response) {
  if (!isDatabaseReady()) {
    return response.json({
      success: true,
      message: "Complaints fetched successfully",
      data: mockComplaints.slice().reverse().map(formatComplaint),
    });
  }

  const complaints = await Complaint.find()
    .sort({ createdAt: -1 })
    .limit(20);

  return response.json({
    success: true,
    message: "Complaints fetched successfully",
    data: complaints.map(formatComplaint),
  });
}

async function updateComplaintStatus(request, response) {
  const { id } = request.params;
  const { status } = request.body;

  if (!["open", "in_review", "resolved", "dismissed"].includes(status)) {
    return response.status(400).json({
      success: false,
      message: "Complaint status is invalid",
    });
  }

  if (!isDatabaseReady()) {
    const complaint = mockComplaints.find((item) => item.id === id);

    if (!complaint) {
      return response.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    complaint.status = status;
    complaint.resolvedAt = ["resolved", "dismissed"].includes(status)
      ? new Date().toISOString()
      : null;

    return response.json({
      success: true,
      message: "Complaint status updated successfully",
      data: formatComplaint(complaint),
    });
  }

  if (!mongoose.isValidObjectId(id)) {
    return response.status(404).json({
      success: false,
      message: "Complaint not found",
    });
  }

  const complaint = await Complaint.findById(id);

  if (!complaint) {
    return response.status(404).json({
      success: false,
      message: "Complaint not found",
    });
  }

  complaint.status = status;
  complaint.resolvedAt = ["resolved", "dismissed"].includes(status) ? new Date() : null;
  await complaint.save();

  return response.json({
    success: true,
    message: "Complaint status updated successfully",
    data: formatComplaint(complaint),
  });
}

export {
  getAdminComplaints,
  getAdminOverview,
  getPendingVerificationHelpers,
  issueBookingRefund,
  updateComplaintStatus,
  updateHelperVerification,
};
