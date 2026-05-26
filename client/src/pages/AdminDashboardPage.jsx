import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Avatar from "../components/common/Avatar";
import {
  fetchAdminComplaints,
  fetchAdminOverview,
  fetchPendingVerificationHelpers,
  issueAdminRefund,
  updateComplaintStatus,
  updateHelperVerification,
} from "../services/api";

const complaintStatuses = ["open", "in_review", "resolved", "dismissed"];
const refundStatusLabels = {
  none: "No refund",
  pending: "Refund pending",
  partial: "Partially refunded",
  refunded: "Refunded",
  failed: "Refund failed",
};

function AdminDashboardPage() {
  const [overview, setOverview] = useState({
    totalUsers: 0,
    totalHelpers: 0,
    totalBookings: 0,
    pendingVerifications: 0,
    openComplaints: 0,
    recentBookings: [],
  });
  const [pendingHelpers, setPendingHelpers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [refundAmounts, setRefundAmounts] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionState, setActionState] = useState({
    helperId: "",
    complaintId: "",
    bookingId: "",
    errorMessage: "",
  });

  useEffect(() => {
    loadAdminData();
  }, []);

  async function loadAdminData() {
    setIsLoading(true);

    try {
      const [overviewData, pendingData, complaintData] = await Promise.all([
        fetchAdminOverview(),
        fetchPendingVerificationHelpers(),
        fetchAdminComplaints(),
      ]);

      setOverview(overviewData);
      setPendingHelpers(pendingData || []);
      setComplaints(complaintData || []);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || "Admin dashboard could not be loaded right now."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerification(helperId, status) {
    setActionState({
      helperId,
      complaintId: "",
      bookingId: "",
      errorMessage: "",
    });

    try {
      await updateHelperVerification(helperId, status);
      await loadAdminData();
    } catch (error) {
      setActionState({
        helperId: "",
        complaintId: "",
        bookingId: "",
        errorMessage:
          error.response?.data?.message || "Verification action could not be completed.",
      });
      return;
    }

    setActionState({
      helperId: "",
      complaintId: "",
      bookingId: "",
      errorMessage: "",
    });
  }

  async function handleComplaintStatus(complaintId, status) {
    setActionState({
      helperId: "",
      complaintId,
      bookingId: "",
      errorMessage: "",
    });

    try {
      await updateComplaintStatus(complaintId, status);
      await loadAdminData();
    } catch (error) {
      setActionState({
        helperId: "",
        complaintId: "",
        bookingId: "",
        errorMessage:
          error.response?.data?.message || "Complaint action could not be completed.",
      });
      return;
    }

    setActionState({
      helperId: "",
      complaintId: "",
      bookingId: "",
      errorMessage: "",
    });
  }

  function handleRefundAmountChange(bookingId, value) {
    setRefundAmounts((current) => ({
      ...current,
      [bookingId]: value,
    }));
  }

  async function handleIssueRefund(booking) {
    setActionState({
      helperId: "",
      complaintId: "",
      bookingId: booking.id,
      errorMessage: "",
    });

    try {
      const amount = refundAmounts[booking.id];
      await issueAdminRefund(booking.id, {
        amount: amount ? Number(amount) : undefined,
      });
      setRefundAmounts((current) => ({
        ...current,
        [booking.id]: "",
      }));
      await loadAdminData();
    } catch (error) {
      setActionState({
        helperId: "",
        complaintId: "",
        bookingId: "",
        errorMessage:
          error.response?.data?.message || "Refund action could not be completed.",
      });
      return;
    }

    setActionState({
      helperId: "",
      complaintId: "",
      bookingId: "",
      errorMessage: "",
    });
  }

  return (
    <section className="mx-auto w-[min(1120px,calc(100%-32px))] py-12">
      <div className="mb-6">
        <p className="inline-flex rounded-full bg-teal-700/10 px-4 py-2 text-sm font-bold text-teal-700">
          Admin panel
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.03em] text-ink-900 md:text-5xl">
          Platform overview
        </h1>
        <p className="mt-3 max-w-2xl text-muted-600">
          Review platform activity, handle helper verification, and moderate customer
          complaints from one place.
        </p>
      </div>

      {errorMessage ? (
        <div className="mb-6 rounded-[24px] border border-rust-500/10 bg-rust-500/8 p-5">
          <p className="text-sm font-medium text-rust-700">{errorMessage}</p>
        </div>
      ) : null}

      {actionState.errorMessage ? (
        <div className="mb-6 rounded-[24px] border border-rust-500/10 bg-rust-500/8 p-5">
          <p className="text-sm font-medium text-rust-700">{actionState.errorMessage}</p>
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map((item) => (
            <div
              className="h-36 animate-pulse rounded-[26px] border border-black/5 bg-white/50"
              key={item}
            />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-5">
            <article className="rounded-[26px] border border-black/5 bg-white/70 p-5 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
              <p className="text-sm font-semibold text-muted-600">Total users</p>
              <div className="mt-2 text-3xl font-black text-ink-900">{overview.totalUsers}</div>
            </article>
            <article className="rounded-[26px] border border-black/5 bg-white/70 p-5 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
              <p className="text-sm font-semibold text-muted-600">Helper profiles</p>
              <div className="mt-2 text-3xl font-black text-ink-900">
                {overview.totalHelpers}
              </div>
            </article>
            <article className="rounded-[26px] border border-black/5 bg-white/70 p-5 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
              <p className="text-sm font-semibold text-muted-600">Total bookings</p>
              <div className="mt-2 text-3xl font-black text-ink-900">
                {overview.totalBookings}
              </div>
            </article>
            <article className="rounded-[26px] border border-black/5 bg-white/70 p-5 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
              <p className="text-sm font-semibold text-muted-600">Pending verification</p>
              <div className="mt-2 text-3xl font-black text-rust-700">
                {overview.pendingVerifications}
              </div>
            </article>
            <article className="rounded-[26px] border border-black/5 bg-white/70 p-5 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
              <p className="text-sm font-semibold text-muted-600">Active complaints</p>
              <div className="mt-2 text-3xl font-black text-rust-700">
                {overview.openComplaints}
              </div>
            </article>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <section className="rounded-[28px] border border-black/5 bg-white/70 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
              <h2 className="text-2xl font-black text-ink-900">Verification queue</h2>
              <p className="mt-2 text-sm text-muted-600">
                Approve or reject newly onboarded helpers before they receive trust badges.
              </p>

              <div className="mt-5 grid gap-4">
                {pendingHelpers.length ? (
                  pendingHelpers.map((helper) => (
                    <article
                      className="rounded-[24px] border border-black/5 bg-sand-50 p-5"
                      key={helper.id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-14 w-14" name={helper.name} src={helper.avatarUrl} />
                          <div>
                            <h3 className="text-xl font-bold text-ink-900">{helper.name}</h3>
                            <p className="mt-1 text-sm text-muted-600">
                              {helper.category} | {helper.area || "Area not set"}
                            </p>
                            <p className="mt-2 text-sm text-muted-600">
                              {helper.email || "No email"} | {helper.phone || "No phone"}
                            </p>
                            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-600">
                              Jobs {helper.completedJobs || 0} | Rating {helper.averageRating || 0} | Reviews {helper.totalReviews || 0}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full bg-rust-500/12 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-rust-700">
                          {helper.verificationStatus}
                        </span>
                      </div>

                      {helper.verificationDocumentUrl ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr]">
                          <img
                            alt={`${helper.name} verification document`}
                            className="h-36 w-full rounded-[20px] border border-black/8 bg-white object-cover shadow-[0_10px_24px_rgba(22,33,38,0.08)]"
                            src={helper.verificationDocumentUrl}
                          />
                          <div className="rounded-[20px] bg-white/70 p-4 text-sm text-muted-600">
                            <p className="font-bold text-ink-900">
                              {helper.verificationDocumentLabel || "Verification image"}
                            </p>
                            <p className="mt-2">
                              Submitted{" "}
                              {helper.verificationSubmittedAt
                                ? new Date(helper.verificationSubmittedAt).toLocaleString()
                                : "recently"}
                            </p>
                            <p className="mt-2">
                              Admin can preview this image and then approve or reject the helper.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-[20px] bg-white/70 px-4 py-3 text-sm text-muted-600">
                          No verification document uploaded yet.
                        </div>
                      )}

                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          className="rounded-2xl bg-teal-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-teal-800"
                          disabled={actionState.helperId === helper.id}
                          onClick={() => handleVerification(helper.slug || helper.id, "approved")}
                          type="button"
                        >
                          Approve
                        </button>
                        <button
                          className="rounded-2xl bg-rust-500/12 px-4 py-3 text-sm font-bold text-rust-700 transition hover:bg-rust-500/18"
                          disabled={actionState.helperId === helper.id}
                          onClick={() => handleVerification(helper.slug || helper.id, "rejected")}
                          type="button"
                        >
                          Reject
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-[24px] border border-black/5 bg-sand-50 p-5">
                    <p className="text-sm text-muted-600">
                      No helpers are waiting for verification right now.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-black/5 bg-white/70 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
              <h2 className="text-2xl font-black text-ink-900">Complaint queue</h2>
              <p className="mt-2 text-sm text-muted-600">
                Review customer complaints and keep their status updated.
              </p>

              <div className="mt-5 grid gap-4">
                {complaints.length ? (
                  complaints.map((complaint) => (
                    <article
                      className="rounded-[24px] border border-black/5 bg-sand-50 p-5"
                      key={complaint.id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-bold text-ink-900">{complaint.category}</h3>
                          <p className="mt-1 text-sm text-muted-600">
                            {complaint.reporterName} vs {complaint.targetName || "Helper"}
                          </p>
                        </div>
                        <span className="rounded-full bg-rust-500/12 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-rust-700">
                          {complaint.status}
                        </span>
                      </div>

                      <p className="mt-3 text-sm text-muted-600">{complaint.description}</p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-600">
                        Filed on {new Date(complaint.createdAt).toLocaleString()}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {complaintStatuses.map((status) => (
                          <button
                            className={[
                              "rounded-2xl px-4 py-2 text-sm font-bold transition",
                              complaint.status === status
                                ? "bg-teal-700 text-white"
                                : "bg-white text-ink-900 hover:bg-black/5",
                            ].join(" ")}
                            disabled={actionState.complaintId === complaint.id}
                            key={status}
                            onClick={() => handleComplaintStatus(complaint.id, status)}
                            type="button"
                          >
                            {status.replace("_", " ")}
                          </button>
                        ))}
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-[24px] border border-black/5 bg-sand-50 p-5">
                    <p className="text-sm text-muted-600">No complaints have been filed yet.</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <section className="mt-6 rounded-[28px] border border-black/5 bg-white/70 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
            <h2 className="text-2xl font-black text-ink-900">Recent bookings</h2>
            <p className="mt-2 text-sm text-muted-600">
              Quick visibility into the latest platform booking activity.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {overview.recentBookings?.length ? (
                overview.recentBookings.map((booking) => (
                  <article
                    className="rounded-[24px] border border-black/5 bg-sand-50 p-4"
                    key={booking.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-ink-900">{booking.customerName}</h3>
                        <p className="mt-1 text-sm text-muted-600">
                          {booking.helperName} | {booking.serviceCategory}
                        </p>
                      </div>
                      <span className="rounded-full bg-teal-700/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-teal-700">
                        {booking.status}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-muted-600">
                      {new Date(booking.scheduledDate).toLocaleString()}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
                        {(booking.paymentMethod || "cash").replace("_", " ")}
                      </span>
                      <span className="rounded-full bg-sand-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-900">
                        {(booking.paymentStatus || "cash_on_service").replace("_", " ")}
                      </span>
                      <span className="rounded-full bg-teal-700/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-teal-700">
                        {refundStatusLabels[booking.refundStatus || "none"]}
                      </span>
                    </div>
                    {booking.paymentReference ? (
                      <p className="mt-3 text-xs text-muted-600">
                        Ref: {booking.paymentReference}
                      </p>
                    ) : null}
                    {booking.refundedAmount ? (
                      <p className="mt-2 text-xs text-muted-600">
                        Refunded: Rs {booking.refundedAmount}
                      </p>
                    ) : null}
                    <div className="mt-4">
                      <Link
                        className="inline-flex rounded-2xl bg-teal-700/10 px-4 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-700/15"
                        to={`/bookings/${booking.id}`}
                      >
                        Open details
                      </Link>
                    </div>
                    {booking.paymentStatus === "paid" &&
                    booking.paymentMethod !== "cash" &&
                    booking.refundStatus !== "refunded" ? (
                      <div className="mt-4 grid gap-3">
                        <input
                          className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                          min="1"
                          onChange={(event) =>
                            handleRefundAmountChange(booking.id, event.target.value)
                          }
                          placeholder="Refund amount in Rs (leave blank for full refund)"
                          type="number"
                          value={refundAmounts[booking.id] || ""}
                        />
                        <button
                          className="rounded-2xl bg-rust-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-rust-700 disabled:cursor-not-allowed disabled:opacity-70"
                          disabled={actionState.bookingId === booking.id}
                          onClick={() => handleIssueRefund(booking)}
                          type="button"
                        >
                          {actionState.bookingId === booking.id
                            ? "Processing..."
                            : "Issue refund"}
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="rounded-[24px] border border-black/5 bg-sand-50 p-5">
                  <p className="text-sm text-muted-600">No recent bookings available yet.</p>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </section>
  );
}

export default AdminDashboardPage;
