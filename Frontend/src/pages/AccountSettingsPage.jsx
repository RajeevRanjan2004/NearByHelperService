import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Avatar from "../components/common/Avatar";
import {
  deleteAccount,
  requestDeleteAccountOtp,
  updateCurrentUserProfile,
} from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { createAvatarDataUrl } from "../utils/avatar";

function createEmptyAddress() {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
  };
}

function AccountSettingsPage() {
  const navigate = useNavigate();
  const { logout, setUser, user } = useAuth();
  const defaultDeliveryTarget = user?.phone ? "phone" : "email";
  const [profileForm, setProfileForm] = useState({
    avatarUrl: user?.avatarUrl || "",
    savedAddresses: user?.savedAddresses || [],
  });
  const [profileState, setProfileState] = useState({
    isSubmitting: false,
    isProcessingImage: false,
    errorMessage: "",
    successMessage: "",
  });
  const [deleteMethod, setDeleteMethod] = useState("password");
  const [deliveryTarget, setDeliveryTarget] = useState(defaultDeliveryTarget);
  const [deleteForm, setDeleteForm] = useState({
    password: "",
    otp: "",
  });
  const [otpState, setOtpState] = useState({
    isSubmitting: false,
    errorMessage: "",
    successMessage: "",
    data: null,
  });
  const [deleteState, setDeleteState] = useState({
    isSubmitting: false,
    errorMessage: "",
  });

  useEffect(() => {
    setProfileForm({
      avatarUrl: user?.avatarUrl || "",
      savedAddresses: user?.savedAddresses || [],
    });
  }, [user?.avatarUrl, user?.savedAddresses]);

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setProfileState((current) => ({
      ...current,
      isProcessingImage: true,
      errorMessage: "",
      successMessage: "",
    }));

    try {
      const avatarUrl = await createAvatarDataUrl(file);
      setProfileForm({ avatarUrl });
      setProfileState((current) => ({
        ...current,
        isProcessingImage: false,
      }));
    } catch (error) {
      setProfileState((current) => ({
        ...current,
        isProcessingImage: false,
        errorMessage: error.message || "Profile photo could not be prepared.",
      }));
    } finally {
      event.target.value = "";
    }
  }

  async function handleProfileSave(event) {
    event.preventDefault();

    setProfileState((current) => ({
      ...current,
      isSubmitting: true,
      errorMessage: "",
      successMessage: "",
    }));

    try {
      const updatedUser = await updateCurrentUserProfile(profileForm);
      setUser(updatedUser);
      setProfileState({
        isSubmitting: false,
        isProcessingImage: false,
        errorMessage: "",
        successMessage: "Profile updated successfully.",
      });
    } catch (error) {
      setProfileState((current) => ({
        ...current,
        isSubmitting: false,
        errorMessage:
          error.response?.data?.message || "Profile photo could not be saved right now.",
      }));
    }
  }

  function handleAddressChange(addressId, field, value) {
    setProfileForm((current) => ({
      ...current,
      savedAddresses: current.savedAddresses.map((address) =>
        address.id === addressId ? { ...address, [field]: value } : address
      ),
    }));
  }

  function handleAddAddress() {
    setProfileForm((current) => ({
      ...current,
      savedAddresses: [...current.savedAddresses, createEmptyAddress()],
    }));
  }

  function handleRemoveAddress(addressId) {
    setProfileForm((current) => ({
      ...current,
      savedAddresses: current.savedAddresses.filter((address) => address.id !== addressId),
    }));
  }

  function handleDeleteFormChange(event) {
    const { name, value } = event.target;
    setDeleteForm((current) => ({ ...current, [name]: value }));
  }

  async function handleRequestOtp() {
    setOtpState({
      isSubmitting: true,
      errorMessage: "",
      successMessage: "",
      data: null,
    });

    try {
      const data = await requestDeleteAccountOtp({ deliveryTarget });
      setOtpState({
        isSubmitting: false,
        errorMessage: "",
        successMessage: `Delete-account OTP sent to ${data?.identifier || "your registered contact"}.`,
        data,
      });
      setDeleteMethod("otp");
    } catch (error) {
      setOtpState({
        isSubmitting: false,
        errorMessage:
          error.response?.data?.message ||
          "Delete-account OTP could not be sent right now.",
        successMessage: "",
        data: null,
      });
    }
  }

  async function handleDeleteAccount(event) {
    event.preventDefault();
    setDeleteState({
      isSubmitting: true,
      errorMessage: "",
    });

    try {
      await deleteAccount(
        deleteMethod === "password"
          ? { password: deleteForm.password }
          : { otp: deleteForm.otp }
      );

      logout();
      navigate("/login", {
        replace: true,
        state: {
          message: "Account deleted successfully.",
        },
      });
    } catch (error) {
      setDeleteState({
        isSubmitting: false,
        errorMessage:
          error.response?.data?.message || "Account could not be deleted right now.",
      });
    }
  }

  return (
    <section className="mx-auto w-[min(760px,calc(100%-32px))] py-12">
      <div className="rounded-[28px] border border-black/5 bg-white/70 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
        <p className="inline-flex rounded-full bg-teal-700/10 px-4 py-2 text-sm font-bold text-teal-700">
          Account settings
        </p>
        <h1 className="mt-4 text-3xl font-black text-ink-900">Manage your account</h1>
        <p className="mt-3 text-sm text-muted-600">
          Logged in as {user?.fullName} ({user?.role}). Account deletion deactivates login
          access and hides helper profiles from public listings, while operational records
          can stay preserved.
        </p>

        <div className="mt-8 rounded-[24px] border border-black/5 bg-sand-50 p-5">
          <h2 className="text-xl font-black text-ink-900">Profile and saved addresses</h2>
          <p className="mt-2 text-sm text-muted-600">
            Both customers and helpers can upload a profile photo, and customers can save
            addresses for future bookings.
          </p>

          <form className="mt-5 grid gap-4" onSubmit={handleProfileSave}>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar className="h-24 w-24" name={user?.fullName} src={profileForm.avatarUrl} />
              <div className="grid gap-3">
                <label className="inline-flex w-fit cursor-pointer items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-bold text-ink-900 transition hover:bg-black/5">
                  {profileState.isProcessingImage ? "Preparing photo..." : "Upload new photo"}
                  <input
                    accept="image/*"
                    className="hidden"
                    disabled={profileState.isProcessingImage}
                    onChange={handleAvatarChange}
                    type="file"
                  />
                </label>
                {profileForm.avatarUrl ? (
                  <button
                    className="w-fit text-sm font-bold text-rust-700 underline"
                    onClick={() => setProfileForm({ avatarUrl: "" })}
                    type="button"
                  >
                    Remove photo
                  </button>
                ) : null}
              </div>
            </div>

            <button
              className="inline-flex w-fit items-center justify-center rounded-2xl bg-rust-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-rust-700 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={profileState.isSubmitting || profileState.isProcessingImage}
              type="submit"
            >
              {profileState.isSubmitting ? "Saving..." : "Save profile changes"}
            </button>

            {profileState.errorMessage ? (
              <p className="text-sm font-medium text-rust-700">{profileState.errorMessage}</p>
            ) : null}

            {profileState.successMessage ? (
              <p className="text-sm font-medium text-teal-700">{profileState.successMessage}</p>
            ) : null}

            <div className="mt-2 rounded-[24px] border border-black/5 bg-white/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-ink-900">Saved addresses</h3>
                  <p className="mt-2 text-sm text-muted-600">
                    You can fill the booking form with these addresses in one click.
                  </p>
                </div>
                <button
                  className="rounded-2xl bg-teal-700/10 px-4 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-700/15"
                  onClick={handleAddAddress}
                  type="button"
                >
                  Add address
                </button>
              </div>

              {profileForm.savedAddresses.length ? (
                <div className="mt-4 grid gap-4">
                  {profileForm.savedAddresses.map((address, index) => (
                    <div
                      className="rounded-[20px] border border-black/5 bg-sand-50 p-4"
                      key={address.id || index}
                    >
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                          onChange={(event) =>
                            handleAddressChange(address.id, "label", event.target.value)
                          }
                          placeholder="Label: Home / Office"
                          value={address.label}
                        />
                        <input
                          className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                          onChange={(event) =>
                            handleAddressChange(address.id, "postalCode", event.target.value)
                          }
                          placeholder="PIN code"
                          value={address.postalCode}
                        />
                        <input
                          className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none md:col-span-2"
                          onChange={(event) =>
                            handleAddressChange(address.id, "addressLine1", event.target.value)
                          }
                          placeholder="House / street address"
                          value={address.addressLine1}
                        />
                        <input
                          className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none md:col-span-2"
                          onChange={(event) =>
                            handleAddressChange(address.id, "addressLine2", event.target.value)
                          }
                          placeholder="Landmark / address line 2 (optional)"
                          value={address.addressLine2 || ""}
                        />
                        <input
                          className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                          onChange={(event) =>
                            handleAddressChange(address.id, "city", event.target.value)
                          }
                          placeholder="City"
                          value={address.city}
                        />
                        <input
                          className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                          onChange={(event) =>
                            handleAddressChange(address.id, "state", event.target.value)
                          }
                          placeholder="State"
                          value={address.state}
                        />
                      </div>

                      <button
                        className="mt-4 rounded-2xl bg-rust-500/12 px-4 py-3 text-sm font-bold text-rust-700 transition hover:bg-rust-500/18"
                        onClick={() => handleRemoveAddress(address.id)}
                        type="button"
                      >
                        Remove address
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-[20px] border border-dashed border-black/10 bg-sand-50 px-4 py-5 text-sm text-muted-600">
                  No saved addresses yet. Add one to speed up future bookings.
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="mt-8 rounded-[24px] border border-rust-500/12 bg-rust-500/6 p-5">
          <h2 className="text-xl font-black text-ink-900">Delete account</h2>
          <p className="mt-2 text-sm text-muted-600">
            Confirm using your password or send a one-time OTP to your registered email or
            phone. The OTP will not be shown on screen.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className={[
                "rounded-2xl px-4 py-3 text-sm font-bold transition",
                deleteMethod === "password"
                  ? "bg-rust-500 text-white"
                  : "bg-white text-ink-900 hover:bg-black/5",
              ].join(" ")}
              onClick={() => setDeleteMethod("password")}
              type="button"
            >
              Use password
            </button>
            <button
              className={[
                "rounded-2xl px-4 py-3 text-sm font-bold transition",
                deleteMethod === "otp"
                  ? "bg-rust-500 text-white"
                  : "bg-white text-ink-900 hover:bg-black/5",
              ].join(" ")}
              onClick={() => setDeleteMethod("otp")}
              type="button"
            >
              Use OTP
            </button>
          </div>

          {deleteMethod === "otp" ? (
            <div className="mt-4 flex flex-wrap gap-3">
              {user?.phone ? (
                <button
                  className={[
                    "rounded-2xl px-4 py-3 text-sm font-bold transition",
                    deliveryTarget === "phone"
                      ? "bg-teal-700 text-white"
                      : "bg-white text-ink-900 hover:bg-black/5",
                  ].join(" ")}
                  onClick={() => setDeliveryTarget("phone")}
                  type="button"
                >
                  Send to phone
                </button>
              ) : null}
              {user?.email ? (
                <button
                  className={[
                    "rounded-2xl px-4 py-3 text-sm font-bold transition",
                    deliveryTarget === "email"
                      ? "bg-teal-700 text-white"
                      : "bg-white text-ink-900 hover:bg-black/5",
                  ].join(" ")}
                  onClick={() => setDeliveryTarget("email")}
                  type="button"
                >
                  Send to email
                </button>
              ) : null}
              <button
                className="rounded-2xl bg-teal-700/10 px-4 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-700/15 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={otpState.isSubmitting}
                onClick={handleRequestOtp}
                type="button"
              >
                {otpState.isSubmitting ? "Sending..." : "Send delete OTP"}
              </button>
            </div>
          ) : null}

          {otpState.errorMessage ? (
            <p className="mt-4 rounded-2xl bg-rust-500/12 px-4 py-3 text-sm font-medium text-rust-700">
              {otpState.errorMessage}
            </p>
          ) : null}

          {otpState.successMessage ? (
            <div className="mt-4 rounded-[20px] bg-teal-700/10 p-4 text-sm text-teal-700">
              <p className="font-semibold">{otpState.successMessage}</p>
              {otpState.data?.expiresAt ? (
                <p className="mt-2 text-sm">
                  OTP validity: {new Date(otpState.data.expiresAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          ) : null}

          <form className="mt-5 grid gap-4" onSubmit={handleDeleteAccount}>
            {deleteMethod === "password" ? (
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                name="password"
                onChange={handleDeleteFormChange}
                placeholder="Current password"
                required
                type="password"
                value={deleteForm.password}
              />
            ) : (
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                maxLength={6}
                name="otp"
                onChange={handleDeleteFormChange}
                placeholder="6-digit OTP from your email or phone"
                required
                value={deleteForm.otp}
              />
            )}

            <button
              className="inline-flex items-center justify-center rounded-2xl bg-rust-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-rust-700 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={deleteState.isSubmitting}
              type="submit"
            >
              {deleteState.isSubmitting ? "Deleting..." : "Delete my account"}
            </button>
          </form>

          {deleteState.errorMessage ? (
            <p className="mt-4 rounded-2xl bg-rust-500/12 px-4 py-3 text-sm font-medium text-rust-700">
              {deleteState.errorMessage}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default AccountSettingsPage;
