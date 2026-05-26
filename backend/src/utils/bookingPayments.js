function convertMinorToMajor(amount) {
  return Number((Number(amount || 0) / 100).toFixed(2));
}

function convertMajorToMinor(amount) {
  return Math.round(Number(amount || 0) * 100);
}

function applyRazorpayPaymentToBooking(booking, paymentEntity) {
  if (!paymentEntity) {
    return booking;
  }

  const nextPaymentMethod = ["upi", "card", "wallet"].includes(paymentEntity.method)
    ? paymentEntity.method
    : booking.paymentMethod;
  const isCaptured = paymentEntity.captured === true || paymentEntity.status === "captured";

  booking.paymentProvider = "razorpay";
  booking.paymentMethod = nextPaymentMethod;
  booking.paymentGatewayOrderId = paymentEntity.order_id || booking.paymentGatewayOrderId || "";
  booking.paymentGatewayPaymentId = paymentEntity.id || booking.paymentGatewayPaymentId || "";
  booking.paymentReference = paymentEntity.id || booking.paymentReference || "";
  booking.paymentFailureReason =
    paymentEntity.error_description || paymentEntity.error_reason || "";
  booking.paymentStatus = isCaptured
    ? "paid"
    : paymentEntity.status === "failed"
      ? "failed"
      : "pending";
  booking.paymentCapturedAt = isCaptured ? new Date() : null;

  return booking;
}

function calculateRefundStatus(booking) {
  const refunds = Array.isArray(booking.refunds) ? booking.refunds : [];
  const processedRefundAmount = refunds
    .filter((refund) => refund.status === "processed")
    .reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
  const hasPendingRefund = refunds.some((refund) => ["created", "pending"].includes(refund.status));
  const hasFailedRefund = refunds.some((refund) => refund.status === "failed");
  const paidAmount = Number(booking.finalPrice || booking.estimatedPrice || 0);

  booking.refundedAmount = Number(processedRefundAmount.toFixed(2));

  if (booking.refundedAmount >= paidAmount && paidAmount > 0) {
    booking.refundStatus = "refunded";
    return booking;
  }

  if (booking.refundedAmount > 0) {
    booking.refundStatus = "partial";
    return booking;
  }

  if (hasPendingRefund) {
    booking.refundStatus = "pending";
    return booking;
  }

  if (hasFailedRefund) {
    booking.refundStatus = "failed";
    return booking;
  }

  booking.refundStatus = "none";
  return booking;
}

function upsertRefundOnBooking(booking, refundEntity) {
  if (!refundEntity) {
    return booking;
  }

  const nextRefund = {
    refundId: refundEntity.id || "",
    amount: convertMinorToMajor(refundEntity.amount),
    currency: refundEntity.currency || booking.currency || "INR",
    status: refundEntity.status || "created",
    receipt: refundEntity.receipt || "",
    speedRequested: refundEntity.speed_requested || "",
    speedProcessed: refundEntity.speed_processed || "",
    notes: refundEntity.notes || {},
    createdAt: refundEntity.created_at ? new Date(refundEntity.created_at * 1000) : new Date(),
  };

  const refunds = Array.isArray(booking.refunds) ? [...booking.refunds] : [];
  const existingRefundIndex = refunds.findIndex(
    (refund) => refund.refundId === nextRefund.refundId
  );

  if (existingRefundIndex >= 0) {
    refunds[existingRefundIndex] = {
      ...refunds[existingRefundIndex],
      ...nextRefund,
    };
  } else {
    refunds.unshift(nextRefund);
  }

  booking.refunds = refunds;
  calculateRefundStatus(booking);

  return booking;
}

export {
  applyRazorpayPaymentToBooking,
  calculateRefundStatus,
  convertMajorToMinor,
  convertMinorToMajor,
  upsertRefundOnBooking,
};
