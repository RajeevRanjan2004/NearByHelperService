import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BookingStatusTimeline from "../components/bookings/BookingStatusTimeline";
import Avatar from "../components/common/Avatar";
import { useAuth } from "../contexts/AuthContext";
import {
  createBookingPaymentOrder,
  createComplaint,
  fetchBookings,
  fetchMyComplaints,
  submitBookingReview,
  syncBookingPayment,
  verifyBookingPayment,
} from "../services/api";
import { getBookingStatusLabel } from "../utils/bookingStatus";
import { openRazorpayCheckout } from "../utils/razorpay";

const complaintCategories = [
  "Helper did not arrive",
  "Poor service quality",
  "Pricing dispute",
  "Rude behaviour",
  "Safety concern",
];

const initialComplaintForm = {
  bookingId: "",
  category: complaintCategories[0],
  description: "",
};

const initialReviewForm = {
  rating: "5",
  comment: "",
};

const complaintStatusMeta = {
  open: "bg-rust-500/12 text-rust-700",
  in_review: "bg-amber-500/15 text-amber-700",
  resolved: "bg-emerald-500/15 text-emerald-700",
  dismissed: "bg-black/8 text-muted-600",
};

const paymentStatusMeta = {
  cash_on_service: "bg-sand-50 text-ink-900",
  pending: "bg-amber-500/15 text-amber-700",
  paid: "bg-emerald-500/15 text-emerald-700",
  failed: "bg-rust-500/12 text-rust-700",
};

const paymentStatusLabels = {
  cash_on_service: "Cash on service",
  pending: "Pending confirmation",
  paid: "Paid",
  failed: "Failed",
};

const paymentMethodLabels = {
  cash: "Cash on service",
  upi: "UPI",
  card: "Card",
  wallet: "Wallet",
};

const refundStatusLabels = {
  none: "No refund",
  pending: "Refund pending",
  partial: "Partially refunded",
  refunded: "Refunded",
  failed: "Refund failed",
};

function BookingsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeComplaintBookingId, setActiveComplaintBookingId] = useState("");
  const [activeReviewBookingId, setActiveReviewBookingId] = useState("");
  const [complaintForm, setComplaintForm] = useState(initialComplaintForm);
  const [reviewForm, setReviewForm] = useState(initialReviewForm);
  const [complaintState, setComplaintState] = useState({
    isSubmitting: false,
    errorMessage: "",
    successMessage: "",
  });
  const [reviewState, setReviewState] = useState({
    isSubmitting: false,
    errorMessage: "",
    successMessage: "",
  });
  const [paymentState, setPaymentState] = useState({
    bookingId: "",
    errorMessage: "",
    successMessage: "",
  });

  useEffect(() => {
    loadBookingData();
  }, []);

  async function loadBookingData() {
    setIsLoading(true);

    try {
      const [bookingData, complaintData] = await Promise.all([
        fetchBookings(),
        fetchMyComplaints(),
      ]);

      setBookings(bookingData || []);
      setComplaints(complaintData || []);
      setErrorMessage("");
    } catch (_error) {
      setBookings([]);
      setComplaints([]);
      setErrorMessage("Bookings API unavailable right now. Start the server to see requests.");
    } finally {
      setIsLoading(false);
    }
  }

  const complaintsByBookingId = useMemo(() => {
    return complaints.reduce((accumulator, complaint) => {
      accumulator[complaint.bookingId] = complaint;
      return accumulator;
    }, {});
  }, [complaints]);

  function replaceBooking(nextBooking) {
    setBookings((current) =>
      current.map((booking) => (booking.id === nextBooking.id ? nextBooking : booking))
    );
  }

  function openComplaintForm(bookingId) {
    setActiveComplaintBookingId(bookingId);
    setComplaintForm({
      ...initialComplaintForm,
      bookingId,
    });
    setComplaintState({
      isSubmitting: false,
      errorMessage: "",
      successMessage: "",
    });
  }

  function openReviewForm(booking) {
    setActiveReviewBookingId(booking.id);
    setReviewForm({
      rating: String(booking.review?.rating || 5),
      comment: booking.review?.comment || "",
    });
    setReviewState({
      isSubmitting: false,
      errorMessage: "",
      successMessage: "",
    });
  }

  function handleComplaintFormChange(event) {
    const { name, value } = event.target;
    setComplaintForm((current) => ({ ...current, [name]: value }));
  }

  function handleReviewFormChange(event) {
    const { name, value } = event.target;
    setReviewForm((current) => ({ ...current, [name]: value }));
  }

  async function handleComplaintSubmit(event) {
    event.preventDefault();

    setComplaintState({
      isSubmitting: true,
      errorMessage: "",
      successMessage: "",
    });

    try {
      const complaint = await createComplaint(complaintForm);
      setComplaints((current) => [complaint, ...current]);
      setComplaintState({
        isSubmitting: false,
        errorMessage: "",
        successMessage: "Complaint submitted successfully. Admin will review it soon.",
      });
      setActiveComplaintBookingId("");
      setComplaintForm(initialComplaintForm);
    } catch (error) {
      setComplaintState({
        isSubmitting: false,
        errorMessage:
          error.response?.data?.message || "Complaint could not be submitted right now.",
        successMessage: "",
      });
    }
  }

  async function handleReviewSubmit(event, bookingId) {
    event.preventDefault();

    setReviewState({
      isSubmitting: true,
      errorMessage: "",
      successMessage: "",
    });

    try {
      const updatedBooking = await submitBookingReview(bookingId, {
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment,
      });

      replaceBooking(updatedBooking);
      setReviewState({
        isSubmitting: false,
        errorMessage: "",
        successMessage: "Review saved successfully.",
      });
      setActiveReviewBookingId("");
    } catch (error) {
      setReviewState({
        isSubmitting: false,
        errorMessage:
          error.response?.data?.message || "Review could not be saved right now.",
        successMessage: "",
      });
    }
  }

  async function startPayment(booking) {
    setPaymentState({
      bookingId: booking.id,
      errorMessage: "",
      successMessage: "",
    });

    try {
      const checkoutOrder = await createBookingPaymentOrder(booking.id);

      if (checkoutOrder.booking) {
        replaceBooking(checkoutOrder.booking);
      }

      await openRazorpayCheckout({
        booking: checkoutOrder.booking || booking,
        checkoutOrder,
        customer: user,
        onSuccess: async (response) => {
          const verifiedBooking = await verifyBookingPayment(booking.id, response);
          replaceBooking(verifiedBooking);
          setPaymentState({
            bookingId: "",
            errorMessage: "",
            successMessage: `Payment completed for ${verifiedBooking.helperName || "your booking"}.`,
          });
        },
        onFailure: async (error) => {
          const syncedBooking = await syncBookingPayment(booking.id, {
            razorpay_order_id: error?.metadata?.order_id || checkoutOrder.orderId,
            razorpay_payment_id: error?.metadata?.payment_id || "",
          }).catch(() => null);

          if (syncedBooking) {
            replaceBooking(syncedBooking);
          }

          setPaymentState({
            bookingId: "",
            successMessage: "",
            errorMessage:
              error?.description || "Payment failed. You can retry the payment again.",
          });
        },
        onDismiss: async () => {
          const syncedBooking = await syncBookingPayment(booking.id, {
            razorpay_order_id: checkoutOrder.orderId,
          }).catch(() => null);

          if (syncedBooking) {
            replaceBooking(syncedBooking);
          }

          setPaymentState({
            bookingId: "",
            errorMessage: "",
            successMessage:
              "Checkout was closed. Booking is still pending payment and can be retried.",
          });
        },
      });
    } catch (error) {
      setPaymentState({
        bookingId: "",
        successMessage: "",
        errorMessage:
          error.response?.data?.message ||
          error.message ||
          "Payment checkout could not be started right now.",
      });
    }
  }

  async function refreshPaymentStatus(booking) {
    setPaymentState({
      bookingId: booking.id,
      errorMessage: "",
      successMessage: "",
    });

    try {
      const updatedBooking = await syncBookingPayment(booking.id);
      replaceBooking(updatedBooking);
      setPaymentState({
        bookingId: "",
        errorMessage: "",
        successMessage: `Payment status updated to ${
          paymentStatusLabels[updatedBooking.paymentStatus] || updatedBooking.paymentStatus
        }.`,
      });
    } catch (error) {
      setPaymentState({
        bookingId: "",
        successMessage: "",
        errorMessage:
          error.response?.data?.message ||
          error.message ||
          "Payment status could not be refreshed right now.",
      });
    }
  }

  return (
    <section className="mx-auto w-[min(1120px,calc(100%-32px))] py-12">
      <div className="mb-6">
        <p className="inline-flex rounded-full bg-teal-700/10 px-4 py-2 text-sm font-bold text-teal-700">
          Booking history
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.03em] text-ink-900 md:text-5xl">
          Service requests
        </h1>
        <p className="mt-3 max-w-2xl text-muted-600">
          This page shows booking requests for {user?.fullName || "your account"}. In
          MongoDB mode they persist in the database.
        </p>
        {errorMessage ? (
          <p className="mt-3 text-sm font-medium text-rust-700">{errorMessage}</p>
        ) : null}
        {paymentState.successMessage ? (
          <p className="mt-3 rounded-2xl bg-teal-700/10 px-4 py-3 text-sm font-medium text-teal-700">
            {paymentState.successMessage}
          </p>
        ) : null}
        {paymentState.errorMessage ? (
          <p className="mt-3 rounded-2xl bg-rust-500/12 px-4 py-3 text-sm font-medium text-rust-700">
            {paymentState.errorMessage}
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((item) => (
            <div
              className="h-40 animate-pulse rounded-[28px] border border-black/5 bg-white/50"
              key={item}
            />
          ))}
        </div>
      ) : bookings.length ? (
        <div className="grid gap-4">
          {bookings.map((booking) => {
            const complaint = complaintsByBookingId[booking.id];
            const isPaymentLoading = paymentState.bookingId === booking.id;

            return (
              <article
                className="rounded-[28px] border border-black/5 bg-white/70 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)]"
                key={booking.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <Avatar
                      className="h-14 w-14"
                      name={booking.helperName}
                      src={booking.helperAvatarUrl}
                    />
                    <div>
                      <h2 className="text-xl font-bold text-ink-900">
                        {booking.helperName || "Helper request"}
                      </h2>
                      <p className="mt-1 text-sm text-muted-600">
                        {booking.serviceCategory} | {booking.customerName}
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full bg-rust-500/12 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-rust-700">
                    {getBookingStatusLabel(booking.status)}
                  </span>
                </div>

                <BookingStatusTimeline className="mt-5" status={booking.status} />

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
                      Scheduled
                    </p>
                    <p className="mt-1 text-sm text-ink-900">
                      {new Date(booking.scheduledDate).toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
                      Contact
                    </p>
                    <p className="mt-1 text-sm text-ink-900">{booking.contactPhone}</p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
                      Address
                    </p>
                    <p className="mt-1 text-sm text-ink-900">
                      {[
                        booking.address?.addressLine1,
                        booking.address?.city,
                        booking.address?.postalCode,
                      ]
                        .filter(Boolean)
                        .join(", ") || "Address not provided"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
                      Estimated price
                    </p>
                    <p className="mt-1 text-sm text-ink-900">
                      {booking.estimatedPrice ? `Rs ${booking.estimatedPrice}` : "TBD"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
                      Payment method
                    </p>
                    <p className="mt-1 text-sm text-ink-900">
                      {paymentMethodLabels[booking.paymentMethod] || booking.paymentMethod}
                    </p>
                    {booking.paymentReference ? (
                      <p className="mt-1 text-xs text-muted-600">
                        Ref: {booking.paymentReference}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
                      Payment status
                    </p>
                    <span
                      className={[
                        "mt-1 inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.08em]",
                        paymentStatusMeta[booking.paymentStatus] || paymentStatusMeta.cash_on_service,
                      ].join(" ")}
                    >
                      {paymentStatusLabels[booking.paymentStatus] || booking.paymentStatus}
                    </span>
                    {booking.paymentFailureReason ? (
                      <p className="mt-2 text-xs text-rust-700">{booking.paymentFailureReason}</p>
                    ) : null}
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
                      Refund status
                    </p>
                    <p className="mt-1 text-sm text-ink-900">
                      {refundStatusLabels[booking.refundStatus || "none"]}
                    </p>
                    {booking.refundedAmount ? (
                      <p className="mt-1 text-xs text-muted-600">
                        Refunded amount: Rs {booking.refundedAmount}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
                    Issue details
                  </p>
                  <p className="mt-2 text-sm text-muted-600">{booking.issueDescription}</p>
                </div>

                {booking.rescheduleCount ? (
                  <div className="mt-4 rounded-[20px] bg-teal-700/8 px-4 py-3 text-sm text-muted-600">
                    Rescheduled {booking.rescheduleCount} time{booking.rescheduleCount > 1 ? "s" : ""}
                    {booking.lastRescheduledAt
                      ? ` | Last update ${new Date(booking.lastRescheduledAt).toLocaleString()}`
                      : ""}
                    {booking.rescheduleReason ? ` | ${booking.rescheduleReason}` : ""}
                  </div>
                ) : null}

                {booking.status === "cancelled" ? (
                  <div className="mt-4 rounded-[20px] bg-rust-500/8 px-4 py-3 text-sm text-muted-600">
                    Cancelled
                    {booking.cancelledAt
                      ? ` on ${new Date(booking.cancelledAt).toLocaleString()}`
                      : ""}
                    {booking.cancellationReason ? ` | ${booking.cancellationReason}` : ""}
                  </div>
                ) : null}

                {booking.status === "completed" ? (
                  <div className="mt-5 rounded-[24px] border border-black/5 bg-sand-50 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
                          Review
                        </p>
                        {booking.review ? (
                          <>
                            <p className="mt-2 text-sm font-semibold text-ink-900">
                              Rating {booking.review.rating}/5
                            </p>
                            <p className="mt-2 text-sm text-muted-600">
                              {booking.review.comment || "No written feedback added yet."}
                            </p>
                          </>
                        ) : (
                          <p className="mt-2 text-sm text-muted-600">
                            Service completed. Share a quick rating to help other customers.
                          </p>
                        )}
                      </div>

                      <button
                        className="rounded-2xl bg-teal-700/10 px-4 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-700/15"
                        onClick={() => openReviewForm(booking)}
                        type="button"
                      >
                        {booking.review ? "Edit review" : "Rate this service"}
                      </button>
                    </div>

                    {activeReviewBookingId === booking.id ? (
                      <form
                        className="mt-4 grid gap-3"
                        onSubmit={(event) => handleReviewSubmit(event, booking.id)}
                      >
                        <select
                          className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                          name="rating"
                          onChange={handleReviewFormChange}
                          value={reviewForm.rating}
                        >
                          {[5, 4, 3, 2, 1].map((rating) => (
                            <option key={rating} value={rating}>
                              {rating} star{rating > 1 ? "s" : ""}
                            </option>
                          ))}
                        </select>

                        <textarea
                          className="min-h-24 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                          name="comment"
                          onChange={handleReviewFormChange}
                          placeholder="What went well? Anything others should know?"
                          value={reviewForm.comment}
                        />

                        <div className="flex flex-wrap gap-3">
                          <button
                            className="rounded-2xl bg-rust-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-rust-700 disabled:cursor-not-allowed disabled:opacity-70"
                            disabled={reviewState.isSubmitting}
                            type="submit"
                          >
                            {reviewState.isSubmitting ? "Saving..." : "Save review"}
                          </button>
                          <button
                            className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-ink-900 transition hover:bg-black/5"
                            onClick={() => setActiveReviewBookingId("")}
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>

                        {reviewState.errorMessage ? (
                          <p className="text-sm font-medium text-rust-700">
                            {reviewState.errorMessage}
                          </p>
                        ) : null}

                        {reviewState.successMessage ? (
                          <p className="text-sm font-medium text-teal-700">
                            {reviewState.successMessage}
                          </p>
                        ) : null}
                      </form>
                    ) : null}
                  </div>
                ) : null}

                {booking.paymentMethod !== "cash" ? (
                  <div className="mt-5 flex flex-wrap gap-3">
                    {booking.canInitiatePayment ? (
                      <button
                        className="rounded-2xl bg-rust-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-rust-700 disabled:cursor-not-allowed disabled:opacity-70"
                        disabled={isPaymentLoading}
                        onClick={() => startPayment(booking)}
                        type="button"
                      >
                        {isPaymentLoading ? "Opening..." : "Pay now"}
                      </button>
                    ) : null}

                    {booking.paymentStatus === "pending" ? (
                      <button
                        className="rounded-2xl bg-teal-700/10 px-4 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-700/15 disabled:cursor-not-allowed disabled:opacity-70"
                        disabled={isPaymentLoading}
                        onClick={() => refreshPaymentStatus(booking)}
                        type="button"
                      >
                        {isPaymentLoading ? "Refreshing..." : "Refresh payment status"}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  {booking.helperId ? (
                    <Link
                      className="rounded-2xl bg-rust-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-rust-700"
                      state={{
                        prefillBooking: {
                          contactPhone: booking.contactPhone,
                          issueDescription: booking.issueDescription,
                          paymentMethod: booking.paymentMethod,
                          address: booking.address || {},
                        },
                      }}
                      to={`/helpers/${booking.helperId}`}
                    >
                      Book again
                    </Link>
                  ) : null}
                  <Link
                    className="rounded-2xl bg-teal-700/10 px-4 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-700/15"
                    to={`/bookings/${booking.id}`}
                  >
                    {["requested", "accepted"].includes(booking.status)
                      ? "Manage booking & invoice"
                      : "Open details & invoice"}
                  </Link>
                </div>

                {complaint ? (
                  <div className="mt-5 rounded-[24px] border border-black/5 bg-sand-50 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
                          Complaint filed
                        </p>
                        <p className="mt-2 text-sm font-semibold text-ink-900">
                          {complaint.category}
                        </p>
                        <p className="mt-2 text-sm text-muted-600">{complaint.description}</p>
                      </div>
                      <span
                        className={[
                          "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.08em]",
                          complaintStatusMeta[complaint.status] || complaintStatusMeta.dismissed,
                        ].join(" ")}
                      >
                        {complaint.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5">
                    {activeComplaintBookingId === booking.id ? (
                      <form
                        className="rounded-[24px] border border-black/5 bg-sand-50 p-5"
                        onSubmit={handleComplaintSubmit}
                      >
                        <p className="text-sm font-bold text-ink-900">Report an issue</p>
                        <p className="mt-2 text-sm text-muted-600">
                          Use this if there was a service problem, safety issue, or pricing dispute.
                        </p>

                        <div className="mt-4 grid gap-3">
                          <select
                            className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                            name="category"
                            onChange={handleComplaintFormChange}
                            value={complaintForm.category}
                          >
                            {complaintCategories.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>

                          <textarea
                            className="min-h-28 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                            name="description"
                            onChange={handleComplaintFormChange}
                            placeholder="Describe what went wrong"
                            required
                            value={complaintForm.description}
                          />

                          <div className="flex flex-wrap gap-3">
                            <button
                              className="rounded-2xl bg-rust-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-rust-700 disabled:cursor-not-allowed disabled:opacity-70"
                              disabled={complaintState.isSubmitting}
                              type="submit"
                            >
                              {complaintState.isSubmitting ? "Submitting..." : "Submit complaint"}
                            </button>
                            <button
                              className="rounded-2xl bg-teal-700/10 px-4 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-700/15"
                              onClick={() => setActiveComplaintBookingId("")}
                              type="button"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>

                        {complaintState.errorMessage ? (
                          <p className="mt-4 text-sm font-medium text-rust-700">
                            {complaintState.errorMessage}
                          </p>
                        ) : null}

                        {complaintState.successMessage ? (
                          <p className="mt-4 text-sm font-medium text-teal-700">
                            {complaintState.successMessage}
                          </p>
                        ) : null}
                      </form>
                    ) : (
                      <button
                        className="rounded-2xl bg-rust-500/12 px-4 py-3 text-sm font-bold text-rust-700 transition hover:bg-rust-500/18"
                        onClick={() => openComplaintForm(booking.id)}
                        type="button"
                      >
                        Report issue
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[28px] border border-black/5 bg-white/70 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
          <h2 className="text-xl font-bold text-ink-900">No bookings yet</h2>
          <p className="mt-3 text-sm text-muted-600">
            Create your first service request from a helper profile and it will show up
            here.
          </p>
          <Link
            className="mt-5 inline-flex items-center justify-center rounded-2xl bg-rust-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-rust-700"
            to="/helpers"
          >
            Find Helpers
          </Link>
        </div>
      )}
    </section>
  );
}

export default BookingsPage;
