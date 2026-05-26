import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import {
  applyRazorpayPaymentToBooking,
  convertMajorToMinor,
  upsertRefundOnBooking,
} from "../utils/bookingPayments.js";
import { isDatabaseReady } from "../utils/dbState.js";
import {
  captureAuthorizedRazorpayPayment,
  createRazorpayRefund,
  isRazorpayConfigured,
  isRazorpayWebhookConfigured,
  verifyRazorpayWebhookSignature,
} from "../utils/razorpay.js";
import { formatBooking } from "../utils/serializers.js";

function buildBookingQuery(filter) {
  return Booking.findOne(filter)
    .populate({
      path: "helperProfile",
      populate: { path: "user", select: "fullName" },
    })
    .populate("serviceCategory", "name");
}

async function findBookingByPaymentData({ orderId, paymentId }) {
  const orConditions = [
    ...(orderId ? [{ paymentGatewayOrderId: orderId }] : []),
    ...(paymentId ? [{ paymentGatewayPaymentId: paymentId }] : []),
  ];

  if (!orConditions.length) {
    return null;
  }

  return buildBookingQuery({ $or: orConditions });
}

function getRawBody(request) {
  if (typeof request.rawBody === "string" && request.rawBody) {
    return request.rawBody;
  }

  return JSON.stringify(request.body || {});
}

async function handleRazorpayWebhook(request, response) {
  if (!isDatabaseReady()) {
    return response.json({
      success: true,
      message: "Webhook ignored because database mode is disabled",
    });
  }

  if (!isRazorpayWebhookConfigured()) {
    return response.status(503).json({
      success: false,
      message: "Razorpay webhook secret is not configured on the server",
    });
  }

  const signature = request.headers["x-razorpay-signature"];
  const payload = getRawBody(request);
  const isAuthentic = verifyRazorpayWebhookSignature({
    payload,
    signature,
  });

  if (!isAuthentic) {
    return response.status(400).json({
      success: false,
      message: "Invalid Razorpay webhook signature",
    });
  }

  const event = request.body?.event || "";
  const paymentEntity = request.body?.payload?.payment?.entity || null;
  const refundEntity = request.body?.payload?.refund?.entity || null;

  let booking = null;

  if (["payment.authorized", "payment.captured", "payment.failed", "order.paid"].includes(event)) {
    booking = await findBookingByPaymentData({
      orderId: paymentEntity?.order_id || request.body?.payload?.order?.entity?.id || "",
      paymentId: paymentEntity?.id || "",
    });

    if (booking && paymentEntity) {
      const settledPayment = await captureAuthorizedRazorpayPayment(paymentEntity, {
        amount: paymentEntity.amount,
        currency: paymentEntity.currency || booking.currency || "INR",
      });

      applyRazorpayPaymentToBooking(booking, settledPayment);
      await booking.save();
    }
  }

  if (["refund.created", "refund.processed", "refund.failed"].includes(event)) {
    booking = await findBookingByPaymentData({
      orderId: paymentEntity?.order_id || "",
      paymentId: refundEntity?.payment_id || paymentEntity?.id || "",
    });

    if (booking) {
      if (paymentEntity) {
        applyRazorpayPaymentToBooking(booking, paymentEntity);
      }

      upsertRefundOnBooking(booking, refundEntity);
      await booking.save();
    }
  }

  return response.json({
    success: true,
    message: "Webhook processed successfully",
    data: booking ? formatBooking(booking) : null,
  });
}

async function issueBookingRefund(request, response) {
  const { id } = request.params;
  const { amount, notes } = request.body || {};

  if (!isDatabaseReady()) {
    return response.status(400).json({
      success: false,
      message: "Refunds are available only with MongoDB mode",
    });
  }

  if (!isRazorpayConfigured()) {
    return response.status(503).json({
      success: false,
      message: "Razorpay keys are not configured on the server",
    });
  }

  if (!mongoose.isValidObjectId(id)) {
    return response.status(404).json({
      success: false,
      message: "Booking not found",
    });
  }

  const booking = await buildBookingQuery({ _id: id });

  if (!booking) {
    return response.status(404).json({
      success: false,
      message: "Booking not found",
    });
  }

  if (booking.paymentStatus !== "paid" || !booking.paymentGatewayPaymentId) {
    return response.status(400).json({
      success: false,
      message: "Only captured online payments can be refunded",
    });
  }

  const paidAmount = Number(booking.finalPrice || booking.estimatedPrice || 0);
  const remainingRefundable = Number((paidAmount - Number(booking.refundedAmount || 0)).toFixed(2));

  if (remainingRefundable <= 0) {
    return response.status(400).json({
      success: false,
      message: "This booking has already been fully refunded",
    });
  }

  const requestedAmount = amount ? Number(amount) : remainingRefundable;

  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    return response.status(400).json({
      success: false,
      message: "Refund amount must be greater than zero",
    });
  }

  if (requestedAmount > remainingRefundable) {
    return response.status(400).json({
      success: false,
      message: "Refund amount exceeds the remaining paid amount",
    });
  }

  const refund = await createRazorpayRefund(booking.paymentGatewayPaymentId, {
    amount: convertMajorToMinor(requestedAmount),
    speed: "normal",
    receipt: `refund_${booking._id.toString().slice(-12)}_${Date.now().toString().slice(-6)}`.slice(
      0,
      40
    ),
    notes: {
      bookingId: booking._id.toString(),
      ...(notes ? { note: String(notes) } : {}),
    },
  });

  upsertRefundOnBooking(booking, refund);
  await booking.save();

  const updatedBooking = await buildBookingQuery({ _id: booking._id });

  return response.json({
    success: true,
    message: "Refund initiated successfully",
    data: formatBooking(updatedBooking),
  });
}

export { handleRazorpayWebhook, issueBookingRefund };
