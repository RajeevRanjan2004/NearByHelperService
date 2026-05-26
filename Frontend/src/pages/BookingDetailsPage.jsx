import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import BookingStatusTimeline from "../components/bookings/BookingStatusTimeline";
import Avatar from "../components/common/Avatar";
import { useAuth } from "../contexts/AuthContext";
import {
  cancelBooking,
  fetchBookingById,
  fetchBookingMessages,
  fetchHelperById,
  rescheduleBooking,
  sendBookingMessage,
} from "../services/api";
import { getBookingStatusLabel } from "../utils/bookingStatus";

const statusMeta = {
  requested: "bg-rust-500/12 text-rust-700",
  accepted: "bg-teal-700/10 text-teal-700",
  rejected: "bg-black/8 text-ink-900",
  in_progress: "bg-amber-500/15 text-amber-700",
  completed: "bg-emerald-500/15 text-emerald-700",
  cancelled: "bg-black/8 text-muted-600",
};

const paymentStatusMeta = {
  cash_on_service: "bg-sand-50 text-ink-900",
  pending: "bg-amber-500/15 text-amber-700",
  paid: "bg-emerald-500/15 text-emerald-700",
  failed: "bg-rust-500/12 text-rust-700",
};

const paymentMethodLabels = {
  cash: "Cash on service",
  upi: "UPI",
  card: "Card",
  wallet: "Wallet",
};

const paymentStatusLabels = {
  cash_on_service: "Cash on service",
  pending: "Pending confirmation",
  paid: "Paid",
  failed: "Failed",
};

const refundStatusLabels = {
  none: "No refund",
  pending: "Refund pending",
  partial: "Partially refunded",
  refunded: "Refunded",
  failed: "Refund failed",
};

const senderRoleLabels = {
  customer: "Customer",
  helper: "Helper",
  admin: "Admin",
};

function formatCurrency(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function buildInvoiceNumber(bookingId) {
  return `INV-${String(bookingId).replace(/[^a-zA-Z0-9]/g, "").slice(-10).toUpperCase()}`;
}

function toDateTimeLocalValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function BookingDetailsPage() {
  const { bookingId } = useParams();
  const { user } = useAuth();
  const [booking, setBooking] = useState(null);
  const [helper, setHelper] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [manageForm, setManageForm] = useState({
    scheduledDate: "",
    reason: "",
  });
  const [manageState, setManageState] = useState({
    isSubmitting: false,
    successMessage: "",
    errorMessage: "",
  });
  const [messages, setMessages] = useState([]);
  const [chatForm, setChatForm] = useState({
    message: "",
  });
  const [chatState, setChatState] = useState({
    isLoading: false,
    isSubmitting: false,
    errorMessage: "",
  });
  const [chatRefreshKey, setChatRefreshKey] = useState(0);

  useEffect(() => {
    async function loadBooking() {
      setIsLoading(true);

      try {
        const data = await fetchBookingById(bookingId);
        setBooking(data);
        setManageForm({
          scheduledDate: toDateTimeLocalValue(data.scheduledDate),
          reason: "",
        });
        setErrorMessage("");
      } catch (error) {
        setBooking(null);
        setErrorMessage(
          error.response?.data?.message || "Booking details could not be loaded right now."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadBooking();
  }, [bookingId]);

  useEffect(() => {
    async function loadHelper() {
      if (!booking?.helperId) {
        setHelper(null);
        return;
      }

      try {
        const data = await fetchHelperById(booking.helperId);
        setHelper(data);
      } catch (_error) {
        setHelper(null);
      }
    }

    loadHelper();
  }, [booking?.helperId]);

  useEffect(() => {
    if (!booking?.id) {
      setMessages([]);
      setChatState((current) => ({
        ...current,
        isLoading: false,
        errorMessage: "",
      }));
      return undefined;
    }

    let isActive = true;

    async function loadMessages(silent = false) {
      if (!silent) {
        setChatState((current) => ({
          ...current,
          isLoading: true,
          errorMessage: "",
        }));
      }

      try {
        const data = await fetchBookingMessages(booking.id);

        if (!isActive) {
          return;
        }

        setMessages(data || []);
        setChatState((current) => ({
          ...current,
          isLoading: false,
          errorMessage: "",
        }));
      } catch (error) {
        if (!isActive) {
          return;
        }

        setChatState((current) => ({
          ...current,
          isLoading: false,
          errorMessage:
            error.response?.data?.message || "Booking chat could not be loaded right now.",
        }));
      }
    }

    loadMessages();
    const intervalId = window.setInterval(() => {
      loadMessages(true);
    }, 15000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [booking?.id, chatRefreshKey]);

  const invoiceData = useMemo(() => {
    if (!booking) {
      return null;
    }

    const serviceAmount = Number(booking.finalPrice || booking.estimatedPrice || 0);
    const refundedAmount = Number(booking.refundedAmount || 0);
    const netAmount = Math.max(serviceAmount - refundedAmount, 0);

    return {
      invoiceNumber: buildInvoiceNumber(booking.id),
      serviceAmount,
      refundedAmount,
      netAmount,
      issuedAt: booking.paymentCapturedAt || booking.createdAt,
    };
  }, [booking]);

  const canManageBooking = useMemo(() => {
    return (
      Boolean(booking) &&
      ["customer", "admin"].includes(user?.role || "") &&
      ["requested", "accepted"].includes(booking.status)
    );
  }, [booking, user?.role]);

  const canCancelBooking = useMemo(() => {
    return (
      Boolean(booking) &&
      ["customer", "admin"].includes(user?.role || "") &&
      booking.status === "requested"
    );
  }, [booking, user?.role]);

  function handlePrint() {
    window.print();
  }

  function handleManageFormChange(event) {
    const { name, value } = event.target;
    setManageForm((current) => ({ ...current, [name]: value }));
  }

  function handleSlotSelect(slot) {
    setManageForm((current) => ({
      ...current,
      scheduledDate: toDateTimeLocalValue(slot.startAt),
    }));
  }

  function handleChatFormChange(event) {
    const { value } = event.target;
    setChatForm({
      message: value,
    });
  }

  async function handleReschedule(event) {
    event.preventDefault();
    setManageState({
      isSubmitting: true,
      successMessage: "",
      errorMessage: "",
    });

    try {
      const updatedBooking = await rescheduleBooking(booking.id, {
        scheduledDate: manageForm.scheduledDate,
        reason: manageForm.reason,
      });
      setBooking(updatedBooking);
      setManageForm({
        scheduledDate: toDateTimeLocalValue(updatedBooking.scheduledDate),
        reason: "",
      });
      setManageState({
        isSubmitting: false,
        successMessage: "Booking rescheduled successfully.",
        errorMessage: "",
      });
    } catch (error) {
      setManageState({
        isSubmitting: false,
        successMessage: "",
        errorMessage:
          error.response?.data?.message || "Booking could not be rescheduled right now.",
      });
    }
  }

  async function handleCancelBooking() {
    const confirmed = window.confirm(
      "Do you want to cancel this booking? This action updates the helper and booking history."
    );

    if (!confirmed) {
      return;
    }

    setManageState({
      isSubmitting: true,
      successMessage: "",
      errorMessage: "",
    });

    try {
      const updatedBooking = await cancelBooking(booking.id, {
        reason: manageForm.reason,
      });
      setBooking(updatedBooking);
      setManageForm((current) => ({
        ...current,
        reason: "",
      }));
      setManageState({
        isSubmitting: false,
        successMessage: "Booking cancelled successfully.",
        errorMessage: "",
      });
    } catch (error) {
      setManageState({
        isSubmitting: false,
        successMessage: "",
        errorMessage:
          error.response?.data?.message || "Booking could not be cancelled right now.",
      });
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();
    setChatState((current) => ({
      ...current,
      isSubmitting: true,
      errorMessage: "",
    }));

    try {
      const nextMessage = await sendBookingMessage(booking.id, {
        message: chatForm.message,
      });
      setMessages((current) => [...current, nextMessage]);
      setChatForm({
        message: "",
      });
      setChatState((current) => ({
        ...current,
        isSubmitting: false,
        errorMessage: "",
      }));
    } catch (error) {
      setChatState((current) => ({
        ...current,
        isSubmitting: false,
        errorMessage: error.response?.data?.message || "Message could not be sent right now.",
      }));
    }
  }

  if (isLoading) {
    return (
      <section className="mx-auto w-[min(1120px,calc(100%-32px))] py-12">
        <div className="h-80 animate-pulse rounded-[28px] border border-black/5 bg-white/50" />
      </section>
    );
  }

  if (!booking) {
    return (
      <section className="mx-auto w-[min(1120px,calc(100%-32px))] py-12">
        <div className="rounded-[28px] border border-black/5 bg-white/70 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
          <h1 className="text-3xl font-black text-ink-900">Booking not found</h1>
          <p className="mt-3 text-sm text-muted-600">{errorMessage}</p>
          <Link
            className="mt-5 inline-flex items-center justify-center rounded-2xl bg-teal-700/10 px-4 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-700/15"
            to={user?.role === "helper" ? "/helper-dashboard" : user?.role === "admin" ? "/admin-dashboard" : "/bookings"}
          >
            Go back
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-[min(1120px,calc(100%-32px))] py-12">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 print-hidden">
        <div>
          <p className="inline-flex rounded-full bg-teal-700/10 px-4 py-2 text-sm font-bold text-teal-700">
            Booking detail
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.03em] text-ink-900 md:text-5xl">
            {booking.helperName || "Service booking"}
          </h1>
          <p className="mt-3 max-w-2xl text-muted-600">
            Full request summary, payment details, and printable invoice for booking #{booking.id}.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
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
              Rebook helper
            </Link>
          ) : null}
          <button
            className="rounded-2xl bg-rust-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-rust-700"
            onClick={handlePrint}
            type="button"
          >
            Print invoice
          </button>
          <Link
            className="rounded-2xl bg-teal-700/10 px-4 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-700/15"
            to={user?.role === "helper" ? "/helper-dashboard" : user?.role === "admin" ? "/admin-dashboard" : "/bookings"}
          >
            Back
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] print:grid-cols-1">
        <article className="print-surface rounded-[28px] border border-black/5 bg-white/70 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.08em] text-muted-600">
                Service summary
              </p>
              <h2 className="mt-2 text-2xl font-black text-ink-900">{booking.serviceCategory}</h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <span
                className={[
                  "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.08em]",
                  statusMeta[booking.status] || statusMeta.cancelled,
                ].join(" ")}
              >
                {getBookingStatusLabel(booking.status)}
              </span>
              <span
                className={[
                  "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.08em]",
                  paymentStatusMeta[booking.paymentStatus] || paymentStatusMeta.cash_on_service,
                ].join(" ")}
              >
                {paymentStatusLabels[booking.paymentStatus] || booking.paymentStatus}
              </span>
            </div>
          </div>

          <BookingStatusTimeline className="mt-6" status={booking.status} />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
                Customer
              </p>
              <p className="mt-1 text-sm font-semibold text-ink-900">{booking.customerName}</p>
              <p className="mt-1 text-sm text-muted-600">{booking.customerEmail || "No email provided"}</p>
              <p className="mt-1 text-sm text-muted-600">{booking.contactPhone}</p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
                Helper
              </p>
              <div className="mt-2 flex items-center gap-3">
                <Avatar
                  className="h-11 w-11"
                  name={booking.helperName}
                  src={booking.helperAvatarUrl}
                />
                <div>
                  <p className="text-sm font-semibold text-ink-900">{booking.helperName}</p>
                  <p className="mt-1 text-sm text-muted-600">{booking.serviceCategory}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
                Scheduled visit
              </p>
              <p className="mt-1 text-sm text-ink-900">
                {new Date(booking.scheduledDate).toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
                Service address
              </p>
              <p className="mt-1 text-sm text-ink-900">
                {[
                  booking.address?.addressLine1,
                  booking.address?.addressLine2,
                  booking.address?.city,
                  booking.address?.state,
                  booking.address?.postalCode,
                ]
                  .filter(Boolean)
                  .join(", ") || "Address not provided"}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
              Issue description
            </p>
            <p className="mt-2 rounded-[24px] bg-sand-50 p-4 text-sm text-muted-600">
              {booking.issueDescription}
            </p>
          </div>

          {booking.rescheduleCount ? (
            <div className="mt-6 rounded-[24px] bg-teal-700/8 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
                Reschedule history
              </p>
              <p className="mt-2 text-sm text-ink-900">
                Rescheduled {booking.rescheduleCount} time{booking.rescheduleCount > 1 ? "s" : ""}
              </p>
              {booking.lastRescheduledAt ? (
                <p className="mt-1 text-sm text-muted-600">
                  Last updated on {new Date(booking.lastRescheduledAt).toLocaleString()}
                </p>
              ) : null}
              {booking.rescheduleReason ? (
                <p className="mt-2 text-sm text-muted-600">Reason: {booking.rescheduleReason}</p>
              ) : null}
            </div>
          ) : null}

          {booking.status === "cancelled" ? (
            <div className="mt-6 rounded-[24px] bg-rust-500/8 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-rust-700">
                Cancellation details
              </p>
              {booking.cancelledAt ? (
                <p className="mt-2 text-sm text-ink-900">
                  Cancelled on {new Date(booking.cancelledAt).toLocaleString()}
                </p>
              ) : null}
              {booking.cancelledByRole ? (
                <p className="mt-1 text-sm text-muted-600">
                  Cancelled by {booking.cancelledByRole}
                </p>
              ) : null}
              {booking.cancellationReason ? (
                <p className="mt-2 text-sm text-muted-600">
                  Reason: {booking.cancellationReason}
                </p>
              ) : null}
            </div>
          ) : null}

          {booking.review ? (
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
                Customer review
              </p>
              <div className="mt-2 rounded-[24px] bg-teal-700/8 p-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    className="h-10 w-10"
                    name={booking.review.customerName}
                    src={booking.review.customerAvatarUrl}
                  />
                  <div>
                    <p className="text-sm font-bold text-ink-900">
                      {booking.review.customerName}
                    </p>
                    <p className="text-xs text-muted-600">Rating {booking.review.rating}/5</p>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-600">
                  {booking.review.comment || "No written review added."}
                </p>
              </div>
            </div>
          ) : null}
        </article>

        <aside className="print-surface rounded-[28px] border border-black/5 bg-white/70 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.08em] text-muted-600">
                Invoice
              </p>
              <h2 className="mt-2 text-2xl font-black text-ink-900">
                {invoiceData?.invoiceNumber}
              </h2>
            </div>
            <div className="text-right text-sm text-muted-600">
              <p>Issued</p>
              <p className="mt-1 font-semibold text-ink-900">
                {invoiceData?.issuedAt ? new Date(invoiceData.issuedAt).toLocaleString() : "Pending"}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 rounded-[24px] bg-sand-50 p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-600">Payment method</span>
              <span className="text-sm font-semibold text-ink-900">
                {paymentMethodLabels[booking.paymentMethod] || booking.paymentMethod}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-600">Payment reference</span>
              <span className="text-sm font-semibold text-ink-900">
                {booking.paymentReference || booking.paymentGatewayPaymentId || "Not available"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-600">Refund status</span>
              <span className="text-sm font-semibold text-ink-900">
                {refundStatusLabels[booking.refundStatus || "none"]}
              </span>
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-black/5 p-5">
            <div className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="text-muted-600">Service amount</span>
              <span className="font-semibold text-ink-900">
                {formatCurrency(invoiceData?.serviceAmount, booking.currency)}
              </span>
            </div>

            {invoiceData?.refundedAmount ? (
              <div className="flex items-center justify-between gap-3 border-t border-black/5 py-3 text-sm">
                <span className="text-muted-600">Refunded</span>
                <span className="font-semibold text-rust-700">
                  -{formatCurrency(invoiceData.refundedAmount, booking.currency)}
                </span>
              </div>
            ) : null}

            <div className="mt-2 flex items-center justify-between gap-3 border-t border-black/5 pt-4">
              <span className="text-base font-bold text-ink-900">Net total</span>
              <span className="text-2xl font-black text-ink-900">
                {formatCurrency(invoiceData?.netAmount, booking.currency)}
              </span>
            </div>
          </div>

          <div className="mt-6 rounded-[24px] bg-teal-700/8 p-5 text-sm text-muted-600">
            <p className="font-semibold text-ink-900">Invoice note</p>
            <p className="mt-2">
              This invoice is generated from the booking record. For cash bookings, final collection
              may happen during service completion. For online payments, the gateway reference above
              acts as the payment proof.
            </p>
          </div>

          {canManageBooking ? (
            <form
              className="print-hidden mt-6 rounded-[24px] border border-black/5 bg-sand-50 p-5"
              onSubmit={handleReschedule}
            >
              <h3 className="text-lg font-bold text-ink-900">Manage booking</h3>
              <p className="mt-2 text-sm text-muted-600">
                Reschedule this visit. Cancellation is available only before the helper accepts
                the booking. The helper will be notified by email when email delivery is enabled.
              </p>

              {helper?.bookingSlots?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {helper.bookingSlots.map((slot) => {
                    const selected =
                      manageForm.scheduledDate &&
                      toDateTimeLocalValue(slot.startAt) === manageForm.scheduledDate;

                    return (
                      <button
                        className={[
                          "rounded-2xl px-3 py-2 text-xs font-bold transition",
                          selected
                            ? "bg-rust-500 text-white"
                            : "bg-white text-ink-900 hover:bg-black/5",
                        ].join(" ")}
                        key={slot.id}
                        onClick={() => handleSlotSelect(slot)}
                        type="button"
                      >
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3">
                <input
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                  min={toDateTimeLocalValue(new Date())}
                  name="scheduledDate"
                  onChange={handleManageFormChange}
                  required
                  type="datetime-local"
                  value={manageForm.scheduledDate}
                />
                <textarea
                  className="min-h-24 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                  name="reason"
                  onChange={handleManageFormChange}
                  placeholder="Reason for reschedule or cancellation"
                  value={manageForm.reason}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="rounded-2xl bg-rust-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-rust-700 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={manageState.isSubmitting}
                  type="submit"
                >
                  {manageState.isSubmitting ? "Saving..." : "Save new time"}
                </button>
                {canCancelBooking ? (
                  <button
                    className="rounded-2xl bg-black/8 px-4 py-3 text-sm font-bold text-ink-900 transition hover:bg-black/12 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={manageState.isSubmitting}
                    onClick={handleCancelBooking}
                    type="button"
                  >
                    Cancel booking
                  </button>
                ) : null}
              </div>

              {!canCancelBooking ? (
                <p className="mt-3 text-sm text-muted-600">
                  The helper has already accepted this booking, so the cancel option is now locked.
                </p>
              ) : null}
            </form>
          ) : null}

          {manageState.successMessage ? (
            <p className="print-hidden mt-4 text-sm font-medium text-teal-700">
              {manageState.successMessage}
            </p>
          ) : null}

          {manageState.errorMessage ? (
            <p className="print-hidden mt-4 text-sm font-medium text-rust-700">
              {manageState.errorMessage}
            </p>
          ) : null}
        </aside>
      </div>

      <section className="print-hidden mt-4 rounded-[28px] border border-black/5 bg-white/70 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.08em] text-muted-600">
              Booking chat
            </p>
            <h2 className="mt-2 text-2xl font-black text-ink-900">
              Customer and helper conversation
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-600">
              Use this space to coordinate arrival time, address details, or service updates for
              this booking.
            </p>
          </div>

          <button
            className="rounded-2xl bg-teal-700/10 px-4 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-700/15"
            onClick={() => setChatRefreshKey((current) => current + 1)}
            type="button"
          >
            Refresh chat
          </button>
        </div>

        {chatState.errorMessage ? (
          <p className="mt-4 rounded-2xl bg-rust-500/12 px-4 py-3 text-sm font-medium text-rust-700">
            {chatState.errorMessage}
          </p>
        ) : null}

        <div className="mt-5 rounded-[24px] bg-sand-50 p-4">
          {chatState.isLoading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((item) => (
                <div
                  className="h-16 animate-pulse rounded-[20px] bg-white/80"
                  key={item}
                />
              ))}
            </div>
          ) : messages.length ? (
            <div className="grid max-h-[420px] gap-3 overflow-y-auto pr-1">
              {messages.map((message) => {
                const isOwnMessage = message.senderId && message.senderId === user?.id;

                return (
                  <div
                    className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                    key={message.id}
                  >
                    <article
                      className={[
                        "max-w-[min(520px,100%)] rounded-[22px] px-4 py-3 shadow-[0_10px_24px_rgba(22,33,38,0.06)]",
                        isOwnMessage
                          ? "bg-rust-500 text-white"
                          : "border border-black/5 bg-white text-ink-900",
                      ].join(" ")}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.08em]">
                        <span>{message.senderName}</span>
                        <span className={isOwnMessage ? "text-white/80" : "text-muted-600"}>
                          {senderRoleLabels[message.senderRole] || message.senderRole}
                        </span>
                      </div>
                      <p className={`mt-2 text-sm ${isOwnMessage ? "text-white" : "text-muted-600"}`}>
                        {message.body}
                      </p>
                      <p
                        className={`mt-2 text-xs ${
                          isOwnMessage ? "text-white/80" : "text-muted-600"
                        }`}
                      >
                        {message.createdAt ? new Date(message.createdAt).toLocaleString() : ""}
                      </p>
                    </article>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[20px] border border-dashed border-black/10 bg-white/70 px-4 py-6 text-sm text-muted-600">
              No chat messages yet. Send the first update to start the conversation.
            </div>
          )}
        </div>

        <form className="mt-5 grid gap-3" onSubmit={handleSendMessage}>
          <textarea
            className="min-h-28 rounded-[24px] border border-black/10 bg-white px-4 py-3 text-sm outline-none"
            name="message"
            onChange={handleChatFormChange}
            placeholder="Type a message for this booking"
            required
            value={chatForm.message}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="rounded-2xl bg-rust-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-rust-700 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={chatState.isSubmitting}
              type="submit"
            >
              {chatState.isSubmitting ? "Sending..." : "Send message"}
            </button>
            <p className="text-sm text-muted-600">
              Messages refresh automatically every 15 seconds while this page is open.
            </p>
          </div>
        </form>
      </section>
    </section>
  );
}

export default BookingDetailsPage;
