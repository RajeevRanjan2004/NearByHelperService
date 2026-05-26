import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Avatar from "../components/common/Avatar";
import { useAuth } from "../contexts/AuthContext";
import { categories as fallbackCategories } from "../data/mockData";
import {
  createHelperProfile,
  fetchCategories,
  fetchCurrentHelperProfile,
} from "../services/api";
import { createAvatarDataUrl, createDocumentDataUrl } from "../utils/avatar";
import { getCategoryValue, resolveCategoryValue } from "../utils/categories";
import { buildOpenStreetMapEmbedUrl, parseCoordinates } from "../utils/geo";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const initialFormState = {
  fullName: "",
  email: "",
  phone: "",
  avatarUrl: "",
  headline: "",
  bio: "",
  serviceCategory: "",
  yearsOfExperience: "",
  minPrice: "",
  maxPrice: "",
  priceUnit: "per_visit",
  city: "",
  state: "",
  postalCodes: "",
  latitude: "",
  longitude: "",
  radiusInKm: "5",
  availabilityDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  startTime: "09:00",
  endTime: "18:00",
  slotDurationMinutes: "60",
  verificationDocumentUrl: "",
  verificationDocumentLabel: "Government ID / License",
  portfolioPhotos: [],
};

function buildInitialFormState(user, categories) {
  return {
    ...initialFormState,
    fullName: user?.fullName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    avatarUrl: user?.avatarUrl || "",
    serviceCategory: getCategoryValue(categories?.[0]) || "",
  };
}

function mapHelperProfileToForm(profile, categories, user) {
  const baseState = buildInitialFormState(user, categories);

  return {
    ...baseState,
    ...profile,
    avatarUrl: profile.avatarUrl || baseState.avatarUrl,
    serviceCategory: profile.serviceCategory
      ? resolveCategoryValue(profile.serviceCategory, categories)
      : baseState.serviceCategory,
    postalCodes: profile.postalCodes || "",
    latitude: profile.latitude || "",
    longitude: profile.longitude || "",
    verificationDocumentLabel:
      profile.verificationDocumentLabel || initialFormState.verificationDocumentLabel,
    portfolioPhotos: Array.isArray(profile.portfolioPhotos) ? profile.portfolioPhotos : [],
    availabilityDays: Array.isArray(profile.availabilityDays)
      ? profile.availabilityDays
      : baseState.availabilityDays,
  };
}

function BecomeHelperPage() {
  const location = useLocation();
  const { setUser, user } = useAuth();
  const [categories, setCategories] = useState(fallbackCategories);
  const [formState, setFormState] = useState(() =>
    buildInitialFormState(user, fallbackCategories)
  );
  const [submitState, setSubmitState] = useState({
    isSubmitting: false,
    successMessage: "",
    errorMessage: "",
    helper: null,
  });
  const [pageState, setPageState] = useState({
    isLoadingProfile: true,
    loadErrorMessage: "",
    uploadErrorMessage: "",
    isProcessingAvatar: false,
    isProcessingDocument: false,
    isProcessingPortfolio: false,
    isLocating: false,
    locationErrorMessage: "",
    verificationStatus: "pending",
  });
  const helperRoleLabel = "Helper";

  useEffect(() => {
    let isActive = true;

    async function loadHelperSetup() {
      setPageState((current) => ({
        ...current,
        isLoadingProfile: true,
        loadErrorMessage: "",
      }));

      let nextCategories = fallbackCategories;

      try {
        const data = await fetchCategories();

        if (data?.length) {
          nextCategories = data;
        }
      } catch (_error) {
        nextCategories = fallbackCategories;
      }

      if (!isActive) {
        return;
      }

      setCategories(nextCategories);

      try {
        const profile = await fetchCurrentHelperProfile();

        if (!isActive) {
          return;
        }

        setFormState(mapHelperProfileToForm(profile, nextCategories, user));
        setPageState((current) => ({
          ...current,
          isLoadingProfile: false,
          verificationStatus: profile.verificationStatus || "pending",
        }));
      } catch (error) {
        if (!isActive) {
          return;
        }

        const isNotFound = error.response?.status === 404;
        const nextState = buildInitialFormState(user, nextCategories);

        setFormState(nextState);
        setPageState((current) => ({
          ...current,
          isLoadingProfile: false,
          loadErrorMessage: isNotFound
            ? ""
            : error.response?.data?.message ||
              "Current helper profile could not be loaded right now.",
          verificationStatus: "pending",
        }));
      }
    }

    loadHelperSetup();

    return () => {
      isActive = false;
    };
  }, [user]);

  useEffect(() => {
    const prefill = location.state?.prefill;

    if (!prefill) {
      return;
    }

    setFormState((current) => ({
      ...current,
      serviceCategory: prefill.serviceCategory
        ? resolveCategoryValue(prefill.serviceCategory, categories)
        : current.serviceCategory,
      city: prefill.city || current.city,
      state: prefill.state || current.state,
    }));
  }, [categories, location.state]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormState((current) => ({ ...current, [name]: value }));
  }

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setPageState((current) => ({
      ...current,
      isProcessingAvatar: true,
      uploadErrorMessage: "",
    }));

    try {
      const avatarUrl = await createAvatarDataUrl(file);
      setFormState((current) => ({ ...current, avatarUrl }));
      setPageState((current) => ({
        ...current,
        isProcessingAvatar: false,
      }));
    } catch (error) {
      setPageState((current) => ({
        ...current,
        isProcessingAvatar: false,
        uploadErrorMessage: error.message || "Profile photo could not be prepared.",
      }));
    } finally {
      event.target.value = "";
    }
  }

  async function handleDocumentChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setPageState((current) => ({
      ...current,
      isProcessingDocument: true,
      uploadErrorMessage: "",
    }));

    try {
      const verificationDocumentUrl = await createDocumentDataUrl(file);
      setFormState((current) => ({
        ...current,
        verificationDocumentUrl,
        verificationDocumentLabel: current.verificationDocumentLabel || file.name,
      }));
      setPageState((current) => ({
        ...current,
        isProcessingDocument: false,
      }));
    } catch (error) {
      setPageState((current) => ({
        ...current,
        isProcessingDocument: false,
        uploadErrorMessage:
          error.message || "Verification document could not be prepared.",
      }));
    } finally {
      event.target.value = "";
    }
  }

  async function handlePortfolioPhotosChange(event) {
    const files = Array.from(event.target.files || []);

    if (!files.length) {
      return;
    }

    const remainingSlots = Math.max(0, 6 - formState.portfolioPhotos.length);
    const selectedFiles = files.slice(0, remainingSlots);

    setPageState((current) => ({
      ...current,
      isProcessingPortfolio: true,
      uploadErrorMessage: "",
    }));

    try {
      const nextPhotos = await Promise.all(
        selectedFiles.map((file) =>
          createDocumentDataUrl(file, {
            maxWidth: 1280,
            maxHeight: 1280,
            quality: 0.84,
          })
        )
      );

      setFormState((current) => ({
        ...current,
        portfolioPhotos: [...current.portfolioPhotos, ...nextPhotos].slice(0, 6),
      }));
      setPageState((current) => ({
        ...current,
        isProcessingPortfolio: false,
      }));
    } catch (error) {
      setPageState((current) => ({
        ...current,
        isProcessingPortfolio: false,
        uploadErrorMessage: error.message || "Portfolio photos could not be prepared.",
      }));
    } finally {
      event.target.value = "";
    }
  }

  function handleRemovePortfolioPhoto(photoIndex) {
    setFormState((current) => ({
      ...current,
      portfolioPhotos: current.portfolioPhotos.filter((_, index) => index !== photoIndex),
    }));
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setPageState((current) => ({
        ...current,
        locationErrorMessage: "Browser geolocation is not supported on this device.",
      }));
      return;
    }

    setPageState((current) => ({
      ...current,
      isLocating: true,
      locationErrorMessage: "",
    }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormState((current) => ({
          ...current,
          latitude: String(Number(position.coords.latitude.toFixed(6))),
          longitude: String(Number(position.coords.longitude.toFixed(6))),
        }));
        setPageState((current) => ({
          ...current,
          isLocating: false,
          locationErrorMessage: "",
        }));
      },
      (error) => {
        setPageState((current) => ({
          ...current,
          isLocating: false,
          locationErrorMessage:
            error.message || "Current location could not be detected right now.",
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
      }
    );
  }

  function handleAvailabilityDayToggle(day) {
    setFormState((current) => ({
      ...current,
      availabilityDays: current.availabilityDays.includes(day)
        ? current.availabilityDays.filter((item) => item !== day)
        : [...current.availabilityDays, day],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setSubmitState({
      isSubmitting: true,
      successMessage: "",
      errorMessage: "",
      helper: null,
    });

    try {
      const helper = await createHelperProfile(formState);
      setUser((current) =>
        current
          ? {
              ...current,
              fullName: formState.fullName,
              email: formState.email,
              phone: formState.phone,
              avatarUrl: formState.avatarUrl,
            }
          : current
      );

      setSubmitState({
        isSubmitting: false,
        successMessage:
          helper.verificationStatus === "approved"
            ? "Helper profile updated successfully. Verified badge remains active."
            : "Helper profile saved successfully. It is now available in the helper list.",
        errorMessage: "",
        helper,
      });
      setPageState((current) => ({
        ...current,
        verificationStatus: helper.verificationStatus || current.verificationStatus,
      }));
    } catch (error) {
      setSubmitState({
        isSubmitting: false,
        successMessage: "",
        errorMessage:
          error.response?.data?.message ||
          "Helper profile could not be saved right now. Please try again.",
        helper: null,
      });
    }
  }

  const currentVerificationStatus =
    submitState.helper?.verificationStatus || pageState.verificationStatus;
  const verificationToneClass =
    currentVerificationStatus === "approved"
      ? "bg-emerald-500/12 text-emerald-700"
      : currentVerificationStatus === "rejected"
        ? "bg-rust-500/12 text-rust-700"
        : "bg-amber-500/15 text-amber-700";
  const helperCoordinates = parseCoordinates(formState.latitude, formState.longitude);
  const helperMapUrl = buildOpenStreetMapEmbedUrl(helperCoordinates, {
    delta: 0.012,
  });

  return (
    <section className="mx-auto w-[min(1120px,calc(100%-32px))] py-12">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-black/5 bg-white/70 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
          <p className="inline-flex rounded-full bg-teal-700/10 px-4 py-2 text-sm font-bold text-teal-700">
            Helper onboarding
          </p>
          <h1 className="mt-4 text-3xl font-black tracking-[-0.03em] text-ink-900 md:text-5xl">
            Join as a local helper
          </h1>
          <p className="mt-4 text-sm text-muted-600">
            A helper can now edit profile details, pricing, service area, weekly
            availability, profile photo, and verification document directly from the UI.
          </p>
          <div className="mt-4 rounded-2xl bg-teal-700/8 px-4 py-3 text-sm text-teal-700">
            Selected role: <span className="font-bold">{helperRoleLabel}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <span
              className={[
                "rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[0.08em]",
                verificationToneClass,
              ].join(" ")}
            >
              Verification: {currentVerificationStatus.replace("_", " ")}
            </span>
            {formState.verificationDocumentUrl ? (
              <span className="rounded-full bg-teal-700/8 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-teal-700">
                Document uploaded
              </span>
            ) : null}
          </div>
          {location.state?.message ? (
            <div className="mt-4 rounded-2xl bg-sand-50 px-4 py-3 text-sm text-ink-900">
              {location.state.message}
            </div>
          ) : null}
          {pageState.loadErrorMessage ? (
            <div className="mt-4 rounded-2xl bg-rust-500/12 px-4 py-3 text-sm text-rust-700">
              {pageState.loadErrorMessage}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4">
            {[
              "Updates helper name, profile photo, category, pricing, and service area",
              "Supports comma-separated PIN codes for local discovery",
              "Uploads one verification image for admin approval",
              "Controls which booking slots customers can choose",
            ].map((point) => (
              <div
                className="rounded-2xl bg-teal-700/8 px-4 py-3 text-sm font-medium text-teal-700"
                key={point}
              >
                {point}
              </div>
            ))}
          </div>

          {submitState.helper ? (
            <div className="mt-6 rounded-[24px] border border-black/5 bg-sand-50 p-5">
              <div className="flex items-center gap-4">
                <Avatar
                  className="h-16 w-16"
                  name={submitState.helper.name}
                  src={submitState.helper.avatarUrl}
                />
                <div>
                  <h2 className="text-xl font-bold text-ink-900">{submitState.helper.name}</h2>
                  <p className="mt-2 text-sm text-muted-600">
                    {submitState.helper.category} | {submitState.helper.area}
                  </p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
                    Verification {submitState.helper.verificationStatus?.replace("_", " ")}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  className="inline-flex items-center justify-center rounded-2xl bg-rust-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-rust-700"
                  to={`/helpers/${submitState.helper.id}`}
                >
                  View public profile
                </Link>
                <Link
                  className="inline-flex items-center justify-center rounded-2xl bg-teal-700/10 px-4 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-700/15"
                  to="/helpers"
                >
                  Open helpers list
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        <form
          className="rounded-[28px] border border-black/5 bg-white/70 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)]"
          onSubmit={handleSubmit}
        >
          {pageState.isLoadingProfile ? (
            <div className="mb-5 rounded-2xl bg-sand-50 px-4 py-3 text-sm text-muted-600">
              Loading current helper profile...
            </div>
          ) : null}
          {pageState.uploadErrorMessage ? (
            <div className="mb-5 rounded-2xl bg-rust-500/12 px-4 py-3 text-sm text-rust-700">
              {pageState.uploadErrorMessage}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-black/5 bg-sand-50 p-4 md:col-span-2">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar className="h-20 w-20" name={formState.fullName} src={formState.avatarUrl} />
                <div className="grid gap-2">
                  <p className="text-sm font-bold text-ink-900">Profile photo</p>
                  <label className="inline-flex w-fit cursor-pointer items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-bold text-ink-900 transition hover:bg-black/5">
                    {pageState.isProcessingAvatar ? "Preparing photo..." : "Upload photo"}
                    <input
                      accept="image/*"
                      className="hidden"
                      disabled={pageState.isProcessingAvatar}
                      onChange={handleAvatarChange}
                      type="file"
                    />
                  </label>
                  {formState.avatarUrl ? (
                    <button
                      className="w-fit text-sm font-bold text-rust-700 underline"
                      onClick={() => setFormState((current) => ({ ...current, avatarUrl: "" }))}
                      type="button"
                    >
                      Remove photo
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <label className="grid gap-2 text-sm font-bold text-ink-900">
              Profile role
              <input
                className="rounded-2xl border border-black/10 bg-sand-50 px-4 py-3 text-sm text-muted-600 outline-none"
                readOnly
                value={helperRoleLabel}
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-ink-900">
              Full name
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                name="fullName"
                onChange={handleChange}
                required
                value={formState.fullName}
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-ink-900">
              Service category
              <select
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                name="serviceCategory"
                onChange={handleChange}
                required
                value={formState.serviceCategory}
              >
                <option value="" disabled>
                  Select category
                </option>
                {categories.map((category) => (
                  <option
                    key={category.id || category.slug || category.name}
                    value={getCategoryValue(category)}
                  >
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-bold text-ink-900">
              Email
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                name="email"
                onChange={handleChange}
                required
                type="email"
                value={formState.email}
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-ink-900">
              Phone
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                name="phone"
                onChange={handleChange}
                required
                value={formState.phone}
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-ink-900 md:col-span-2">
              Headline
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                name="headline"
                onChange={handleChange}
                placeholder="Fast, reliable, local service"
                value={formState.headline}
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-ink-900 md:col-span-2">
              Bio
              <textarea
                className="min-h-28 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                name="bio"
                onChange={handleChange}
                placeholder="Describe your experience and services"
                value={formState.bio}
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-ink-900">
              Years of experience
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                min="0"
                name="yearsOfExperience"
                onChange={handleChange}
                required
                type="number"
                value={formState.yearsOfExperience}
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-ink-900">
              Price unit
              <select
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                name="priceUnit"
                onChange={handleChange}
                value={formState.priceUnit}
              >
                <option value="per_visit">Per visit</option>
                <option value="per_hour">Per hour</option>
                <option value="per_day">Per day</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm font-bold text-ink-900">
              Minimum price
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                min="0"
                name="minPrice"
                onChange={handleChange}
                required
                type="number"
                value={formState.minPrice}
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-ink-900">
              Maximum price
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                min="0"
                name="maxPrice"
                onChange={handleChange}
                type="number"
                value={formState.maxPrice}
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-ink-900">
              City
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                name="city"
                onChange={handleChange}
                required
                value={formState.city}
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-ink-900">
              State
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                name="state"
                onChange={handleChange}
                required
                value={formState.state}
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-ink-900 md:col-span-2">
              PIN codes you cover
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                name="postalCodes"
                onChange={handleChange}
                placeholder="Example: 110096, 201301"
                value={formState.postalCodes}
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-ink-900">
              Service radius (km)
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                min="1"
                name="radiusInKm"
                onChange={handleChange}
                type="number"
                value={formState.radiusInKm}
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-ink-900">
              Start time
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                name="startTime"
                onChange={handleChange}
                type="time"
                value={formState.startTime}
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-ink-900">
              End time
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                name="endTime"
                onChange={handleChange}
                type="time"
                value={formState.endTime}
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-ink-900">
              Slot duration
              <select
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                name="slotDurationMinutes"
                onChange={handleChange}
                value={formState.slotDurationMinutes}
              >
                <option value="30">30 minutes</option>
                <option value="60">60 minutes</option>
                <option value="90">90 minutes</option>
                <option value="120">120 minutes</option>
              </select>
            </label>

            <div className="rounded-[24px] border border-black/5 bg-sand-50 p-4 md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-ink-900">Live map location</p>
                  <p className="mt-1 text-sm text-muted-600">
                    Saving your current coordinates lets users see your live distance and
                    location preview.
                  </p>
                </div>
                <button
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-bold text-ink-900 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={pageState.isLocating}
                  onClick={handleUseCurrentLocation}
                  type="button"
                >
                  {pageState.isLocating ? "Detecting location..." : "Use my current location"}
                </button>
              </div>

              {pageState.locationErrorMessage ? (
                <p className="mt-3 rounded-2xl bg-rust-500/12 px-4 py-3 text-sm text-rust-700">
                  {pageState.locationErrorMessage}
                </p>
              ) : null}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-ink-900">
                  Latitude
                  <input
                    className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                    inputMode="decimal"
                    name="latitude"
                    onChange={handleChange}
                    placeholder="28.613939"
                    value={formState.latitude}
                  />
                </label>

                <label className="grid gap-2 text-sm font-bold text-ink-900">
                  Longitude
                  <input
                    className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                    inputMode="decimal"
                    name="longitude"
                    onChange={handleChange}
                    placeholder="77.209023"
                    value={formState.longitude}
                  />
                </label>
              </div>

              <div className="mt-4 overflow-hidden rounded-[22px] border border-black/8 bg-white shadow-[0_10px_24px_rgba(22,33,38,0.08)]">
                {helperMapUrl ? (
                  <iframe
                    className="h-72 w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={helperMapUrl}
                    title="Helper service area map preview"
                  />
                ) : (
                  <div className="grid h-72 place-items-center px-6 text-center text-sm text-muted-600">
                    Add latitude and longitude to show the map preview here.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-black/5 bg-sand-50 p-4 md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-ink-900">Portfolio photos</p>
                  <p className="mt-1 text-sm text-muted-600">
                    Upload photos of your work. Customers will be able to view them on your
                    public profile.
                  </p>
                </div>
                <label className="inline-flex w-fit cursor-pointer items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-bold text-ink-900 transition hover:bg-black/5">
                  {pageState.isProcessingPortfolio ? "Preparing photos..." : "Upload photos"}
                  <input
                    accept="image/*"
                    className="hidden"
                    disabled={
                      pageState.isProcessingPortfolio || formState.portfolioPhotos.length >= 6
                    }
                    multiple
                    onChange={handlePortfolioPhotosChange}
                    type="file"
                  />
                </label>
              </div>

              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-600">
                {formState.portfolioPhotos.length}/6 photos added
              </p>

              {formState.portfolioPhotos.length ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {formState.portfolioPhotos.map((photo, index) => (
                    <div
                      className="overflow-hidden rounded-[22px] border border-black/8 bg-white shadow-[0_10px_24px_rgba(22,33,38,0.08)]"
                      key={`${photo.slice(0, 24)}-${index}`}
                    >
                      <img
                        alt={`Portfolio ${index + 1}`}
                        className="h-40 w-full object-cover"
                        src={photo}
                      />
                      <div className="p-3">
                        <button
                          className="inline-flex items-center justify-center rounded-2xl bg-rust-500/12 px-3 py-2 text-xs font-bold text-rust-700 transition hover:bg-rust-500/18"
                          onClick={() => handleRemovePortfolioPhoto(index)}
                          type="button"
                        >
                          Remove photo
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 grid min-h-32 place-items-center rounded-[22px] border border-dashed border-black/10 bg-white/70 px-4 text-center text-sm text-muted-600">
                  No portfolio photos added yet. It is best to upload 3 to 5 clear work
                  images.
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-black/5 bg-sand-50 p-4 md:col-span-2">
              <div className="grid gap-3 md:grid-cols-[1fr_220px] md:items-start">
                <div className="grid gap-3">
                  <label className="grid gap-2 text-sm font-bold text-ink-900">
                    Verification document label
                    <input
                      className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                      name="verificationDocumentLabel"
                      onChange={handleChange}
                      placeholder="Aadhaar / Driving License / Government ID"
                      value={formState.verificationDocumentLabel}
                    />
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <label className="inline-flex w-fit cursor-pointer items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-bold text-ink-900 transition hover:bg-black/5">
                      {pageState.isProcessingDocument
                        ? "Preparing document..."
                        : "Upload verification image"}
                      <input
                        accept="image/*"
                        className="hidden"
                        disabled={pageState.isProcessingDocument}
                        onChange={handleDocumentChange}
                        type="file"
                      />
                    </label>
                    {formState.verificationDocumentUrl ? (
                      <button
                        className="rounded-2xl bg-rust-500/12 px-4 py-3 text-sm font-bold text-rust-700 transition hover:bg-rust-500/18"
                        onClick={() =>
                          setFormState((current) => ({
                            ...current,
                            verificationDocumentUrl: "",
                          }))
                        }
                        type="button"
                      >
                        Remove document
                      </button>
                    ) : null}
                  </div>

                  <p className="text-sm text-muted-600">
                    Upload one clear ID or license image for admin review. Updating the
                    document may move verification back to pending.
                  </p>
                </div>

                {formState.verificationDocumentUrl ? (
                  <img
                    alt="Verification document preview"
                    className="w-full rounded-[20px] border border-black/8 bg-white object-cover shadow-[0_10px_24px_rgba(22,33,38,0.08)]"
                    src={formState.verificationDocumentUrl}
                  />
                ) : (
                  <div className="grid h-full min-h-36 place-items-center rounded-[20px] border border-dashed border-black/10 bg-white/70 px-4 text-center text-sm text-muted-600">
                    Verification image preview will appear here.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm font-bold text-ink-900">Available days</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {weekDays.map((day) => {
                const selected = formState.availabilityDays.includes(day);

                return (
                  <button
                    className={[
                      "rounded-full px-4 py-2 text-sm font-bold transition",
                      selected
                        ? "bg-rust-500 text-white"
                        : "bg-teal-700/10 text-teal-700 hover:bg-teal-700/15",
                    ].join(" ")}
                    key={day}
                    onClick={() => handleAvailabilityDayToggle(day)}
                    type="button"
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-rust-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-rust-700 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={
              submitState.isSubmitting ||
              pageState.isLoadingProfile ||
              pageState.isProcessingAvatar ||
              pageState.isProcessingDocument ||
              pageState.isProcessingPortfolio ||
              pageState.isLocating
            }
            type="submit"
          >
            {submitState.isSubmitting ? "Saving profile..." : "Save helper profile"}
          </button>

          {submitState.successMessage ? (
            <p className="mt-4 rounded-2xl bg-teal-700/10 px-4 py-3 text-sm font-medium text-teal-700">
              {submitState.successMessage}
            </p>
          ) : null}

          {submitState.errorMessage ? (
            <p className="mt-4 rounded-2xl bg-rust-500/12 px-4 py-3 text-sm font-medium text-rust-700">
              {submitState.errorMessage}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}

export default BecomeHelperPage;
