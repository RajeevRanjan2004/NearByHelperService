import mongoose from "mongoose";
import env from "../config/env.js";
import {
  bookingMessages as mockBookingMessages,
  bookings as mockBookings,
  helpers as mockHelpers,
} from "../data/mockData.js";
import Booking from "../models/Booking.js";
import BookingMessage from "../models/BookingMessage.js";
import HelperProfile from "../models/HelperProfile.js";
import Review from "../models/Review.js";
import { isScheduledDateWithinAvailability } from "../utils/availability.js";
import { applyRazorpayPaymentToBooking } from "../utils/bookingPayments.js";
import { isDatabaseReady } from "../utils/dbState.js";
import {
  isEmailServiceConfigured,
  sendBookingNotificationEmail,
} from "../utils/email.js";
import {
  captureAuthorizedRazorpayPayment,
  createRazorpayOrder,
  fetchRazorpayOrderPayments,
  fetchRazorpayPayment,
  isRazorpayConfigured,
  verifyRazorpaySignature,
} from "../utils/razorpay.js";
import { formatBooking, formatBookingMessage } from "../utils/serializers.js";
import { refreshHelperReviewSummary } from "../utils/reviewStats.js";

const helperEditableStatuses = ["accepted", "rejected", "in_progress", "completed", "cancelled"];
const customerReschedulableStatuses = ["requested", "accepted"];
const customerCancellableStatuses = ["requested"];
const supportedPaymentMethods = ["cash", "upi", "card", "wallet"];

function validateBookingPayload(body) {
  const requiredFields = ["helperId", "contactPhone", "scheduledDate", "issueDescription"];

  const missingFields = requiredFields.filter((field) => !body[field]);

  if (missingFields.length) {
    return `Missing required fields: ${missingFields.join(", ")}`;
  }

  return null;
}

function isFutureDate(value) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date > new Date();
}

function normalizeOptionalReason(value) {
  return String(value || "").trim();
}

function normalizePaymentMethod(method) {
  return supportedPaymentMethods.includes(method) ? method : "cash";
}

function createInitialPaymentFields(paymentMethod) {
  if (paymentMethod === "cash") {
    return {
      paymentProvider: "",
      paymentStatus: "cash_on_service",
    };
  }

  return {
    paymentProvider: "razorpay",
    paymentStatus: "pending",
  };
}

function buildBookingQuery(filter) {
  return Booking.findOne(filter)
    .populate({
      path: "helperProfile",
      populate: { path: "user", select: "fullName email phone avatarUrl" },
    })
    .populate({
      path: "review",
      populate: { path: "customer", select: "fullName avatarUrl" },
    })
    .populate("serviceCategory", "name");
}

function validateReasonLength(reason, label) {
  if (reason && reason.length > 280) {
    return `${label} must be 280 characters or less`;
  }

  return null;
}

function validateBookingMessagePayload(body) {
  const message = String(body?.message || body?.body || "").trim();

  if (!message) {
    return "Message is required";
  }

  if (message.length > 1000) {
    return "Message must be 1000 characters or less";
  }

  return null;
}

function canCustomerRescheduleBooking(booking) {
  return customerReschedulableStatuses.includes(booking.status);
}

function canCustomerCancelBooking(booking) {
  return customerCancellableStatuses.includes(booking.status);
}

function formatScheduledDateForEmail(value) {
  try {
    return new Date(value).toLocaleString("en-IN");
  } catch {
    return String(value || "");
  }
}

function buildBookingActionUrl(booking) {
  return `${env.appUrl}/bookings/${booking._id?.toString?.() || booking.id}`;
}

function buildMessageExcerpt(value) {
  const message = String(value || "").trim();

  if (message.length <= 140) {
    return message;
  }

  return `${message.slice(0, 137)}...`;
}

function resolveMockAccessibleBooking(bookingId, currentUser) {
  if (currentUser.role === "admin") {
    return mockBookings.find((item) => item.id === bookingId) || null;
  }

  if (currentUser.role === "helper") {
    const helper = findMockHelperForUser(currentUser);

    if (!helper) {
      return null;
    }

    return mockBookings.find((item) => item.id === bookingId && item.helperId === helper.id) || null;
  }

  return (
    mockBookings.find(
      (item) => item.id === bookingId && item.customerId === (currentUser._id?.toString?.() || currentUser.id)
    ) || null
  );
}

async function sendBookingChatNotification(booking, sender, messageBody) {
  if (!isEmailServiceConfigured()) {
    return;
  }

  const senderRole = sender.role || "customer";
  const excerpt = buildMessageExcerpt(messageBody);
  const commonItems = [
    `Booking ID: ${booking._id?.toString?.() || booking.id}`,
    `Service: ${booking.serviceCategory?.name || booking.serviceCategory || "General Service"}`,
    `Message from: ${sender.fullName || sender.name || "User"} (${senderRole})`,
    `Message: ${excerpt}`,
  ];
  const actionUrl = buildBookingActionUrl(booking);
  const notifications = [];

  if (senderRole === "customer" && booking.helperProfile?.user?.email) {
    notifications.push(
      sendBookingNotificationEmail({
        toEmail: booking.helperProfile.user.email,
        userName: booking.helperProfile.user.fullName || "Helper",
        subject: `${env.businessName} new customer message`,
        title: "New customer message",
        intro: "A customer has sent you a new message for an active booking.",
        items: commonItems,
        actionText: "Open booking chat",
        actionUrl,
      })
    );
  }

  if (senderRole === "helper" && booking.customerEmail) {
    notifications.push(
      sendBookingNotificationEmail({
        toEmail: booking.customerEmail,
        userName: booking.customerName || "Customer",
        subject: `${env.businessName} new helper message`,
        title: "New helper message",
        intro: "Your helper has sent you a new update for this booking.",
        items: commonItems,
        actionText: "Open booking chat",
        actionUrl,
      })
    );
  }

  if (notifications.length) {
    await Promise.allSettled(notifications);
  }
}

async function sendBookingLifecycleNotifications(booking, event, extra = {}) {
  if (!isEmailServiceConfigured()) {
    return;
  }

  const bookingUrl = buildBookingActionUrl(booking);
  const commonItems = [
    `Booking ID: ${booking._id?.toString?.() || booking.id}`,
    `Service: ${booking.serviceCategory?.name || booking.serviceCategory || "General Service"}`,
    `Helper: ${booking.helperProfile?.user?.fullName || booking.helperName || "Helper"}`,
    `Scheduled: ${formatScheduledDateForEmail(booking.scheduledDate)}`,
  ];

  const customerEmail = booking.customerEmail || "";
  const helperEmail = booking.helperProfile?.user?.email || "";
  const helperName = booking.helperProfile?.user?.fullName || booking.helperName || "Helper";
  const customerName = booking.customerName || "Customer";
  const messages = [];

  if (event === "created") {
    if (customerEmail) {
      messages.push(
        sendBookingNotificationEmail({
          toEmail: customerEmail,
          userName: customerName,
          subject: `${env.businessName} booking request received`,
          title: "Booking request received",
          intro: "Your service request has been created successfully.",
          items: commonItems,
          actionText: "Open booking details",
          actionUrl: bookingUrl,
        })
      );
    }

    if (helperEmail) {
      messages.push(
        sendBookingNotificationEmail({
          toEmail: helperEmail,
          userName: helperName,
          subject: `${env.businessName} new booking request`,
          title: "New booking request",
          intro: "A customer has requested your service.",
          items: [
            ...commonItems,
            `Customer: ${customerName}`,
            `Contact: ${booking.contactPhone || "Not provided"}`,
          ],
          actionText: "Open dashboard",
          actionUrl: `${env.appUrl}/helper-dashboard`,
        })
      );
    }
  }

  if (event === "status_updated" && customerEmail) {
    messages.push(
      sendBookingNotificationEmail({
        toEmail: customerEmail,
        userName: customerName,
        subject: `${env.businessName} booking status updated`,
        title: "Booking status updated",
        intro: `Your booking status is now ${String(booking.status).replace("_", " ")}.`,
        items: commonItems,
        actionText: "Track booking",
        actionUrl: bookingUrl,
      })
    );
  }

  if (event === "rescheduled") {
    const reasonText = extra.reason ? `Reason: ${extra.reason}` : null;

    if (customerEmail) {
      messages.push(
        sendBookingNotificationEmail({
          toEmail: customerEmail,
          userName: customerName,
          subject: `${env.businessName} booking rescheduled`,
          title: "Booking rescheduled",
          intro: "Your booking schedule has been updated successfully.",
          items: [...commonItems, ...(reasonText ? [reasonText] : [])],
          actionText: "View updated booking",
          actionUrl: bookingUrl,
        })
      );
    }

    if (helperEmail) {
      messages.push(
        sendBookingNotificationEmail({
          toEmail: helperEmail,
          userName: helperName,
          subject: `${env.businessName} booking rescheduled`,
          title: "Booking rescheduled",
          intro: "A customer has updated the visit time for a booking.",
          items: [...commonItems, `Customer: ${customerName}`, ...(reasonText ? [reasonText] : [])],
          actionText: "Open dashboard",
          actionUrl: `${env.appUrl}/helper-dashboard`,
        })
      );
    }
  }

  if (event === "cancelled") {
    const reasonText = extra.reason ? `Reason: ${extra.reason}` : null;

    if (customerEmail) {
      messages.push(
        sendBookingNotificationEmail({
          toEmail: customerEmail,
          userName: customerName,
          subject: `${env.businessName} booking cancelled`,
          title: "Booking cancelled",
          intro: "Your booking has been cancelled.",
          items: [...commonItems, ...(reasonText ? [reasonText] : [])],
          actionText: "Open booking details",
          actionUrl: bookingUrl,
        })
      );
    }

    if (helperEmail) {
      messages.push(
        sendBookingNotificationEmail({
          toEmail: helperEmail,
          userName: helperName,
          subject: `${env.businessName} booking cancelled`,
          title: "Booking cancelled",
          intro: "A booking assigned to you has been cancelled.",
          items: [...commonItems, `Customer: ${customerName}`, ...(reasonText ? [reasonText] : [])],
          actionText: "Open dashboard",
          actionUrl: `${env.appUrl}/helper-dashboard`,
        })
      );
    }
  }

  if (messages.length) {
    await Promise.allSettled(messages);
  }
}

async function resolveAccessibleBooking(bookingId, user) {
  if (!mongoose.isValidObjectId(bookingId)) {
    return null;
  }

  if (user.role === "admin") {
    return buildBookingQuery({ _id: bookingId });
  }

  if (user.role === "helper") {
    const helperProfile = await resolveCurrentHelperProfile(user);

    if (!helperProfile) {
      return null;
    }

    return buildBookingQuery({
      _id: bookingId,
      helperProfile: helperProfile._id,
    });
  }

  return buildBookingQuery({
    _id: bookingId,
    customer: user._id,
  });
}

function validateReviewPayload(body) {
  const rating = Number(body.rating);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return "Rating must be a whole number between 1 and 5";
  }

  if (body.comment && String(body.comment).trim().length > 500) {
    return "Review comment must be 500 characters or less";
  }

  return null;
}

async function resolveHelperProfile(helperId) {
  if (mongoose.isValidObjectId(helperId)) {
    return HelperProfile.findOne({ $or: [{ _id: helperId }, { slug: helperId }] })
      .populate("serviceCategories", "name slug")
      .populate("user", "fullName email phone");
  }

  return HelperProfile.findOne({ slug: helperId })
    .populate("serviceCategories", "name slug")
    .populate("user", "fullName email phone");
}

async function resolveCurrentHelperProfile(user) {
  return HelperProfile.findOne({ user: user._id })
    .populate("user", "fullName email phone")
    .populate("serviceCategories", "name slug");
}

async function resolveCustomerBooking(bookingId, user) {
  if (!mongoose.isValidObjectId(bookingId)) {
    return null;
  }

  if (user.role === "admin") {
    return buildBookingQuery({ _id: bookingId });
  }

  return buildBookingQuery({
    _id: bookingId,
    customer: user._id,
  });
}

function isTransitionAllowed(currentStatus, nextStatus) {
  const transitions = {
    requested: ["accepted", "rejected"],
    accepted: ["in_progress", "completed", "cancelled"],
    in_progress: ["completed"],
    rejected: [],
    completed: [],
    cancelled: [],
  };

  return transitions[currentStatus]?.includes(nextStatus);
}

function findMockHelperForUser(user) {
  return mockHelpers.find((helper) => helper.name === user.fullName) || null;
}

function selectBestRazorpayPayment(payments) {
  if (!Array.isArray(payments) || !payments.length) {
    return null;
  }

  const paymentStatusPriority = {
    captured: 4,
    authorized: 3,
    created: 2,
    failed: 1,
  };

  return [...payments].sort((left, right) => {
    const priorityDifference =
      (paymentStatusPriority[right.status] || 0) - (paymentStatusPriority[left.status] || 0);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return (right.created_at || 0) - (left.created_at || 0);
  })[0];
}

function getBookingChargeAmount(booking) {
  const payableAmount = Number(booking.finalPrice || booking.estimatedPrice || 0);
  return Math.round(payableAmount * 100);
}

function buildReceipt(bookingId) {
  const compactId = String(bookingId).replace(/[^a-zA-Z0-9]/g, "").slice(-18);
  const timestamp = Date.now().toString().slice(-8);
  return `booking_${compactId}_${timestamp}`.slice(0, 40);
}

async function createBooking(request, response) {
  const customer = request.user;
  const validationError = validateBookingPayload(request.body);

  if (validationError) {
    return response.status(400).json({
      success: false,
      message: validationError,
      errors: null,
    });
  }

  const { helperId, contactPhone, scheduledDate, issueDescription, address, paymentMethod } =
    request.body;
  const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
  const initialPaymentFields = createInitialPaymentFields(normalizedPaymentMethod);

  if (!isFutureDate(scheduledDate)) {
    return response.status(400).json({
      success: false,
      message: "Scheduled date must be in the future",
      errors: null,
    });
  }

  if (!isDatabaseReady()) {
    const helper = mockHelpers.find((item) => item.id === helperId);

    if (!helper) {
      return response.status(404).json({
        success: false,
        message: "Helper not found",
        errors: null,
      });
    }

    if (
      helper.availabilityConfig &&
      !isScheduledDateWithinAvailability(scheduledDate, helper.availabilityConfig)
    ) {
      return response.status(400).json({
        success: false,
        message: "Selected time is outside the helper's available slots",
        errors: null,
      });
    }

    const booking = {
      id: `booking-${mockBookings.length + 1}`,
      customerId: customer._id?.toString?.() || customer.id,
      helperId,
      helperName: helper.name,
      category: helper.category,
      customerName: customer.fullName,
      customerEmail: customer.email || "",
      contactPhone,
      scheduledDate,
      issueDescription,
      address,
      lastRescheduledAt: null,
      rescheduleReason: "",
      rescheduleCount: 0,
      estimatedPrice: Number.parseInt(helper.price.replace(/\D/g, ""), 10) || 0,
      currency: "INR",
      paymentMethod: normalizedPaymentMethod,
      ...initialPaymentFields,
      paymentReference: "",
      paymentGatewayOrderId: "",
      paymentGatewayPaymentId: "",
      paymentFailureReason: "",
      cancelledAt: null,
      cancellationReason: "",
      cancelledByRole: "",
      status: "requested",
      createdAt: new Date().toISOString(),
    };

    mockBookings.push(booking);

    return response.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: formatBooking(booking),
    });
  }

  const helperProfile = await resolveHelperProfile(helperId);

  if (!helperProfile) {
    return response.status(404).json({
      success: false,
      message: "Helper not found",
      errors: null,
    });
  }

  if (!helperProfile.isAvailable) {
    return response.status(400).json({
      success: false,
      message: "This helper is currently unavailable for booking",
      errors: null,
    });
  }

  if (!isScheduledDateWithinAvailability(scheduledDate, helperProfile.availability)) {
    return response.status(400).json({
      success: false,
      message: "Selected time is outside the helper's available slots",
      errors: null,
    });
  }

  const serviceCategoryId = helperProfile.serviceCategories?.[0]?._id;

  if (!serviceCategoryId) {
    return response.status(400).json({
      success: false,
      message: "Selected helper does not have a service category configured",
      errors: null,
    });
  }

  const booking = await Booking.create({
    customer: customer._id,
    customerName: customer.fullName,
    customerEmail: customer.email || "",
    helperProfile: helperProfile._id,
    serviceCategory: serviceCategoryId,
    scheduledDate,
    issueDescription,
    contactPhone,
    address,
    lastRescheduledAt: null,
    rescheduleReason: "",
    rescheduleCount: 0,
    estimatedPrice: helperProfile.pricing?.minPrice || 0,
    currency: "INR",
    paymentMethod: normalizedPaymentMethod,
    ...initialPaymentFields,
    paymentReference: "",
    paymentGatewayOrderId: "",
    paymentGatewayPaymentId: "",
    paymentFailureReason: "",
    cancelledAt: null,
    cancellationReason: "",
    cancelledByRole: "",
    status: "requested",
  });

  const savedBooking = await buildBookingQuery({ _id: booking._id });
  await sendBookingLifecycleNotifications(savedBooking, "created");

  return response.status(201).json({
    success: true,
    message: "Booking created successfully",
    data: formatBooking(savedBooking),
  });
}

async function createBookingPaymentOrder(request, response) {
  const customer = request.user;
  const { id } = request.params;

  if (!isDatabaseReady()) {
    return response.status(400).json({
      success: false,
      message: "Real online payments are available only with MongoDB mode",
    });
  }

  if (!isRazorpayConfigured()) {
    return response.status(503).json({
      success: false,
      message: "Razorpay keys are not configured on the server",
    });
  }

  const booking = await resolveCustomerBooking(id, customer);

  if (!booking) {
    return response.status(404).json({
      success: false,
      message: "Booking not found",
    });
  }

  if (booking.paymentMethod === "cash") {
    return response.status(400).json({
      success: false,
      message: "Cash bookings do not require online checkout",
    });
  }

  if (booking.paymentStatus === "paid") {
    return response.status(400).json({
      success: false,
      message: "This booking has already been paid for",
    });
  }

  const amount = getBookingChargeAmount(booking);

  if (amount <= 0) {
    return response.status(400).json({
      success: false,
      message: "This booking does not have a payable amount yet",
    });
  }

  const order = await createRazorpayOrder({
    amount,
    currency: booking.currency || "INR",
    receipt: buildReceipt(booking._id),
    notes: {
      bookingId: booking._id.toString(),
      helperName: booking.helperProfile?.user?.fullName || "",
      customerName: booking.customerName,
    },
  });

  booking.paymentProvider = "razorpay";
  booking.paymentGatewayOrderId = order.id;
  booking.paymentGatewayPaymentId = "";
  booking.paymentGatewaySignature = "";
  booking.paymentFailureReason = "";
  booking.paymentStatus = "pending";
  await booking.save();

  const updatedBooking = await buildBookingQuery({ _id: booking._id });

  return response.json({
    success: true,
    message: "Payment order created successfully",
    data: {
      keyId: env.razorpayKeyId,
      merchantName: env.businessName,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      preferredMethod: updatedBooking.paymentMethod,
      booking: formatBooking(updatedBooking),
    },
  });
}

async function verifyBookingPayment(request, response) {
  const customer = request.user;
  const { id } = request.params;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = request.body;

  if (!isDatabaseReady()) {
    return response.status(400).json({
      success: false,
      message: "Real online payments are available only with MongoDB mode",
    });
  }

  if (!isRazorpayConfigured()) {
    return response.status(503).json({
      success: false,
      message: "Razorpay keys are not configured on the server",
    });
  }

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return response.status(400).json({
      success: false,
      message: "Missing Razorpay payment verification details",
    });
  }

  const booking = await resolveCustomerBooking(id, customer);

  if (!booking) {
    return response.status(404).json({
      success: false,
      message: "Booking not found",
    });
  }

  if (booking.paymentMethod === "cash") {
    return response.status(400).json({
      success: false,
      message: "Cash bookings cannot be verified with Razorpay",
    });
  }

  if (booking.paymentGatewayOrderId && booking.paymentGatewayOrderId !== razorpay_order_id) {
    return response.status(400).json({
      success: false,
      message: "Payment order does not match this booking",
    });
  }

  const isAuthentic = verifyRazorpaySignature({
    orderId: booking.paymentGatewayOrderId || razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });

  if (!isAuthentic) {
    return response.status(400).json({
      success: false,
      message: "Payment signature verification failed",
    });
  }

  const paymentEntity = await fetchRazorpayPayment(razorpay_payment_id);

  if (paymentEntity.order_id !== (booking.paymentGatewayOrderId || razorpay_order_id)) {
    return response.status(400).json({
      success: false,
      message: "Payment does not belong to this booking order",
    });
  }

  const settledPayment = await captureAuthorizedRazorpayPayment(paymentEntity, {
    amount: getBookingChargeAmount(booking),
    currency: booking.currency || "INR",
  });

  applyRazorpayPaymentToBooking(booking, settledPayment);
  booking.paymentGatewaySignature = razorpay_signature;
  await booking.save();

  const updatedBooking = await buildBookingQuery({ _id: booking._id });

  return response.json({
    success: true,
    message: "Payment verified successfully",
    data: formatBooking(updatedBooking),
  });
}

async function syncBookingPayment(request, response) {
  const customer = request.user;
  const { id } = request.params;
  const { razorpay_order_id, razorpay_payment_id } = request.body || {};

  if (!isDatabaseReady()) {
    return response.status(400).json({
      success: false,
      message: "Real online payments are available only with MongoDB mode",
    });
  }

  if (!isRazorpayConfigured()) {
    return response.status(503).json({
      success: false,
      message: "Razorpay keys are not configured on the server",
    });
  }

  const booking = await resolveCustomerBooking(id, customer);

  if (!booking) {
    return response.status(404).json({
      success: false,
      message: "Booking not found",
    });
  }

  if (booking.paymentMethod === "cash") {
    return response.status(400).json({
      success: false,
      message: "Cash bookings do not have online payment status to sync",
    });
  }

  let paymentEntity = null;

  if (razorpay_payment_id) {
    paymentEntity = await fetchRazorpayPayment(razorpay_payment_id);
  } else {
    const orderId = razorpay_order_id || booking.paymentGatewayOrderId;

    if (!orderId) {
      return response.json({
        success: true,
        message: "No Razorpay order has been created for this booking yet",
        data: formatBooking(booking),
      });
    }

    const orderPayments = await fetchRazorpayOrderPayments(orderId);
    paymentEntity = selectBestRazorpayPayment(orderPayments.items || []);
  }

  if (!paymentEntity) {
    return response.json({
      success: true,
      message: "No payment attempt found yet for this booking",
      data: formatBooking(booking),
    });
  }

  if (
    booking.paymentGatewayOrderId &&
    paymentEntity.order_id &&
    booking.paymentGatewayOrderId !== paymentEntity.order_id
  ) {
    return response.status(400).json({
      success: false,
      message: "Payment does not belong to this booking",
    });
  }

  const settledPayment = await captureAuthorizedRazorpayPayment(paymentEntity, {
    amount: getBookingChargeAmount(booking),
    currency: booking.currency || "INR",
  });

  applyRazorpayPaymentToBooking(booking, settledPayment);
  await booking.save();

  const updatedBooking = await buildBookingQuery({ _id: booking._id });

  return response.json({
    success: true,
    message: "Payment status synced successfully",
    data: formatBooking(updatedBooking),
  });
}

async function getMyBookings(request, response) {
  const customer = request.user;

  if (!isDatabaseReady()) {
    return response.json({
      success: true,
      message: "Bookings fetched successfully",
      data: mockBookings
        .filter((booking) => booking.customerId === (customer._id?.toString?.() || customer.id))
        .map(formatBooking),
    });
  }

  const bookings = await Booking.find({ customer: customer._id })
    .populate({
      path: "helperProfile",
      populate: { path: "user", select: "fullName avatarUrl" },
    })
    .populate({
      path: "review",
      populate: { path: "customer", select: "fullName avatarUrl" },
    })
    .populate("serviceCategory", "name")
    .sort({ createdAt: -1 });

  return response.json({
    success: true,
    message: "Bookings fetched successfully",
    data: bookings.map(formatBooking),
  });
}

async function getBookingById(request, response) {
  const currentUser = request.user;
  const { id } = request.params;

  if (!isDatabaseReady()) {
    let booking = null;

    if (currentUser.role === "admin") {
      booking = mockBookings.find((item) => item.id === id) || null;
    } else if (currentUser.role === "helper") {
      const helper = findMockHelperForUser(currentUser);
      booking =
        helper && mockBookings.find((item) => item.id === id && item.helperId === helper.id);
    } else {
      booking =
        mockBookings.find(
          (item) => item.id === id && item.customerId === (currentUser._id?.toString?.() || currentUser.id)
        ) || null;
    }

    if (!booking) {
      return response.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    return response.json({
      success: true,
      message: "Booking fetched successfully",
      data: formatBooking(booking),
    });
  }

  const booking = await resolveAccessibleBooking(id, currentUser);

  if (!booking) {
    return response.status(404).json({
      success: false,
      message: "Booking not found",
    });
  }

  return response.json({
    success: true,
    message: "Booking fetched successfully",
    data: formatBooking(booking),
  });
}

async function getHelperBookings(request, response) {
  const helperUser = request.user;

  if (!isDatabaseReady()) {
    const helper = findMockHelperForUser(helperUser);

    if (!helper) {
      return response.status(404).json({
        success: false,
        message: "Create your helper profile first",
      });
    }

    return response.json({
      success: true,
      message: "Helper bookings fetched successfully",
      data: mockBookings
        .filter((booking) => booking.helperId === helper.id)
        .map(formatBooking),
    });
  }

  const helperProfile = await resolveCurrentHelperProfile(helperUser);

  if (!helperProfile) {
    return response.status(404).json({
      success: false,
      message: "Create your helper profile first",
    });
  }

  const bookings = await Booking.find({ helperProfile: helperProfile._id })
    .populate({
      path: "helperProfile",
      populate: { path: "user", select: "fullName avatarUrl" },
    })
    .populate({
      path: "review",
      populate: { path: "customer", select: "fullName avatarUrl" },
    })
    .populate("serviceCategory", "name")
    .sort({ createdAt: -1 });

  return response.json({
    success: true,
    message: "Helper bookings fetched successfully",
    data: bookings.map(formatBooking),
  });
}

async function updateBookingStatus(request, response) {
  const helperUser = request.user;
  const { id } = request.params;
  const { status } = request.body;
  const cancellationReason = normalizeOptionalReason(request.body?.reason);
  const reasonError =
    status === "cancelled"
      ? validateReasonLength(cancellationReason, "Cancellation reason")
      : null;

  if (!helperEditableStatuses.includes(status)) {
    return response.status(400).json({
      success: false,
      message: "Invalid booking status",
    });
  }

  if (reasonError) {
    return response.status(400).json({
      success: false,
      message: reasonError,
    });
  }

  if (!isDatabaseReady()) {
    const helper = findMockHelperForUser(helperUser);

    if (!helper) {
      return response.status(404).json({
        success: false,
        message: "Create your helper profile first",
      });
    }

    const booking = mockBookings.find((item) => item.id === id && item.helperId === helper.id);

    if (!booking) {
      return response.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (!isTransitionAllowed(booking.status, status)) {
      return response.status(400).json({
        success: false,
        message: `Cannot change booking from ${booking.status} to ${status}`,
      });
    }

    booking.status = status;

    if (status === "cancelled") {
      booking.cancelledAt = new Date().toISOString();
      booking.cancellationReason = cancellationReason;
      booking.cancelledByRole = helperUser.role === "admin" ? "admin" : "helper";
      await sendBookingLifecycleNotifications(booking, "cancelled", {
        reason: cancellationReason,
      });
    } else {
      if (status === "completed") {
        helper.completedJobs = Number(helper.completedJobs || 0) + 1;
      }

      await sendBookingLifecycleNotifications(booking, "status_updated");
    }

    return response.json({
      success: true,
      message: "Booking status updated successfully",
      data: formatBooking(booking),
    });
  }

  if (!mongoose.isValidObjectId(id)) {
    return response.status(404).json({
      success: false,
      message: "Booking not found",
    });
  }

  const helperProfile = await resolveCurrentHelperProfile(helperUser);

  if (!helperProfile) {
    return response.status(404).json({
      success: false,
      message: "Create your helper profile first",
    });
  }

  const booking = await buildBookingQuery({
    _id: id,
    helperProfile: helperProfile._id,
  });

  if (!booking) {
    return response.status(404).json({
      success: false,
      message: "Booking not found",
    });
  }

  if (!isTransitionAllowed(booking.status, status)) {
    return response.status(400).json({
      success: false,
      message: `Cannot change booking from ${booking.status} to ${status}`,
    });
  }

  booking.status = status;

  if (status === "cancelled") {
    booking.cancelledAt = new Date();
    booking.cancellationReason = cancellationReason;
    booking.cancelledByRole = helperUser.role === "admin" ? "admin" : "helper";
  }

  await booking.save();

  if (status === "completed") {
    await HelperProfile.findByIdAndUpdate(booking.helperProfile._id, {
      $inc: { completedJobs: 1 },
    });
  }

  const updatedBooking = await buildBookingQuery({ _id: booking._id });

  if (status === "cancelled") {
    await sendBookingLifecycleNotifications(updatedBooking, "cancelled", {
      reason: cancellationReason,
    });
  } else {
    await sendBookingLifecycleNotifications(updatedBooking, "status_updated");
  }

  return response.json({
    success: true,
    message: "Booking status updated successfully",
    data: formatBooking(updatedBooking),
  });
}

async function rescheduleBooking(request, response) {
  const customer = request.user;
  const { id } = request.params;
  const nextScheduledDate = request.body?.scheduledDate;
  const rescheduleReason = normalizeOptionalReason(request.body?.reason);
  const reasonError = validateReasonLength(rescheduleReason, "Reschedule reason");

  if (!nextScheduledDate) {
    return response.status(400).json({
      success: false,
      message: "Scheduled date is required",
    });
  }

  if (reasonError) {
    return response.status(400).json({
      success: false,
      message: reasonError,
    });
  }

  if (!isFutureDate(nextScheduledDate)) {
    return response.status(400).json({
      success: false,
      message: "Rescheduled date must be in the future",
    });
  }

  if (!isDatabaseReady()) {
    const booking =
      customer.role === "admin"
        ? mockBookings.find((item) => item.id === id)
        : mockBookings.find(
            (item) => item.id === id && item.customerId === (customer._id?.toString?.() || customer.id)
          );

    if (!booking) {
      return response.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (!canCustomerRescheduleBooking(booking)) {
      return response.status(400).json({
        success: false,
        message: "This booking can no longer be rescheduled",
      });
    }

    const helper = mockHelpers.find((item) => item.id === booking.helperId);

    if (
      helper?.availabilityConfig &&
      !isScheduledDateWithinAvailability(nextScheduledDate, helper.availabilityConfig)
    ) {
      return response.status(400).json({
        success: false,
        message: "Selected time is outside the helper's available slots",
      });
    }

    booking.scheduledDate = nextScheduledDate;
    booking.lastRescheduledAt = new Date().toISOString();
    booking.rescheduleReason = rescheduleReason;
    booking.rescheduleCount = Number(booking.rescheduleCount || 0) + 1;

    await sendBookingLifecycleNotifications(booking, "rescheduled", {
      reason: rescheduleReason,
    });

    return response.json({
      success: true,
      message: "Booking rescheduled successfully",
      data: formatBooking(booking),
    });
  }

  const booking = await resolveCustomerBooking(id, customer);

  if (!booking) {
    return response.status(404).json({
      success: false,
      message: "Booking not found",
    });
  }

  if (!canCustomerRescheduleBooking(booking)) {
    return response.status(400).json({
      success: false,
      message: "This booking can no longer be rescheduled",
    });
  }

  if (!isScheduledDateWithinAvailability(nextScheduledDate, booking.helperProfile?.availability)) {
    return response.status(400).json({
      success: false,
      message: "Selected time is outside the helper's available slots",
    });
  }

  booking.scheduledDate = nextScheduledDate;
  booking.lastRescheduledAt = new Date();
  booking.rescheduleReason = rescheduleReason;
  booking.rescheduleCount = Number(booking.rescheduleCount || 0) + 1;
  await booking.save();

  const updatedBooking = await buildBookingQuery({ _id: booking._id });
  await sendBookingLifecycleNotifications(updatedBooking, "rescheduled", {
    reason: rescheduleReason,
  });

  return response.json({
    success: true,
    message: "Booking rescheduled successfully",
    data: formatBooking(updatedBooking),
  });
}

async function cancelBooking(request, response) {
  const customer = request.user;
  const { id } = request.params;
  const cancellationReason = normalizeOptionalReason(request.body?.reason);
  const reasonError = validateReasonLength(cancellationReason, "Cancellation reason");

  if (reasonError) {
    return response.status(400).json({
      success: false,
      message: reasonError,
    });
  }

  if (!isDatabaseReady()) {
    const booking =
      customer.role === "admin"
        ? mockBookings.find((item) => item.id === id)
        : mockBookings.find(
            (item) => item.id === id && item.customerId === (customer._id?.toString?.() || customer.id)
          );

    if (!booking) {
      return response.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (!canCustomerCancelBooking(booking)) {
      return response.status(400).json({
        success: false,
        message: "Booking can only be cancelled before the helper accepts it",
      });
    }

    booking.status = "cancelled";
    booking.cancelledAt = new Date().toISOString();
    booking.cancellationReason = cancellationReason;
    booking.cancelledByRole = customer.role === "admin" ? "admin" : "customer";

    await sendBookingLifecycleNotifications(booking, "cancelled", {
      reason: cancellationReason,
    });

    return response.json({
      success: true,
      message: "Booking cancelled successfully",
      data: formatBooking(booking),
    });
  }

  const booking = await resolveCustomerBooking(id, customer);

  if (!booking) {
    return response.status(404).json({
      success: false,
      message: "Booking not found",
    });
  }

  if (!canCustomerCancelBooking(booking)) {
    return response.status(400).json({
      success: false,
      message: "Booking can only be cancelled before the helper accepts it",
    });
  }

  booking.status = "cancelled";
  booking.cancelledAt = new Date();
  booking.cancellationReason = cancellationReason;
  booking.cancelledByRole = customer.role === "admin" ? "admin" : "customer";
  await booking.save();

  const updatedBooking = await buildBookingQuery({ _id: booking._id });
  await sendBookingLifecycleNotifications(updatedBooking, "cancelled", {
    reason: cancellationReason,
  });

  return response.json({
    success: true,
    message: "Booking cancelled successfully",
    data: formatBooking(updatedBooking),
  });
}

async function getBookingMessages(request, response) {
  const currentUser = request.user;
  const { id } = request.params;

  if (!isDatabaseReady()) {
    const booking = resolveMockAccessibleBooking(id, currentUser);

    if (!booking) {
      return response.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const messages = mockBookingMessages
      .filter((message) => message.bookingId === booking.id)
      .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
      .map(formatBookingMessage);

    return response.json({
      success: true,
      message: "Booking chat fetched successfully",
      data: messages,
    });
  }

  const booking = await resolveAccessibleBooking(id, currentUser);

  if (!booking) {
    return response.status(404).json({
      success: false,
      message: "Booking not found",
    });
  }

  const messages = await BookingMessage.find({ booking: booking._id })
    .populate("sender", "fullName role")
    .sort({ createdAt: 1 });

  return response.json({
    success: true,
    message: "Booking chat fetched successfully",
    data: messages.map(formatBookingMessage),
  });
}

async function createBookingMessage(request, response) {
  const currentUser = request.user;
  const { id } = request.params;
  const validationError = validateBookingMessagePayload(request.body || {});

  if (validationError) {
    return response.status(400).json({
      success: false,
      message: validationError,
    });
  }

  const messageBody = String(request.body.message || request.body.body || "").trim();

  if (!isDatabaseReady()) {
    const booking = resolveMockAccessibleBooking(id, currentUser);

    if (!booking) {
      return response.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const message = {
      id: `chat-${mockBookingMessages.length + 1}`,
      bookingId: booking.id,
      senderId: currentUser._id?.toString?.() || currentUser.id,
      senderName: currentUser.fullName || "User",
      senderRole: currentUser.role || "customer",
      body: messageBody,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockBookingMessages.push(message);

    return response.status(201).json({
      success: true,
      message: "Chat message sent successfully",
      data: formatBookingMessage(message),
    });
  }

  const booking = await resolveAccessibleBooking(id, currentUser);

  if (!booking) {
    return response.status(404).json({
      success: false,
      message: "Booking not found",
    });
  }

  const bookingMessage = await BookingMessage.create({
    booking: booking._id,
    sender: currentUser._id,
    senderRole: currentUser.role || "customer",
    senderName: currentUser.fullName || "User",
    body: messageBody,
  });

  const savedMessage = await BookingMessage.findById(bookingMessage._id).populate(
    "sender",
    "fullName role"
  );

  await sendBookingChatNotification(booking, currentUser, messageBody);

  return response.status(201).json({
    success: true,
    message: "Chat message sent successfully",
    data: formatBookingMessage(savedMessage),
  });
}

async function createBookingReview(request, response) {
  const customer = request.user;
  const { id } = request.params;
  const validationError = validateReviewPayload(request.body || {});

  if (validationError) {
    return response.status(400).json({
      success: false,
      message: validationError,
    });
  }

  if (!isDatabaseReady()) {
    return response.status(400).json({
      success: false,
      message: "Reviews are available only with MongoDB mode",
    });
  }

  if (!mongoose.isValidObjectId(id)) {
    return response.status(404).json({
      success: false,
      message: "Booking not found",
    });
  }

  const booking = await buildBookingQuery({
    _id: id,
    customer: customer._id,
  });

  if (!booking) {
    return response.status(404).json({
      success: false,
      message: "Booking not found",
    });
  }

  if (booking.status !== "completed") {
    return response.status(400).json({
      success: false,
      message: "Only completed bookings can be reviewed",
    });
  }

  const rating = Number(request.body.rating);
  const comment = String(request.body.comment || "").trim();
  const hadExistingReview = Boolean(booking.review);
  let review = booking.review;

  if (review) {
    review.rating = rating;
    review.comment = comment;
    review.status = "published";
    await review.save();
  } else {
    review = await Review.create({
      booking: booking._id,
      customer: customer._id,
      helperProfile: booking.helperProfile._id,
      rating,
      comment,
      status: "published",
    });

    booking.review = review._id;
    await booking.save();
  }

  await refreshHelperReviewSummary(booking.helperProfile._id);

  const updatedBooking = await buildBookingQuery({ _id: booking._id });

  return response.status(hadExistingReview ? 200 : 201).json({
    success: true,
    message: hadExistingReview ? "Review updated successfully" : "Review submitted successfully",
    data: formatBooking(updatedBooking),
  });
}

export {
  cancelBooking,
  createBooking,
  createBookingMessage,
  createBookingReview,
  createBookingPaymentOrder,
  getBookingById,
  getBookingMessages,
  getHelperBookings,
  getMyBookings,
  rescheduleBooking,
  syncBookingPayment,
  updateBookingStatus,
  verifyBookingPayment,
};
