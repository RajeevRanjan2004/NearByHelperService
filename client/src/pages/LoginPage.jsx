import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BrandLogo } from "../components/branding/BrandLogo";
import { useAuth } from "../contexts/AuthContext";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const flashMessage = location.state?.message || "";
  const [formState, setFormState] = useState({
    emailOrPhone: "",
    password: "",
  });
  const [submitState, setSubmitState] = useState({
    isSubmitting: false,
    errorMessage: "",
  });

  function handleChange(event) {
    const { name, value } = event.target;
    setFormState((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitState({ isSubmitting: true, errorMessage: "" });

    try {
      const user = await login(formState);
      const redirectTo = location.state?.from?.pathname;

      if (redirectTo) {
        navigate(redirectTo, { replace: true });
        return;
      }

      navigate(user.role === "helper" ? "/become-helper" : "/helpers", { replace: true });
    } catch (error) {
      setSubmitState({
        isSubmitting: false,
        errorMessage:
          error.response?.data?.message || "Login failed. Please check your details.",
      });
      return;
    }

    setSubmitState({ isSubmitting: false, errorMessage: "" });
  }

  return (
    <section className="mx-auto w-[min(520px,calc(100%-32px))] py-12">
      <div className="rounded-[28px] border border-black/5 bg-white/70 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
        <Link className="inline-flex items-center text-ink-900" to="/">
          <BrandLogo compact />
        </Link>
        <p className="inline-flex rounded-full bg-teal-700/10 px-4 py-2 text-sm font-bold text-teal-700">
          Login
        </p>
        <h1 className="mt-4 text-3xl font-black text-ink-900">Welcome back</h1>
        <p className="mt-3 text-sm text-muted-600">
          Sign in with your email or phone and password.
        </p>

        {flashMessage ? (
          <p className="mt-4 rounded-2xl bg-teal-700/10 px-4 py-3 text-sm font-medium text-teal-700">
            {flashMessage}
          </p>
        ) : null}

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
            name="password"
            onChange={handleChange}
            placeholder="Password"
            required
            type="password"
            value={formState.password}
          />

          <div className="flex justify-end">
            <Link className="text-sm font-bold text-rust-700 underline" to="/forgot-password">
              Forgot password?
            </Link>
          </div>

          <button
            className="inline-flex items-center justify-center rounded-2xl bg-rust-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-rust-700 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={submitState.isSubmitting}
            type="submit"
          >
            {submitState.isSubmitting ? "Signing in..." : "Login"}
          </button>
        </form>

        {submitState.errorMessage ? (
          <p className="mt-4 rounded-2xl bg-rust-500/12 px-4 py-3 text-sm font-medium text-rust-700">
            {submitState.errorMessage}
          </p>
        ) : null}

        <p className="mt-5 text-sm text-muted-600">
          New here?{" "}
          <Link className="font-bold text-rust-700 underline" to="/register">
            Create an account
          </Link>
        </p>
      </div>
    </section>
  );
}

export default LoginPage;
