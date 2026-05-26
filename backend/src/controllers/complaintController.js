import mongoose from "mongoose";
import { bookings as mockBookings, complaints as mockComplaints } from "../data/mockData.js";
import Booking from "../models/Booking.js";
import Complaint from "../models/Complaint.js";
import { isDatabaseReady } from "../utils/dbState.js";
import { formatComplaint } from "../utils/serializers.js";

function validateComplaintPayload(body) {
  const requiredFields = ["bookingId", "category", "description"];
  const missingFields = requiredFields.filter((field) => !body[field]);

  if (missingFields.length) {
    return `Missing required fields: ${missingFields.join(", ")}`;
  }

  return null;
}

async function createComplaint(request, response) {
  const reporter = request.user;
  const validationError = validateComplaintPayload(request.body);

  if (validationError) {
    return response.status(400).json({
      success: false,
      message: validationError,
    });
  }

  const { bookingId, category, description } = request.body;

  if (!isDatabaseReady()) {
    const booking = mockBookings.find(
      (item) => item.id === bookingId && item.customerId === (reporter._id?.toString?.() || reporter.id)
    );

    if (!booking) {
      return response.status(404).json({
        success: false,
        message: "Booking not found for this account",
      });
    }

    const existingComplaint = mockComplaints.find(
      (item) => item.bookingId === bookingId && item.reporterId === (reporter._id?.toString?.() || reporter.id)
    );

    if (existingComplaint) {
      return response.status(409).json({
        success: false,
        message: "A complaint has already been submitted for this booking",
      });
    }

    const complaint = {
      id: `complaint-${mockComplaints.length + 1}`,
      bookingId,
      reporterId: reporter._id?.toString?.() || reporter.id,
      reporterName: reporter.fullName,
      reporterEmail: reporter.email || "",
      targetName: booking.helperName || "",
      category,
      description,
      status: "open",
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    };

    mockComplaints.push(complaint);

    return response.status(201).json({
      success: true,
      message: "Complaint submitted successfully",
      data: formatComplaint(complaint),
    });
  }

  if (!mongoose.isValidObjectId(bookingId)) {
    return response.status(404).json({
      success: false,
      message: "Booking not found for this account",
    });
  }

  const booking = await Booking.findOne({
    _id: bookingId,
    customer: reporter._id,
  }).populate({
    path: "helperProfile",
    populate: { path: "user", select: "fullName email" },
  });

  if (!booking) {
    return response.status(404).json({
      success: false,
      message: "Booking not found for this account",
    });
  }

  const existingComplaint = await Complaint.findOne({
    booking: booking._id,
    reporter: reporter._id,
  });

  if (existingComplaint) {
    return response.status(409).json({
      success: false,
      message: "A complaint has already been submitted for this booking",
    });
  }

  const complaint = await Complaint.create({
    booking: booking._id,
    bookingId: booking._id.toString(),
    reporter: reporter._id,
    reporterName: reporter.fullName,
    reporterEmail: reporter.email || "",
    targetUser: booking.helperProfile?.user?._id || null,
    targetName: booking.helperProfile?.user?.fullName || "",
    category,
    description,
    status: "open",
  });

  return response.status(201).json({
    success: true,
    message: "Complaint submitted successfully",
    data: formatComplaint(complaint),
  });
}

async function getMyComplaints(request, response) {
  const reporter = request.user;

  if (!isDatabaseReady()) {
    return response.json({
      success: true,
      message: "Complaints fetched successfully",
      data: mockComplaints
        .filter((item) => item.reporterId === (reporter._id?.toString?.() || reporter.id))
        .map(formatComplaint),
    });
  }

  const complaints = await Complaint.find({ reporter: reporter._id }).sort({ createdAt: -1 });

  return response.json({
    success: true,
    message: "Complaints fetched successfully",
    data: complaints.map(formatComplaint),
  });
}

export { createComplaint, getMyComplaints };
