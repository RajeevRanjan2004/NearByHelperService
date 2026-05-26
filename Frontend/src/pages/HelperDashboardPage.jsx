import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BookingStatusTimeline from "../components/bookings/BookingStatusTimeline";
import { fetchHelperBookings, updateBookingStatus } from "../services/api";
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

function HelperDashboardPage() {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionState, setActionState] = useState({
    bookingId: "",
    errorMessage: "",
  });

  useEffect(() => {
    loadBookings();
  }, []);

  async function loadBookings() {
    setIsLoading(true);

    try {
      const data = await fetchHelperBookings();
      setBookings(data || []);
      setErrorMessage("");
    } catch (error) {
      setBookings([]);
      setErrorMessage(
        error.response?.data?.message ||
          "Helper bookings could not be loaded right now."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStatusUpdate(bookingId, status) {
    setActionState({
      bookingId,
      errorMessage: "",
    });

    try {
      const updatedBooking = await updateBookingStatus(bookingId, status);
      setBookings((current) =>
        current.map((booking) => (booking.id === bookingId ? updatedBooking : booking))
      );
    } catch (error) {
      setActionState({
        bookingId: "",
        errorMessage:
          error.response?.data?.message ||
          "Booking status could not be updated right now.",
      });
      return;
    }

    setActionState({
      bookingId: "",
      errorMessage: "",
    });
  }

  async function handleHelperCancellation(booking) {
    const reason = window.prompt(
      "If you cannot continue this service, enter a short reason.",
      booking.cancellationReason || ""
    );

    if (reason === null) {
      return;
    }

    await handleStatusUpdate(booking.id, {
      status: "cancelled",
      reason,
    });
  }

  const stats = useMemo(() => {
    const summary = {
      total: bookings.length,
      requested: 0,
      accepted: 0,
      completed: 0,
    };

    bookings.forEach((booking) => {
      if (booking.status === "requested") {
        summary.requested += 1;
      }

      if (booking.status === "accepted" || booking.status === "in_progress") {
        summary.accepted += 1;
      }

      if (booking.status === "completed") {
        summary.completed += 1;
      }
    });

    return summary;
  }, [bookings]);

  function renderActions(booking) {
    if (booking.status === "requested") {
      return (
        <>
          <button
            className="rounded-2xl bg-teal-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-teal-800"
            disabled={actionState.bookingId === booking.id}
            onClick={() => handleStatusUpdate(booking.id, "accepted")}
            type="button"
          >
            Accept
          </button>
          <button
            className="rounded-2xl bg-rust-500/12 px-4 py-3 text-sm font-bold text-rust-700 transition hover:bg-rust-500/18"
            disabled={actionState.bookingId === booking.id}
            onClick={() => handleStatusUpdate(booking.id, "rejected")}
            type="button"
          >
            Reject
          </button>
        </>
      );
    }

    if (booking.status === "accepted") {
      return (
        <>
          <button
            className="rounded-2xl bg-teal-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-teal-800"
            disabled={actionState.bookingId === booking.id}
            onClick={() => handleStatusUpdate(booking.id, "in_progress")}
            type="button"
          >
            Start Work
          </button>
          <button
            className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
            disabled={actionState.bookingId === booking.id}
            onClick={() => handleStatusUpdate(booking.id, "completed")}
            type="button"
          >
            Mark Complete
          </button>
          <button
            className="rounded-2xl bg-black/8 px-4 py-3 text-sm font-bold text-ink-900 transition hover:bg-black/12"
            disabled={actionState.bookingId === booking.id}
            onClick={() => handleHelperCancellation(booking)}
            type="button"
          >
            Cancel booking
          </button>
        </>
      );
    }

    if (booking.status === "in_progress") {
      return (
        <button
          className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
          disabled={actionState.bookingId === booking.id}
          onClick={() => handleStatusUpdate(booking.id, "completed")}
          type="button"
        >
          Mark Complete
        </button>
      );
    }

    return null;
  }

  return (
    <section className="mx-auto w-[min(1120px,calc(100%-32px))] py-12">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="inline-flex rounded-full bg-teal-700/10 px-4 py-2 text-sm font-bold text-teal-700">
            Helper dashboard
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.03em] text-ink-900 md:text-5xl">
            Incoming service requests
          </h1>
          <p className="mt-3 max-w-2xl text-muted-600">
            Review new bookings, accept work, track active jobs, and mark completed
            services from one place.
          </p>
        </div>

        <Link
          className="inline-flex items-center justify-center rounded-2xl bg-rust-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-rust-700"
          to="/become-helper"
        >
          Edit helper profile
        </Link>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <article className="rounded-[26px] border border-black/5 bg-white/70 p-5 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
          <p className="text-sm font-semibold text-muted-600">Total requests</p>
          <div className="mt-2 text-3xl font-black text-ink-900">{stats.total}</div>
        </article>
        <article className="rounded-[26px] border border-black/5 bg-white/70 p-5 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
          <p className="text-sm font-semibold text-muted-600">Pending review</p>
          <div className="mt-2 text-3xl font-black text-rust-700">{stats.requested}</div>
        </article>
        <article className="rounded-[26px] border border-black/5 bg-white/70 p-5 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
          <p className="text-sm font-semibold text-muted-600">Active work</p>
          <div className="mt-2 text-3xl font-black text-teal-700">{stats.accepted}</div>
        </article>
        <article className="rounded-[26px] border border-black/5 bg-white/70 p-5 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
          <p className="text-sm font-semibold text-muted-600">Completed jobs</p>
          <div className="mt-2 text-3xl font-black text-emerald-700">{stats.completed}</div>
        </article>
      </div>

      {errorMessage ? (
        <div className="mb-6 rounded-[24px] border border-rust-500/10 bg-rust-500/8 p-5">
          <p className="text-sm font-medium text-rust-700">{errorMessage}</p>
          {errorMessage.includes("Create your helper profile first") ? (
            <Link
              className="mt-4 inline-flex items-center justify-center rounded-2xl bg-rust-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-rust-700"
              to="/become-helper"
            >
              Create helper profile
            </Link>
          ) : null}
        </div>
      ) : null}

      {actionState.errorMessage ? (
        <div className="mb-6 rounded-[24px] border border-rust-500/10 bg-rust-500/8 p-5">
          <p className="text-sm font-medium text-rust-700">{actionState.errorMessage}</p>
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((item) => (
            <div
              className="h-56 animate-pulse rounded-[28px] border border-black/5 bg-white/50"
              key={item}
            />
          ))}
        </div>
      ) : bookings.length ? (
        <div className="grid gap-4">
          {bookings.map((booking) => (
            <article
              className="rounded-[28px] border border-black/5 bg-white/70 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)]"
              key={booking.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-ink-900">{booking.customerName}</h2>
                  <p className="mt-1 text-sm text-muted-600">
                    {booking.serviceCategory} | {booking.customerEmail || "No email provided"}
                  </p>
                </div>

                <span
                  className={[
                    "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.08em]",
                    statusMeta[booking.status] || statusMeta.cancelled,
                  ].join(" ")}
                >
                  {getBookingStatusLabel(booking.status)}
                </span>
              </div>

              <BookingStatusTimeline className="mt-5" status={booking.status} />

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                    Contact phone
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
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <div className="rounded-full bg-black/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
                  Payment: {(booking.paymentMethod || "cash").replace("_", " ")}
                </div>
                <div
                  className={[
                    "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.08em]",
                    paymentStatusMeta[booking.paymentStatus] || paymentStatusMeta.cash_on_service,
                  ].join(" ")}
                >
                  {(booking.paymentStatus || "cash_on_service").replace("_", " ")}
                </div>
                {booking.paymentReference ? (
                  <div className="rounded-full bg-black/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
                    Ref: {booking.paymentReference}
                  </div>
                ) : null}
              </div>

              <div className="mt-5">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
                  Issue details
                </p>
                <p className="mt-2 text-sm text-muted-600">{booking.issueDescription}</p>
              </div>

              {booking.status === "accepted" ? (
                <p className="mt-4 text-sm text-muted-600">
                  If you cannot take this visit, you can cancel the booking before starting
                  the work.
                </p>
              ) : null}

              {booking.status === "cancelled" ? (
                <div className="mt-4 rounded-[20px] bg-rust-500/8 px-4 py-3 text-sm text-muted-600">
                  Cancelled
                  {booking.cancelledByRole ? ` by ${booking.cancelledByRole}` : ""}
                  {booking.cancellationReason ? ` | ${booking.cancellationReason}` : ""}
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  className="rounded-2xl bg-teal-700/10 px-4 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-700/15"
                  to={`/bookings/${booking.id}`}
                >
                  Open details
                </Link>
                {renderActions(booking)}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[28px] border border-black/5 bg-white/70 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
          <h2 className="text-xl font-bold text-ink-900">No incoming requests yet</h2>
          <p className="mt-3 text-sm text-muted-600">
            Once customers start booking your service, new requests will appear here.
          </p>
        </div>
      )}
    </section>
  );
}

export default HelperDashboardPage;
