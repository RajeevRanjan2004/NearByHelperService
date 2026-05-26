function toPlainObject(value) {
  return value && typeof value.toObject === "function" ? value.toObject() : value;
}

function formatCategory(category) {
  const item = toPlainObject(category);

  return {
    id: item.id || item.slug || item._id?.toString(),
    name: item.name,
    slug: item.slug || item.id,
    icon: item.icon || item.name?.slice(0, 2)?.toUpperCase() || "SV",
    description: item.description || "High-demand local service support.",
  };
}

function formatPrice(pricing) {
  const minPrice = pricing?.minPrice;
  const unit = pricing?.priceUnit;

  if (!minPrice) {
    return "Price on request";
  }

  if (unit === "per_day") {
    return `Starts at Rs ${minPrice}/day`;
  }

  if (unit === "per_hour") {
    return `Starts at Rs ${minPrice}/hour`;
  }

  return `Starts at Rs ${minPrice}`;
}

function formatAvailability(availability, isAvailable) {
  if (!isAvailable) {
    return "Currently unavailable";
  }

  if (availability?.days?.length && availability?.startTime && availability?.endTime) {
    const slotDuration = availability?.slotDurationMinutes
      ? ` | ${availability.slotDurationMinutes} min slots`
      : "";
    return `${availability.days.join(", ")} | ${availability.startTime}-${availability.endTime}${slotDuration}`;
  }

  return "Available on request";
}

function formatArea(serviceArea) {
  const area = [serviceArea?.city, serviceArea?.state].filter(Boolean).join(", ");
  return area || "Nearby area";
}

function formatExperience(years) {
  return years ? `${years} years experience` : "Experienced helper";
}

function formatRole(role) {
  if (!role) {
    return "Helper";
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatCoordinates(value) {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  const [longitude, latitude] = value;

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}

function formatHelper(helperProfile) {
  const item = toPlainObject(helperProfile);

  if (item.name && item.category) {
    return {
      ...item,
      role: item.role || "helper",
      roleLabel: item.roleLabel || formatRole(item.role || "helper"),
      avatarUrl: item.avatarUrl || "",
      minPrice: item.minPrice || 0,
      maxPrice: item.maxPrice || item.minPrice || 0,
      priceUnit: item.priceUnit || "per_visit",
      city: item.city || "",
      state: item.state || "",
      postalCodes: Array.isArray(item.postalCodes) ? item.postalCodes : [],
      verificationStatus:
        item.verificationStatus || (item.verified ? "approved" : "pending"),
      verificationDocumentUrl: item.verificationDocumentUrl || "",
      verificationDocumentLabel: item.verificationDocumentLabel || "",
      coordinates: item.coordinates || null,
      portfolioPhotos: Array.isArray(item.portfolioPhotos) ? item.portfolioPhotos : [],
      completedJobs: item.completedJobs || 0,
    };
  }

  const categories = item.serviceCategories || [];
  const primaryCategory = categories[0];
  const role = item.role || item.user?.role || "helper";

  return {
    id: item.slug || item._id?.toString(),
    name: item.user?.fullName || "Local Helper",
    role,
    roleLabel: formatRole(role),
    avatarUrl: item.user?.avatarUrl || item.avatarUrl || "",
    category: primaryCategory?.name || "General Service",
    area: formatArea(item.serviceArea),
    city: item.serviceArea?.city || "",
    state: item.serviceArea?.state || "",
    postalCodes: Array.isArray(item.serviceArea?.postalCodes)
      ? item.serviceArea.postalCodes
      : [],
    rating: item.averageRating || 0,
    price: formatPrice(item.pricing),
    minPrice: item.pricing?.minPrice || 0,
    maxPrice: item.pricing?.maxPrice || 0,
    priceUnit: item.pricing?.priceUnit || "per_visit",
    experience: formatExperience(item.yearsOfExperience),
    verified: Boolean(item.isVerified),
    verificationStatus: item.verificationStatus || "pending",
    verificationDocumentUrl: item.verificationDocumentUrl || "",
    verificationDocumentLabel: item.verificationDocumentLabel || "",
    coordinates: formatCoordinates(item.serviceArea?.coordinates),
    portfolioPhotos: Array.isArray(item.portfolioPhotos) ? item.portfolioPhotos : [],
    availability: formatAvailability(item.availability, item.isAvailable),
    availabilityConfig: item.availability
      ? {
          days: item.availability.days || [],
          startTime: item.availability.startTime || "",
          endTime: item.availability.endTime || "",
          slotDurationMinutes: item.availability.slotDurationMinutes || 60,
        }
      : null,
    bookingSlots: Array.isArray(item.bookingSlots) ? item.bookingSlots : [],
    bio: item.bio || item.headline || "Trusted local professional for household service requests.",
    completedJobs: item.completedJobs || 0,
    totalReviews: item.totalReviews || 0,
    reviews: Array.isArray(item.reviews) ? item.reviews.map(formatReview) : [],
    tags: [
      ...(item.isVerified ? ["Verified"] : []),
      ...(primaryCategory?.name ? [primaryCategory.name] : []),
      ...(item.isAvailable ? ["Available"] : ["On Request"]),
    ],
  };
}

function formatReview(review) {
  const item = toPlainObject(review);

  return {
    id: item._id?.toString?.() || item.id,
    bookingId: item.booking?._id?.toString?.() || item.bookingId || item.booking,
    helperId:
      item.helperProfile?._id?.toString?.() || item.helperProfileId || item.helperProfile,
    customerName: item.customer?.fullName || item.customerName || "Customer",
    customerAvatarUrl: item.customer?.avatarUrl || item.customerAvatarUrl || "",
    rating: item.rating || 0,
    comment: item.comment || "",
    status: item.status || "published",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function formatBookingMessage(message) {
  const item = toPlainObject(message);

  return {
    id: item._id?.toString?.() || item.id,
    bookingId: item.booking?._id?.toString?.() || item.bookingId || item.booking,
    senderId: item.sender?._id?.toString?.() || item.senderId || item.sender || "",
    senderName: item.sender?.fullName || item.senderName || "User",
    senderRole: item.senderRole || item.sender?.role || "customer",
    body: item.body || item.message || "",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function formatBooking(booking) {
  const item = toPlainObject(booking);

  return {
    id: item.id || item._id?.toString(),
    customerName: item.customerName || "Customer",
    customerEmail: item.customerEmail || "",
    contactPhone: item.contactPhone,
    scheduledDate: item.scheduledDate,
    lastRescheduledAt: item.lastRescheduledAt || null,
    rescheduleReason: item.rescheduleReason || "",
    rescheduleCount: item.rescheduleCount || 0,
    issueDescription: item.issueDescription,
    status: item.status,
    createdAt: item.createdAt,
    address: item.address,
    helperId: item.helperProfile?.slug || item.helperProfile?._id?.toString() || item.helperId,
    helperName: item.helperProfile?.user?.fullName || item.helperName || "",
    helperAvatarUrl: item.helperProfile?.user?.avatarUrl || item.helperAvatarUrl || "",
    serviceCategory:
      item.serviceCategory?.name || item.serviceCategory || item.category || "General Service",
    estimatedPrice: item.estimatedPrice || 0,
    finalPrice: item.finalPrice || 0,
    currency: item.currency || "INR",
    paymentMethod: item.paymentMethod || "cash",
    paymentStatus: item.paymentStatus || "cash_on_service",
    paymentReference: item.paymentReference || "",
    paymentProvider: item.paymentProvider || "",
    paymentGatewayOrderId: item.paymentGatewayOrderId || "",
    paymentGatewayPaymentId: item.paymentGatewayPaymentId || "",
    paymentFailureReason: item.paymentFailureReason || "",
    paymentCapturedAt: item.paymentCapturedAt || null,
    refundedAmount: item.refundedAmount || 0,
    refundStatus: item.refundStatus || "none",
    refunds: Array.isArray(item.refunds)
      ? item.refunds.map((refund) => ({
          refundId: refund.refundId || refund.id || "",
          amount: refund.amount || 0,
          currency: refund.currency || item.currency || "INR",
          status: refund.status || "created",
          receipt: refund.receipt || "",
          speedRequested: refund.speedRequested || "",
          speedProcessed: refund.speedProcessed || "",
          createdAt: refund.createdAt || null,
        }))
      : [],
    review: item.review ? formatReview(item.review) : null,
    cancelledAt: item.cancelledAt || null,
    cancellationReason: item.cancellationReason || "",
    cancelledByRole: item.cancelledByRole || "",
    canInitiatePayment:
      (item.paymentMethod || "cash") !== "cash" &&
      ["pending", "failed"].includes(item.paymentStatus || "cash_on_service"),
  };
}

function formatComplaint(complaint) {
  const item = toPlainObject(complaint);

  return {
    id: item._id?.toString?.() || item.id,
    bookingId: item.booking?._id?.toString?.() || item.bookingId || item.booking,
    reporterName: item.reporterName || item.reporter?.fullName || "User",
    reporterEmail: item.reporterEmail || item.reporter?.email || "",
    targetName: item.targetName || item.targetUser?.fullName || "",
    category: item.category,
    description: item.description,
    status: item.status,
    createdAt: item.createdAt,
    resolvedAt: item.resolvedAt,
  };
}

export {
  formatBooking,
  formatBookingMessage,
  formatCategory,
  formatComplaint,
  formatHelper,
  formatReview,
};
