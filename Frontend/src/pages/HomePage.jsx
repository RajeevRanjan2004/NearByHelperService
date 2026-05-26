import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Avatar from "../components/common/Avatar";
import { categories as fallbackCategories, helpers as fallbackHelpers } from "../data/mockData";
import { fetchCategories, fetchHelpers } from "../services/api";
import { getCategoryValue } from "../utils/categories";

function HomePage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState(fallbackCategories);
  const [featuredHelpers, setFeaturedHelpers] = useState(fallbackHelpers.slice(0, 3));
  const [errorMessage, setErrorMessage] = useState("");
  const [heroFilters, setHeroFilters] = useState({
    category: getCategoryValue(fallbackCategories[0]) || "",
    area: "",
    search: "",
  });

  useEffect(() => {
    async function loadHomeData() {
      try {
        const [categoryData, helperData] = await Promise.all([
          fetchCategories(),
          fetchHelpers(),
        ]);

        if (categoryData?.length) {
          setCategories(categoryData);
          setHeroFilters((current) => ({
            ...current,
            category: current.category || getCategoryValue(categoryData[0]) || "",
          }));
        }

        if (helperData?.length) {
          setFeaturedHelpers(helperData.slice(0, 3));
        }

        setErrorMessage("");
      } catch (_error) {
        setErrorMessage("Live API unavailable right now. Demo helpers are hidden.");
      }
    }

    loadHomeData();
  }, []);

  function handleHeroFilterChange(event) {
    const { name, value } = event.target;
    setHeroFilters((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleHeroSearch(event) {
    event.preventDefault();
    const params = new URLSearchParams();

    if (heroFilters.category) {
      params.set("category", heroFilters.category);
    }

    if (heroFilters.area.trim()) {
      params.set("area", heroFilters.area.trim());
    }

    if (heroFilters.search.trim()) {
      params.set("search", heroFilters.search.trim());
    }

    navigate(`/helpers?${params.toString()}`);
  }

  return (
    <>
      <section className="mx-auto grid w-[min(1120px,calc(100%-32px))] gap-6 px-0 pb-12 pt-14 md:grid-cols-[1.15fr_0.85fr] md:items-center md:pt-16">
        <div>
          <span className="inline-flex rounded-full bg-teal-700/10 px-4 py-2 text-sm font-bold text-teal-700">
            Local services, built on trust
          </span>
          <h1 className="mt-3 max-w-[10ch] text-5xl font-black leading-[0.95] tracking-[-0.04em] text-ink-900 md:text-7xl">
            Find nearby helpers without the usual hassle.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-600 md:text-lg">
            Search plumbers, electricians, maids, carpenters, drivers, and more with
            clear pricing, ratings, and faster booking.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="inline-flex items-center justify-center rounded-2xl bg-rust-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-rust-700"
              to="/helpers"
            >
              Explore Helpers
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-2xl bg-white/85 px-5 py-3 text-sm font-bold text-ink-900 transition hover:bg-white"
              to="/register?role=helper"
            >
              Join as Helper
            </Link>
            <a
              className="inline-flex items-center justify-center rounded-2xl bg-teal-700/10 px-5 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-700/15"
              href="#categories"
            >
              Browse Categories
            </a>
          </div>

          {errorMessage ? (
            <p className="mt-4 text-sm font-medium text-rust-700">{errorMessage}</p>
          ) : null}
        </div>

        <form
          className="rounded-[28px] border border-black/5 bg-white/80 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)] backdrop-blur-sm"
          onSubmit={handleHeroSearch}
        >
          <div className="grid gap-4">
            <label className="grid gap-2 text-sm font-bold text-ink-900">
              Service
              <select
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none ring-0"
                name="category"
                onChange={handleHeroFilterChange}
                value={heroFilters.category}
              >
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
              Area or PIN code
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none ring-0"
                name="area"
                onChange={handleHeroFilterChange}
                placeholder="Enter your area or PIN code"
                value={heroFilters.area}
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-ink-900">
              What do you need
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none ring-0"
                name="search"
                onChange={handleHeroFilterChange}
                placeholder="Describe the issue"
                value={heroFilters.search}
              />
            </label>
          </div>

          <div className="mt-5">
            <button
              className="inline-flex w-full items-center justify-center rounded-2xl bg-rust-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-rust-700"
              type="submit"
            >
              Find Nearby Helpers
            </button>
          </div>
        </form>
      </section>

      <section className="mx-auto w-[min(1120px,calc(100%-32px))] py-4">
        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[26px] border border-black/5 bg-white/70 p-5 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
            <div className="text-3xl font-black text-rust-700">20+</div>
            <p className="mt-2 text-sm text-muted-600">
              service categories planned for the full app
            </p>
          </article>
          <article className="rounded-[26px] border border-black/5 bg-white/70 p-5 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
            <div className="text-3xl font-black text-rust-700">5 km</div>
            <p className="mt-2 text-sm text-muted-600">
              hyperlocal discovery focus for faster results
            </p>
          </article>
          <article className="rounded-[26px] border border-black/5 bg-white/70 p-5 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
            <div className="text-3xl font-black text-rust-700">3 roles</div>
            <p className="mt-2 text-sm text-muted-600">
              customer, helper, and admin flows in MVP
            </p>
          </article>
        </div>
      </section>

      <section
        className="mx-auto w-[min(1120px,calc(100%-32px))] py-12"
        id="categories"
      >
        <div className="mb-5">
          <p className="inline-flex rounded-full bg-teal-700/10 px-4 py-2 text-sm font-bold text-teal-700">
            Popular categories
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-ink-900 md:text-5xl">
            What people usually need nearby
          </h2>
          <p className="mt-3 max-w-2xl text-muted-600">
            Start with high-demand categories so the MVP solves real everyday needs.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {categories.map((category) => (
            <Link
              className="rounded-[24px] border border-black/5 bg-white/70 p-5 shadow-[0_18px_40px_rgba(22,33,38,0.08)] transition hover:-translate-y-1"
              key={category.id || category.slug || category.name}
              to={`/helpers?category=${encodeURIComponent(getCategoryValue(category))}`}
            >
              <div className="text-lg font-black text-rust-700">
                {category.icon || category.name.slice(0, 2).toUpperCase()}
              </div>
              <h3 className="mt-4 text-lg font-bold text-ink-900">{category.name}</h3>
              <p className="mt-2 text-sm text-muted-600">
                {category.description || "High-demand local service support."}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto w-[min(1120px,calc(100%-32px))] py-4">
        <div className="mb-5">
          <p className="inline-flex rounded-full bg-teal-700/10 px-4 py-2 text-sm font-bold text-teal-700">
            Trust first
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-ink-900 md:text-5xl">
            Core features for a stronger local platform
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Verified helper badges",
              body: "Show identity and approval status clearly to improve booking confidence.",
            },
            {
              title: "Simple booking flow",
              body: "Keep the form short so users can request help quickly, especially on mobile.",
            },
            {
              title: "Ratings and reviews",
              body: "Let good helpers build reputation while helping users compare profiles.",
            },
          ].map((feature) => (
            <article
              className="rounded-[26px] border border-black/5 bg-white/70 p-5 shadow-[0_18px_40px_rgba(22,33,38,0.08)]"
              key={feature.title}
            >
              <h3 className="text-xl font-bold text-ink-900">{feature.title}</h3>
              <p className="mt-3 text-sm text-muted-600">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-[min(1120px,calc(100%-32px))] py-12">
        <div className="mb-5">
          <p className="inline-flex rounded-full bg-teal-700/10 px-4 py-2 text-sm font-bold text-teal-700">
            Live helpers
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-ink-900 md:text-5xl">
            Featured helpers for the first user journey
          </h2>
        </div>

        {featuredHelpers.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featuredHelpers.map((helper) => (
              <article
                className="grid gap-4 rounded-[26px] border border-black/5 bg-white/70 p-5 shadow-[0_18px_40px_rgba(22,33,38,0.08)]"
                key={helper.id}
              >
                <div className="flex flex-wrap gap-2">
                  {helper.verified ? (
                    <span className="rounded-full bg-rust-500/12 px-3 py-1 text-xs font-bold text-rust-700">
                      Verified
                    </span>
                  ) : null}
                  <span className="rounded-full bg-teal-700/8 px-3 py-1 text-xs font-semibold text-teal-700">
                    {helper.category}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <Avatar className="h-15 w-15" name={helper.name} src={helper.avatarUrl} />
                  <div>
                    <h3 className="text-xl font-bold text-ink-900">{helper.name}</h3>
                    <p className="mt-1 text-sm text-muted-600">
                      {helper.area} | {helper.experience || "Experienced helper"}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-600">
                  {helper.bio || "Trusted local help for common household service needs."}
                </p>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-teal-700/8 px-3 py-1 text-xs font-semibold text-teal-700">
                    Rating {helper.rating}
                  </span>
                  <span className="rounded-full bg-teal-700/8 px-3 py-1 text-xs font-semibold text-teal-700">
                    {helper.price}
                  </span>
                </div>

                <Link
                  className="inline-flex items-center justify-center rounded-2xl bg-teal-700/10 px-4 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-700/15"
                  to={`/helpers/${helper.id}`}
                >
                  View Profile
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-[26px] border border-dashed border-black/10 bg-white/60 p-6 text-sm text-muted-600 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
            No helper is live yet. Once a helper registers and saves a profile, they will
            appear here.
          </div>
        )}
      </section>
    </>
  );
}

export default HomePage;
