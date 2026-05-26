import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import Avatar from "../components/common/Avatar";
import { useAuth } from "../contexts/AuthContext";
import {
  createBooking,
  createBookingPaymentOrder,
  fetchHelperById,
  syncBookingPayment,
  verifyBookingPayment,
} from "../services/api";
import {
  buildDirectionsUrl,
  buildOpenStreetMapEmbedUrl,
  calculateDistanceKm,
  formatDistanceKm,
  parseCoordinates,
} from "../utils/geo";
import { openRazorpayCheckout } from "../utils/razorpay";

const initialFormState = {
  contactPhone: "",
  scheduledDate: "",
  issueDescription: "",
  addressLabel: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  selectedSavedAddressId: "",
  paymentMethod: "cash",
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

function formatRoleLabel(role) {
  if (!role) {
    return "Helper";
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}

function HelperDetailsPage() {
  const { helperId } = useParams();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [helper, setHelper] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [formState, setFormState] = useState(initialFormState);
  const [bookingState, setBookingState] = useState({
    isSubmitting: false,
    successMessage: "",
    errorMessage: "",
  });
  const [viewerLocation, setViewerLocation] = useState(null);
  const [locationState, setLocationState] = useState({
    isLocating: false,
    errorMessage: "",
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    setFormState((current) => ({
      ...current,
      contactPhone: current.contactPhone || user.phone || "",
    }));
  }, [user]);

  useEffect(() => {
    const prefillBooking = location.state?.prefillBooking;

    if (!prefillBooking) {
      return;
    }

    setFormState((current) => ({
      ...current,
      contactPhone: prefillBooking.contactPhone || current.contactPhone,
      issueDescription: prefillBooking.issueDescription || current.issueDescription,
      paymentMethod: prefillBooking.paymentMethod || current.paymentMethod,
      addressLabel: prefillBooking.address?.label || current.addressLabel,
      addressLine1: prefillBooking.address?.addressLine1 || current.addressLine1,
      addressLine2: prefillBooking.address?.addressLine2 || current.addressLine2,
      city: prefillBooking.address?.city || current.city,
      state: prefillBooking.address?.state || current.state,
      postalCode: prefillBooking.address?.postalCode || current.postalCode,
      selectedSavedAddressId: "",
    }));
  }, [location.state]);

  useEffect(() => {
    async function loadHelper() {
      setIsLoading(true);

      try {
        const data = await fetchHelperById(helperId);
        setHelper(data);
        setNotFound(false);
        setErrorMessage("");
      } catch (_error) {
        setHelper(null);
        setNotFound(true);
        setErrorMessage("Helper not found.");
      } finally {
        setIsLoading(false);
      }
    }

    loadHelper();
  }, [helperId]);

  function handleInputChange(event) {
    const { name, value } = event.target;
    setFormState((current) => ({ ...current, [name]: value }));
  }

  function handleSavedAddressSelect(event) {
    const selectedSavedAddressId = event.target.value;
    const selectedAddress =
      user?.savedAddresses?.find((address) => address.id === selectedSavedAddressId) || null;

    if (!selectedAddress) {
      setFormState((current) => ({
        ...current,
        selectedSavedAddressId: "",
      }));
      return;
    }

    setFormState((current) => ({
      ...current,
      selectedSavedAddressId,
      addressLabel: selectedAddress.label || "",
      addressLine1: selectedAddress.addressLine1 || "",
      addressLine2: selectedAddress.addressLine2 || "",
      city: selectedAddress.city || "",
      state: selectedAddress.state || "",
      postalCode: selectedAddress.postalCode || "",
    }));
  }

  function handleSlotSelect(slot) {
    setFormState((current) => ({
      ...current,
      scheduledDate: toDateTimeLocalValue(slot.startAt),
    }));
  }

  function resetBookingForm() {
    setFormState({
      ...initialFormState,
      contactPhone: user?.phone || "",
    });
  }

  function handleUseLiveLocation() {
    if (!navigator.geolocation) {
      setLocationState({
        isLocating: false,
        errorMessage: "Browser geolocation is not supported on this device.",
      });
      return;
    }

    setLocationState({
      isLocating: true,
      errorMessage: "",
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setViewerLocation({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        });
        setLocationState({
          isLocating: false,
          errorMessage: "",
        });
      },
      (error) => {
        setLocationState({
          isLocating: false,
          errorMessage:
            error.message || "Current location could not be detected right now.",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
      }
    );
  }

  async function launchCheckoutForBooking(booking) {
    const checkoutOrder = await createBookingPaymentOrder(booking.id);

    await openRazorpayCheckout({
      booking: checkoutOrder.booking || booking,
      checkoutOrder,
      customer: user,
      onSuccess: async (response) => {
        const verifiedBooking = await verifyBookingPayment(booking.id, response);

        setBookingState({
          isSubmitting: false,
          successMessage: `Booking requested with status ${verifiedBooking.status}. Payment is set to ${
            paymentMethodLabels[verifiedBooking.paymentMethod] || verifiedBooking.paymentMethod
          } and currently ${
            paymentStatusLabels[verifiedBooking.paymentStatus] || verifiedBooking.paymentStatus
          }.`,
          errorMessage: "",
        });
      },
      onFailure: async (error) => {
        await syncBookingPayment(booking.id, {
          razorpay_order_id: error?.metadata?.order_id || checkoutOrder.orderId,
          razorpay_payment_id: error?.metadata?.payment_id || "",
        }).catch(() => null);

        setBookingState({
          isSubmitting: false,
          successMessage:
            "Booking created successfully. Payment is still incomplete, and you can retry it from booking history.",
          errorMessage:
            error?.description ||
            "Payment failed before confirmation. You can retry from booking history.",
        });
      },
      onDismiss: async () => {
        await syncBookingPayment(booking.id, {
          razorpay_order_id: checkoutOrder.orderId,
        }).catch(() => null);

        setBookingState({
          isSubmitting: false,
          successMessage:
            "Booking created successfully. Payment is pending because checkout was closed. You can complete it from booking history.",
          errorMessage: "",
        });
      },
    });
  }

  async function handleBookingSubmit(event) {
    event.preventDefault();

    setBookingState({
      isSubmitting: true,
      successMessage: "",
      errorMessage: "",
    });

    try {
      const booking = await createBooking({
        helperId: helper.id,
        contactPhone: formState.contactPhone,
        scheduledDate: formState.scheduledDate,
        issueDescription: formState.issueDescription,
        paymentMethod: formState.paymentMethod,
        address: {
          label: formState.addressLabel,
          addressLine1: formState.addressLine1,
          addressLine2: formState.addressLine2,
          city: formState.city,
          state: formState.state,
          postalCode: formState.postalCode,
        },
      });

      resetBookingForm();

      if (formState.paymentMethod === "cash") {
        setBookingState({
          isSubmitting: false,
          successMessage: `Booking requested with status ${booking.status}. Payment is set to ${
            paymentMethodLabels[booking.paymentMethod] || booking.paymentMethod
          } and currently ${
            paymentStatusLabels[booking.paymentStatus] || booking.paymentStatus
          }.`,
          errorMessage: "",
        });
        return;
      }

      await launchCheckoutForBooking(booking);
    } catch (error) {
      setBookingState({
        isSubmitting: false,
        successMessage: "",
        errorMessage:
          error.response?.data?.message ||
          error.message ||
          "Booking could not be created right now. Please try again.",
      });
    }
  }

  if (isLoading) {
    return (
      <section className="mx-auto w-[min(1120px,calc(100%-32px))] py-12">
        <div className="h-80 animate-pulse rounded-[28px] border border-black/5 bg-white/50" />
      </section>
    );
  }

  if (notFound || !helper) {
    return (
      <section className="mx-auto w-[min(1120px,calc(100%-32px))] py-12">
        <div className="rounded-[28px] border border-black/5 bg-white/70 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
          <h1 className="text-3xl font-black text-ink-900">Helper not found</h1>
          <p className="mt-3 text-sm text-muted-600">
            {errorMessage || "This route will later load a real database record."}
          </p>
          <Link
            className="mt-5 inline-flex items-center justify-center rounded-2xl bg-teal-700/10 px-4 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-700/15"
            to="/helpers"
          >
            Back to Helpers
          </Link>
        </div>
      </section>
    );
  }

  const helperRoleLabel = helper.roleLabel || formatRoleLabel(helper.role);
  const helperCoordinates = parseCoordinates(
    helper.coordinates?.latitude,
    helper.coordinates?.longitude
  );
  const distanceKm =
    viewerLocation && helperCoordinates
      ? calculateDistanceKm(viewerLocation, helperCoordinates)
      : null;
  const distanceLabel = formatDistanceKm(distanceKm);
  const helperMapUrl = buildOpenStreetMapEmbedUrl(helperCoordinates, {
    delta: 0.01,
  });
  const directionsUrl = buildDirectionsUrl(viewerLocation, helperCoordinates);

  return (
    <section className="mx-auto w-[min(1120px,calc(100%-32px))] py-12">
      <div className="mb-6">
        <p className="inline-flex rounded-full bg-teal-700/10 px-4 py-2 text-sm font-bold text-teal-700">
          Helper profile
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Avatar className="h-20 w-20" name={helper.name} src={helper.avatarUrl} />
          <div>
            <h1 className="text-3xl font-black tracking-[-0.03em] text-ink-900 md:text-5xl">
              {helper.name}
            </h1>
            <p className="mt-3 text-muted-600">
              Role: {helperRoleLabel} | {helper.category} | {helper.area} |{" "}
              {helper.experience || "Experienced helper"}
            </p>
            {helper.postalCodes?.length ? (
              <p className="mt-2 text-sm text-muted-600">
                Works in PIN codes: {helper.postalCodes.join(", ")}
              </p>
            ) : null}
          </div>
        </div>
        {errorMessage ? (
          <p className="mt-3 text-sm font-medium text-rust-700">{errorMessage}</p>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <article className="rounded-[28px] border border-black/5 bg-white/70 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
          <div className="flex flex-wrap gap-2">
            {helper.verified ? (
              <span className="rounded-full bg-rust-500/12 px-3 py-1 text-xs font-bold text-rust-700">
                Verified Helper
              </span>
            ) : null}
            <span className="rounded-full bg-sand-50 px-3 py-1 text-xs font-semibold text-ink-900">
              Role: {helperRoleLabel}
            </span>
            <span className="rounded-full bg-teal-700/8 px-3 py-1 text-xs font-semibold text-teal-700">
              Rating {helper.rating}
            </span>
            <span className="rounded-full bg-teal-700/8 px-3 py-1 text-xs font-semibold text-teal-700">
              {helper.price}
            </span>
            <span className="rounded-full bg-teal-700/8 px-3 py-1 text-xs font-semibold text-teal-700">
              Jobs {helper.completedJobs || 0}
            </span>
            {distanceLabel ? (
              <span className="rounded-full bg-teal-700/8 px-3 py-1 text-xs font-semibold text-teal-700">
                {distanceLabel}
              </span>
            ) : null}
          </div>

          <div className="mt-6">
            <h2 className="text-xl font-bold text-ink-900">About</h2>
            <p className="mt-3 text-sm text-muted-600">
              {helper.bio || "Trusted local professional for household service requests."}
            </p>
          </div>

          <div className="mt-6">
            <h2 className="text-xl font-bold text-ink-900">Availability</h2>
            <p className="mt-3 text-sm text-muted-600">{helper.availability}</p>
            {helper.availabilityConfig?.slotDurationMinutes ? (
              <p className="mt-2 text-sm text-muted-600">
                Booking interval: every {helper.availabilityConfig.slotDurationMinutes} minutes
              </p>
            ) : null}
            {helper.bookingSlots?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {helper.bookingSlots.map((slot) => {
                  const selected =
                    formState.scheduledDate &&
                    toDateTimeLocalValue(slot.startAt) === formState.scheduledDate;

                  return (
                    <button
                      className={[
                        "rounded-2xl px-3 py-2 text-xs font-bold transition",
                        selected
                          ? "bg-rust-500 text-white"
                          : "bg-teal-700/10 text-teal-700 hover:bg-teal-700/15",
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
            ) : (
              <p className="mt-3 text-sm text-muted-600">
                No pre-generated slots available right now. You can still request a future time
                within the helper's availability window.
              </p>
            )}
          </div>

          <div className="mt-6">
            <h2 className="text-xl font-bold text-ink-900">Services</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(helper.tags?.length ? helper.tags : ["Home Visit", "Quick Response"]).map(
                (tag) => (
                  <span
                    className="rounded-full bg-teal-700/8 px-3 py-1 text-xs font-semibold text-teal-700"
                    key={tag}
                  >
                    {tag}
                  </span>
                )
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-ink-900">Live distance and map</h2>
                <p className="mt-2 text-sm text-muted-600">
                  If the helper has added a live location, you can view the distance and map
                  preview here.
                </p>
              </div>
              {helperCoordinates ? (
                <button
                  className="inline-flex items-center justify-center rounded-2xl bg-teal-700/10 px-4 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-700/15 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={locationState.isLocating}
                  onClick={handleUseLiveLocation}
                  type="button"
                >
                  {locationState.isLocating
                    ? "Detecting live distance..."
                    : distanceLabel
                      ? "Refresh my location"
                      : "Use my live location"}
                </button>
              ) : null}
            </div>

            {locationState.errorMessage ? (
              <p className="mt-3 rounded-2xl bg-rust-500/12 px-4 py-3 text-sm text-rust-700">
                {locationState.errorMessage}
              </p>
            ) : null}

            {helperCoordinates ? (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-sand-50 px-3 py-2 text-xs font-semibold text-ink-900">
                    Map available
                  </span>
                  {distanceLabel ? (
                    <span className="rounded-full bg-teal-700/10 px-3 py-2 text-xs font-bold text-teal-700">
                      {distanceLabel} from your location
                    </span>
                  ) : (
                    <span className="rounded-full bg-teal-700/10 px-3 py-2 text-xs font-bold text-teal-700">
                      Enable live location to see exact distance
                    </span>
                  )}
                  {directionsUrl ? (
                    <a
                      className="rounded-full bg-rust-500/12 px-3 py-2 text-xs font-bold text-rust-700 transition hover:bg-rust-500/18"
                      href={directionsUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open directions
                    </a>
                  ) : null}
                </div>

                <div className="mt-4 overflow-hidden rounded-[24px] border border-black/8 bg-white shadow-[0_10px_24px_rgba(22,33,38,0.08)]">
                  <iframe
                    className="h-80 w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={helperMapUrl}
                    title={`${helper.name} service area map`}
                  />
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-[24px] border border-dashed border-black/10 bg-sand-50 px-4 py-5 text-sm text-muted-600">
                This helper has not added a live map location yet.
              </div>
            )}
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-ink-900">Portfolio photos</h2>
              <p className="text-sm text-muted-600">
                {helper.portfolioPhotos?.length
                  ? `${helper.portfolioPhotos.length} work photo${helper.portfolioPhotos.length === 1 ? "" : "s"}`
                  : "No portfolio uploaded yet"}
              </p>
            </div>

            {helper.portfolioPhotos?.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {helper.portfolioPhotos.map((photo, index) => (
                  <img
                    alt={`${helper.name} portfolio ${index + 1}`}
                    className="h-48 w-full rounded-[24px] border border-black/5 object-cover shadow-[0_10px_24px_rgba(22,33,38,0.08)]"
                    key={`${photo.slice(0, 24)}-${index}`}
                    src={photo}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-600">
                This gallery will appear here once the helper uploads work photos.
              </p>
            )}
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-ink-900">Recent reviews</h2>
              <p className="text-sm text-muted-600">
                {helper.totalReviews ? `${helper.totalReviews} verified customer reviews` : "No reviews yet"}
              </p>
            </div>

            {helper.reviews?.length ? (
              <div className="mt-4 grid gap-3">
                {helper.reviews.map((review) => (
                  <article
                    className="rounded-[24px] border border-black/5 bg-sand-50 p-4"
                    key={review.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          className="h-10 w-10"
                          name={review.customerName}
                          src={review.customerAvatarUrl}
                        />
                        <div>
                          <p className="text-sm font-bold text-ink-900">{review.customerName}</p>
                          {review.createdAt ? (
                            <p className="text-xs text-muted-600">
                              {new Date(review.createdAt).toLocaleDateString()}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <span className="rounded-full bg-teal-700/10 px-3 py-1 text-xs font-bold text-teal-700">
                        {review.rating}/5
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-600">
                      {review.comment || "Customer shared a positive service experience."}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-600">
                This helper will show public reviews here after completed bookings.
              </p>
            )}
          </div>
        </article>

        <aside className="rounded-[28px] border border-black/5 bg-white/70 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
          <h2 className="text-xl font-bold text-ink-900">Request booking</h2>
          {isAuthenticated ? (
            <>
              <p className="mt-3 text-sm text-muted-600">
                Booking will be created for {user?.fullName}. After submission, it will
                appear in your booking history.
              </p>

              <form className="mt-5 grid gap-3" onSubmit={handleBookingSubmit}>
                <input
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                  name="contactPhone"
                  onChange={handleInputChange}
                  placeholder="Phone number"
                  required
                  value={formState.contactPhone}
                />
                {user?.savedAddresses?.length ? (
                  <select
                    className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                    name="selectedSavedAddressId"
                    onChange={handleSavedAddressSelect}
                    value={formState.selectedSavedAddressId}
                  >
                    <option value="">Use a saved address</option>
                    {user.savedAddresses.map((address) => (
                      <option key={address.id} value={address.id}>
                        {address.label} | {address.city} | {address.postalCode}
                      </option>
                    ))}
                  </select>
                ) : null}
                <input
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                  min={toDateTimeLocalValue(new Date())}
                  name="scheduledDate"
                  onChange={handleInputChange}
                  required
                  type="datetime-local"
                  value={formState.scheduledDate}
                />
                <input
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                  name="addressLabel"
                  onChange={handleInputChange}
                  placeholder="Address label: Home / Office"
                  value={formState.addressLabel}
                />
                <input
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                  name="addressLine1"
                  onChange={handleInputChange}
                  placeholder="House / street address"
                  value={formState.addressLine1}
                />
                <input
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                  name="addressLine2"
                  onChange={handleInputChange}
                  placeholder="Landmark / address line 2"
                  value={formState.addressLine2}
                />

                <div className="grid gap-3 sm:grid-cols-3">
                  <input
                    className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                    name="city"
                    onChange={handleInputChange}
                    placeholder="City"
                    value={formState.city}
                  />
                  <input
                    className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                    name="state"
                    onChange={handleInputChange}
                    placeholder="State"
                    value={formState.state}
                  />
                  <input
                    className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                    name="postalCode"
                    onChange={handleInputChange}
                    placeholder="PIN code"
                    value={formState.postalCode}
                  />
                </div>

                <textarea
                  className="min-h-28 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                  name="issueDescription"
                  onChange={handleInputChange}
                  placeholder="Describe the issue"
                  required
                  value={formState.issueDescription}
                />

                <select
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                  name="paymentMethod"
                  onChange={handleInputChange}
                  value={formState.paymentMethod}
                >
                  <option value="cash">Cash on service</option>
                  <option value="upi">UPI apps</option>
                  <option value="card">Card</option>
                  <option value="wallet">Wallet</option>
                </select>

                {formState.paymentMethod !== "cash" ? (
                  <div className="rounded-2xl bg-sand-50 px-4 py-3 text-xs font-medium text-muted-600">
                    Real checkout will open through Razorpay. Depending on your device and
                    enabled methods, customers can pay using UPI apps like PhonePe, Google Pay,
                    Paytm, plus cards and supported wallets.
                  </div>
                ) : (
                  <p className="rounded-2xl bg-sand-50 px-4 py-3 text-xs font-medium text-muted-600">
                    Cash bookings can be collected when the service is completed.
                  </p>
                )}

                <button
                  className="inline-flex items-center justify-center rounded-2xl bg-rust-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-rust-700 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={bookingState.isSubmitting}
                  type="submit"
                >
                  {bookingState.isSubmitting
                    ? formState.paymentMethod === "cash"
                      ? "Submitting..."
                      : "Opening checkout..."
                    : formState.paymentMethod === "cash"
                      ? "Request Booking"
                      : "Continue to Payment"}
                </button>
              </form>
            </>
          ) : (
            <div className="mt-5 rounded-2xl bg-sand-50 p-4">
              <p className="text-sm text-muted-600">
                Login as a customer to request this service and track it in booking history.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  className="inline-flex items-center justify-center rounded-2xl bg-rust-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-rust-700"
                  to="/login"
                >
                  Login
                </Link>
                <Link
                  className="inline-flex items-center justify-center rounded-2xl bg-teal-700/10 px-4 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-700/15"
                  to="/register"
                >
                  Register
                </Link>
              </div>
            </div>
          )}

          {bookingState.successMessage ? (
            <div className="mt-4 rounded-2xl bg-teal-700/10 px-4 py-3 text-sm font-medium text-teal-700">
              <p>{bookingState.successMessage}</p>
              <Link className="mt-3 inline-flex font-bold underline" to="/bookings">
                View booking history
              </Link>
            </div>
          ) : null}

          {bookingState.errorMessage ? (
            <p className="mt-4 rounded-2xl bg-rust-500/12 px-4 py-3 text-sm font-medium text-rust-700">
              {bookingState.errorMessage}
            </p>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

export default HelperDetailsPage;
