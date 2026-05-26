import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { resetPassword } from "../services/api";

function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [formState, setFormState] = useState({
    emailOrPhone: "",
    otp: "",
    password: "",
    confirmPassword: "",
  });
  const [submitState, setSubmitState] = useState({
    isSubmitting: false,
    errorMessage: "",
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const identifier = params.get("identifier") || "";

    setFormState((current) => ({
      ...current,
      emailOrPhone: identifier,
    }));
  }, [location.search]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormState((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (formState.password !== formState.confirmPassword) {
      setSubmitState({
        isSubmitting: false,
        errorMessage: "Password and confirm password do not match.",
      });
      return;
    }

    setSubmitState({
      isSubmitting: true,
      errorMessage: "",
    });

    try {
      await resetPassword({
        emailOrPhone: formState.emailOrPhone,
        otp: formState.otp,
        password: formState.password,
      });

      navigate("/login", {
        replace: true,
        state: {
          message: "Password reset successful. Log in with your new password.",
        },
      });
    } catch (error) {
      setSubmitState({
        isSubmitting: false,
        errorMessage:
          error.response?.data?.message || "Password could not be reset right now.",
      });
    }
  }

  return (
    <section className="mx-auto w-[min(620px,calc(100%-32px))] py-12">
      <div className="rounded-[28px] border border-black/5 bg-white/70 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
        <p className="inline-flex rounded-full bg-teal-700/10 px-4 py-2 text-sm font-bold text-teal-700">
          Reset password
        </p>
        <h1 className="mt-4 text-3xl font-black text-ink-900">Set a new password</h1>
        <p className="mt-3 text-sm text-muted-600">
          Enter the same email or phone, then the OTP from the forgot password screen, and
          finally your new password.
        </p>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <input
            className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
            name="emailOrPhone"
            onChange={handleChange}
            placeholder="Email or phone"
            required
            value={formState.emailOrPhone}
          />
          <input
            className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
            maxLength={6}
            name="otp"
            onChange={handleChange}
            placeholder="6-digit OTP"
            required
            value={formState.otp}
          />
          <input
            className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
            minLength={6}
            name="password"
            onChange={handleChange}
            placeholder="New password"
            required
            type="password"
            value={formState.password}
          />
          <input
            className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
            minLength={6}
            name="confirmPassword"
            onChange={handleChange}
            placeholder="Confirm new password"
            required
            type="password"
            value={formState.confirmPassword}
          />

          <button
            className="inline-flex items-center justify-center rounded-2xl bg-rust-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-rust-700 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={submitState.isSubmitting}
            type="submit"
          >
            {submitState.isSubmitting ? "Updating..." : "Reset password"}
          </button>
        </form>

        {submitState.errorMessage ? (
          <p className="mt-4 rounded-2xl bg-rust-500/12 px-4 py-3 text-sm font-medium text-rust-700">
            {submitState.errorMessage}
          </p>
        ) : null}

        <p className="mt-5 text-sm text-muted-600">
          Need a fresh OTP?{" "}
          <Link className="font-bold text-rust-700 underline" to="/forgot-password">
            Generate again
          </Link>
        </p>
      </div>
    </section>
  );
}

export default ResetPasswordPage;
