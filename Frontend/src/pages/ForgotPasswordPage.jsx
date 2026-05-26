import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../services/api";

function ForgotPasswordPage() {
  const [formState, setFormState] = useState({
    emailOrPhone: "",
  });
  const [submitState, setSubmitState] = useState({
    isSubmitting: false,
    errorMessage: "",
    successMessage: "",
    resetData: null,
  });

  function handleChange(event) {
    const { name, value } = event.target;
    setFormState((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitState({
      isSubmitting: true,
      errorMessage: "",
      successMessage: "",
      resetData: null,
    });

    try {
      const data = await forgotPassword(formState);
      setSubmitState({
        isSubmitting: false,
        errorMessage: "",
        successMessage: `OTP sent to ${data?.identifier || "your registered account"} via ${
          data?.channel || "the configured channel"
        }.`,
        resetData: data,
      });
    } catch (error) {
      setSubmitState({
        isSubmitting: false,
        errorMessage:
          error.response?.data?.message || "OTP could not be sent right now. Please try again.",
        successMessage: "",
        resetData: null,
      });
    }
  }

  return (
    <section className="mx-auto w-[min(620px,calc(100%-32px))] py-12">
      <div className="rounded-[28px] border border-black/5 bg-white/70 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
        <p className="inline-flex rounded-full bg-teal-700/10 px-4 py-2 text-sm font-bold text-teal-700">
          Forgot password
        </p>
        <h1 className="mt-4 text-3xl font-black text-ink-900">Reset your login</h1>
        <p className="mt-3 text-sm text-muted-600">
          Enter your registered email or phone number. OTP directly usi destination par
          bheja jayega.
        </p>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <input
            className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
            name="emailOrPhone"
            onChange={handleChange}
            placeholder="Registered email or phone"
            required
            value={formState.emailOrPhone}
          />

          <button
            className="inline-flex items-center justify-center rounded-2xl bg-rust-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-rust-700 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={submitState.isSubmitting}
            type="submit"
          >
            {submitState.isSubmitting ? "Sending..." : "Send OTP"}
          </button>
        </form>

        {submitState.errorMessage ? (
          <p className="mt-4 rounded-2xl bg-rust-500/12 px-4 py-3 text-sm font-medium text-rust-700">
            {submitState.errorMessage}
          </p>
        ) : null}

        {submitState.successMessage ? (
          <div className="mt-4 rounded-[24px] bg-teal-700/10 p-4 text-sm text-teal-700">
            <p className="font-semibold">{submitState.successMessage}</p>
            {submitState.resetData?.expiresAt ? (
              <p className="mt-2 text-sm">
                OTP validity: {new Date(submitState.resetData.expiresAt).toLocaleString()}
              </p>
            ) : null}
            <Link
              className="mt-4 inline-flex items-center justify-center rounded-2xl bg-rust-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-rust-700"
              to={submitState.resetData?.resetLinkPath || "/reset-password"}
            >
              Open reset page
            </Link>
          </div>
        ) : null}

        <p className="mt-5 text-sm text-muted-600">
          Remembered it?{" "}
          <Link className="font-bold text-rust-700 underline" to="/login">
            Back to login
          </Link>
        </p>
      </div>
    </section>
  );
}

export default ForgotPasswordPage;
