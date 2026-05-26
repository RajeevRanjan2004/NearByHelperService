import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BrandLogo } from "../components/branding/BrandLogo";
import Avatar from "../components/common/Avatar";
import { useAuth } from "../contexts/AuthContext";
import { categories as fallbackCategories } from "../data/mockData";
import { createHelperProfile, fetchCategories } from "../services/api";
import { createAvatarDataUrl } from "../utils/avatar";
import { getCategoryLabel, getCategoryValue, resolveCategoryValue } from "../utils/categories";

const roleLabels = {
  customer: "Customer",
  helper: "Helper",
};

function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const [categories, setCategories] = useState(fallbackCategories);
  const [formState, setFormState] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    role: "customer",
    avatarUrl: "",
    serviceCategory: getCategoryValue(fallbackCategories[0]) || "",
    city: "",
    state: "",
  });
  const [submitState, setSubmitState] = useState({
    isSubmitting: false,
    errorMessage: "",
  });
  const [avatarState, setAvatarState] = useState({
    isProcessing: false,
    errorMessage: "",
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const role = params.get("role");

    if (role === "helper" || role === "customer") {
      setFormState((current) => ({ ...current, role }));
    }
  }, [location.search]);

  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await fetchCategories();

        if (data?.length) {
          setCategories(data);
          setFormState((current) => ({
            ...current,
            serviceCategory: current.serviceCategory
              ? resolveCategoryValue(current.serviceCategory, data)
              : getCategoryValue(data[0]),
          }));
          return;
        }
      } catch (_error) {
        // Fall back to bundled categories when the API is unavailable.
      }

      setFormState((current) => ({
        ...current,
        serviceCategory: current.serviceCategory
          ? resolveCategoryValue(current.serviceCategory, fallbackCategories)
          : getCategoryValue(fallbackCategories[0]) || "",
      }));
    }

    loadCategories();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormState((current) => ({ ...current, [name]: value }));
  }

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setAvatarState({
      isProcessing: true,
      errorMessage: "",
    });

    try {
      const avatarUrl = await createAvatarDataUrl(file);
      setFormState((current) => ({ ...current, avatarUrl }));
      setAvatarState({
        isProcessing: false,
        errorMessage: "",
      });
    } catch (error) {
      setAvatarState({
        isProcessing: false,
        errorMessage: error.message || "Profile photo could not be prepared.",
      });
    } finally {
      event.target.value = "";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitState({ isSubmitting: true, errorMessage: "" });

    try {
      const user = await register(formState);
      const helperCategoryLabel = getCategoryLabel(formState.serviceCategory, categories);

      if (user.role === "helper") {
        const helperPayload = {
          fullName: formState.fullName,
          email: formState.email,
          phone: formState.phone,
          serviceCategory: formState.serviceCategory,
          city: formState.city,
          state: formState.state,
          headline: `${helperCategoryLabel} services available nearby`,
          bio: "",
          yearsOfExperience: "",
          minPrice: "",
          maxPrice: "",
          priceUnit: "per_visit",
          radiusInKm: "5",
          availabilityDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
          startTime: "09:00",
          endTime: "18:00",
          slotDurationMinutes: "60",
        };

        try {
          await createHelperProfile(helperPayload);
          navigate("/become-helper", {
            replace: true,
            state: {
              message:
                "Basic helper profile created. Your helper profile is now visible in the Nearby Helpers listing.",
              prefill: {
                serviceCategory: formState.serviceCategory,
                city: formState.city,
                state: formState.state,
              },
            },
          });
        } catch (_profileError) {
          navigate("/become-helper", {
            replace: true,
            state: {
              message:
                "Account created successfully. Save your helper details to appear in the Nearby Helpers listing.",
              prefill: {
                serviceCategory: formState.serviceCategory,
                city: formState.city,
                state: formState.state,
              },
            },
          });
        }

        return;
      }

      navigate("/helpers", { replace: true });
    } catch (error) {
      setSubmitState({
        isSubmitting: false,
        errorMessage:
          error.response?.data?.message || "Registration failed. Please try again.",
      });
      return;
    }

    setSubmitState({ isSubmitting: false, errorMessage: "" });
  }

  const isHelperRegistration = formState.role === "helper";

  return (
    <section className="mx-auto w-[min(620px,calc(100%-32px))] py-12">
      <div className="rounded-[28px] border border-black/5 bg-white/70 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
        <Link className="inline-flex items-center text-ink-900" to="/">
          <BrandLogo compact />
        </Link>
        <p className="inline-flex rounded-full bg-teal-700/10 px-4 py-2 text-sm font-bold text-teal-700">
          Register
        </p>
        <h1 className="mt-4 text-3xl font-black text-ink-900">Create your account</h1>
        <p className="mt-3 text-sm text-muted-600">
          {isHelperRegistration
            ? "You are signing up as a helper. After account creation, you can complete your helper profile."
            : "Sign up as a customer to book services or switch to helper if you want to offer services."}
        </p>
        <div className="mt-5 rounded-2xl bg-teal-700/8 px-4 py-3 text-sm text-teal-700">
          Registering role:{" "}
          <span className="font-bold">{roleLabels[formState.role] || "Customer"}</span>
        </div>

        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="rounded-[24px] border border-black/5 bg-sand-50 p-4 md:col-span-2">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar className="h-18 w-18" name={formState.fullName} src={formState.avatarUrl} />
              <div className="grid gap-2">
                <p className="text-sm font-bold text-ink-900">Profile photo</p>
                <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-bold text-ink-900 transition hover:bg-black/5">
                  {avatarState.isProcessing ? "Preparing photo..." : "Upload photo"}
                  <input
                    accept="image/*"
                    className="hidden"
                    disabled={avatarState.isProcessing}
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
            {avatarState.errorMessage ? (
              <p className="mt-3 text-sm font-medium text-rust-700">{avatarState.errorMessage}</p>
            ) : null}
          </div>

          <input
            className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none md:col-span-2"
            name="fullName"
            onChange={handleChange}
            placeholder="Full name"
            required
            value={formState.fullName}
          />
          <input
            className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
            name="email"
            onChange={handleChange}
            placeholder="Email"
            required
            type="email"
            value={formState.email}
          />
          <input
            className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
            name="phone"
            onChange={handleChange}
            placeholder="Phone"
            required
            value={formState.phone}
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
          <select
            className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
            name="role"
            onChange={handleChange}
            value={formState.role}
            aria-label="Account role"
          >
            <option value="customer">Customer</option>
            <option value="helper">Helper</option>
          </select>

          {isHelperRegistration ? (
            <>
              <select
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none md:col-span-2"
                name="serviceCategory"
                onChange={handleChange}
                required={isHelperRegistration}
                value={formState.serviceCategory}
                aria-label="Helper role or service category"
              >
                <option value="" disabled>
                  Select helper role
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
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                name="city"
                onChange={handleChange}
                placeholder="City"
                required={isHelperRegistration}
                value={formState.city}
              />
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                name="state"
                onChange={handleChange}
                placeholder="State"
                required={isHelperRegistration}
                value={formState.state}
              />
            </>
          ) : null}

          <button
            className="inline-flex items-center justify-center rounded-2xl bg-rust-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-rust-700 disabled:cursor-not-allowed disabled:opacity-70 md:col-span-2"
            disabled={submitState.isSubmitting || avatarState.isProcessing}
            type="submit"
          >
            {submitState.isSubmitting ? "Creating account..." : "Register"}
          </button>
        </form>

        {submitState.errorMessage ? (
          <p className="mt-4 rounded-2xl bg-rust-500/12 px-4 py-3 text-sm font-medium text-rust-700">
            {submitState.errorMessage}
          </p>
        ) : null}

        <p className="mt-5 text-sm text-muted-600">
          Already have an account?{" "}
          <Link className="font-bold text-rust-700 underline" to="/login">
            Login here
          </Link>
        </p>
      </div>
    </section>
  );
}

export default RegisterPage;
