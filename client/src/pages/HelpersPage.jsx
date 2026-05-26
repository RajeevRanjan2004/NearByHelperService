import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Avatar from "../components/common/Avatar";
import { categories as fallbackCategories, helpers as fallbackHelpers } from "../data/mockData";
import { fetchCategories, fetchHelpers } from "../services/api";
import { getCategoryLabel, getCategoryValue, resolveCategoryValue } from "../utils/categories";
import { calculateDistanceKm, formatDistanceKm, parseCoordinates } from "../utils/geo";

const sortOptions = [
  { value: "verified_desc", label: "Verified first" },
  { value: "rating_desc", label: "Highest rating" },
  { value: "price_asc", label: "Lowest starting price" },
  { value: "newest", label: "Newest profiles" },
];

function formatRoleLabel(role) {
  if (!role) {
    return "Helper";
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function readFilters(search, categories = []) {
  const params = new URLSearchParams(search);

  return {
    category: resolveCategoryValue(params.get("category"), categories),
    area: params.get("area") || "",
    postalCode: params.get("postalCode") || "",
    search: params.get("search") || "",
    sortBy: params.get("sortBy") || "verified_desc",
  };
}

function buildFilterQuery(filters) {
  const params = new URLSearchParams();

  if (filters.category && filters.category !== "all") {
    params.set("category", filters.category);
  }

  if (filters.area.trim()) {
    params.set("area", filters.area.trim());
  }

  if (filters.postalCode.trim()) {
    params.set("postalCode", filters.postalCode.trim());
  }

  if (filters.search.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.sortBy && filters.sortBy !== "verified_desc") {
    params.set("sortBy", filters.sortBy);
  }

  return params.toString();
}

function applyFallbackFilters(helpers, filters, categories) {
  const normalizedArea = normalizeText(filters.area);
  const normalizedPostalCode = normalizeText(filters.postalCode);
  const normalizedSearch = normalizeText(filters.search);
  const selectedCategoryLabel = getCategoryLabel(filters.category, categories).toLowerCase();

  const filteredHelpers = helpers.filter((helper) => {
    const matchesCategory =
      filters.category === "all" ||
      helper.category.toLowerCase() === filters.category.toLowerCase() ||
      helper.category.toLowerCase() === selectedCategoryLabel;

    if (!matchesCategory) {
      return false;
    }

    if (normalizedArea) {
      const areaText = [helper.area, helper.city, helper.state].filter(Boolean).join(" ").toLowerCase();

      if (!areaText.includes(normalizedArea)) {
        return false;
      }
    }

    if (normalizedPostalCode) {
      const postalCodes = Array.isArray(helper.postalCodes) ? helper.postalCodes : [];

      if (
        !postalCodes.some((postalCode) =>
          String(postalCode || "").toLowerCase().includes(normalizedPostalCode)
        )
      ) {
        return false;
      }
    }

    if (normalizedSearch) {
      const searchText = [
        helper.name,
        helper.category,
        helper.bio,
        helper.area,
        helper.experience,
        ...(helper.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchText.includes(normalizedSearch)) {
        return false;
      }
    }

    return true;
  });

  if (filters.sortBy === "rating_desc") {
    return filteredHelpers.sort((left, right) => Number(right.rating || 0) - Number(left.rating || 0));
  }

  if (filters.sortBy === "price_asc") {
    return filteredHelpers.sort((left, right) => Number(left.minPrice || 0) - Number(right.minPrice || 0));
  }

  if (filters.sortBy === "newest") {
    return filteredHelpers.sort(
      (left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0)
    );
  }

  return filteredHelpers.sort((left, right) => Number(Boolean(right.verified)) - Number(Boolean(left.verified)));
}

function HelpersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [categories, setCategories] = useState(fallbackCategories);
  const [helpers, setHelpers] = useState(fallbackHelpers);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [appliedFilters, setAppliedFilters] = useState(() =>
    readFilters(location.search, fallbackCategories)
  );
  const [filterForm, setFilterForm] = useState(() =>
    readFilters(location.search, fallbackCategories)
  );
  const [viewerLocation, setViewerLocation] = useState(null);
  const [locationState, setLocationState] = useState({
    isLocating: false,
    errorMessage: "",
  });

  useEffect(() => {
    const nextFilters = readFilters(location.search, categories);
    setAppliedFilters(nextFilters);
    setFilterForm(nextFilters);
  }, [categories, location.search]);

  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await fetchCategories();

        if (data?.length) {
          setCategories(data);
          return;
        }
      } catch (_error) {
        setErrorMessage("Categories API unavailable right now.");
      }

      setCategories(fallbackCategories);
    }

    loadCategories();
  }, []);

  useEffect(() => {
    async function loadHelpers() {
      setIsLoading(true);

      try {
        const data = await fetchHelpers(appliedFilters);
        setHelpers(data?.length ? data : []);
        setErrorMessage("");
      } catch (_error) {
        setHelpers(applyFallbackFilters(fallbackHelpers, appliedFilters, categories));
        setErrorMessage("Helpers API unavailable right now. Only live registered helpers are shown.");
      } finally {
        setIsLoading(false);
      }
    }

    loadHelpers();
  }, [appliedFilters, categories]);

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilterForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleApplyFilters(event) {
    event.preventDefault();
    const nextQuery = buildFilterQuery(filterForm);

    navigate(nextQuery ? `/helpers?${nextQuery}` : "/helpers");
  }

  function handleClearFilters() {
    navigate("/helpers");
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

  return (
    <section className="mx-auto w-[min(1120px,calc(100%-32px))] py-12">
      <div className="mb-6">
        <p className="inline-flex rounded-full bg-teal-700/10 px-4 py-2 text-sm font-bold text-teal-700">
          Helper listing
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.03em] text-ink-900 md:text-5xl">
          Nearby helpers
        </h1>
        <p className="mt-3 max-w-2xl text-muted-600">
          Filter helpers by category, area, PIN code, search, sort order, and live
          distance.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-bold text-ink-900 shadow-[0_12px_28px_rgba(22,33,38,0.08)] transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={locationState.isLocating}
            onClick={handleUseLiveLocation}
            type="button"
          >
            {locationState.isLocating ? "Detecting live distance..." : "Use my live location"}
          </button>
          {viewerLocation ? (
            <span className="rounded-full bg-teal-700/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-teal-700">
              Live distance active
            </span>
          ) : null}
        </div>
        {locationState.errorMessage ? (
          <p className="mt-3 text-sm font-medium text-rust-700">
            {locationState.errorMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="mt-3 text-sm font-medium text-rust-700">{errorMessage}</p>
        ) : null}
      </div>

      <form
        className="mb-6 rounded-[28px] border border-black/5 bg-white/70 p-5 shadow-[0_18px_40px_rgba(22,33,38,0.08)]"
        onSubmit={handleApplyFilters}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-2 text-sm font-bold text-ink-900">
            Category
            <select
              aria-label="Category"
              className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
              name="category"
              onChange={handleFilterChange}
              value={filterForm.category}
            >
              <option value="all">All categories</option>
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
            Search
            <input
              className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
              name="search"
              onChange={handleFilterChange}
              placeholder="Name, service, bio"
              value={filterForm.search}
            />
          </label>

          <label className="grid gap-2 text-sm font-bold text-ink-900">
            Area
            <input
              className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
              name="area"
              onChange={handleFilterChange}
              placeholder="City or area"
              value={filterForm.area}
            />
          </label>

          <label className="grid gap-2 text-sm font-bold text-ink-900">
            PIN code
            <input
              className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
              name="postalCode"
              onChange={handleFilterChange}
              placeholder="110096"
              value={filterForm.postalCode}
            />
          </label>

          <label className="grid gap-2 text-sm font-bold text-ink-900">
            Sort by
            <select
              className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
              name="sortBy"
              onChange={handleFilterChange}
              value={filterForm.sortBy}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="inline-flex items-center justify-center rounded-2xl bg-rust-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-rust-700"
            type="submit"
          >
            Apply filters
          </button>
          <button
            className="inline-flex items-center justify-center rounded-2xl bg-teal-700/10 px-4 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-700/15"
            onClick={handleClearFilters}
            type="button"
          >
            Clear
          </button>
          <p className="text-sm text-muted-600">
            {helpers.length} helper{helpers.length === 1 ? "" : "s"} found
          </p>
        </div>
      </form>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((card) => (
            <div
              className="h-72 animate-pulse rounded-[26px] border border-black/5 bg-white/50"
              key={card}
            />
          ))}
        </div>
      ) : helpers.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {helpers.map((helper) => {
            const helperCoordinates = parseCoordinates(
              helper.coordinates?.latitude,
              helper.coordinates?.longitude
            );
            const distanceKm =
              viewerLocation && helperCoordinates
                ? calculateDistanceKm(viewerLocation, helperCoordinates)
                : null;
            const distanceLabel = formatDistanceKm(distanceKm);

            return (
              <article
                className="grid gap-4 rounded-[26px] border border-black/5 bg-white/70 p-5 shadow-[0_18px_40px_rgba(22,33,38,0.08)]"
                key={helper.id}
              >
                <div className="flex flex-wrap gap-2">
                  {helper.verified ? (
                    <span className="rounded-full bg-rust-500/12 px-3 py-1 text-xs font-bold text-rust-700">
                      Verified
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-700">
                      {helper.verificationStatus?.replace("_", " ") || "Pending review"}
                    </span>
                  )}
                  <span className="rounded-full bg-sand-50 px-3 py-1 text-xs font-semibold text-ink-900">
                    Role: {helper.roleLabel || formatRoleLabel(helper.role)}
                  </span>
                  <span className="rounded-full bg-teal-700/8 px-3 py-1 text-xs font-semibold text-teal-700">
                    {helper.category}
                  </span>
                  {helperCoordinates ? (
                    <span className="rounded-full bg-teal-700/8 px-3 py-1 text-xs font-semibold text-teal-700">
                      {distanceLabel || "Map enabled"}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-4">
                  <Avatar className="h-15 w-15" name={helper.name} src={helper.avatarUrl} />
                  <div>
                    <h3 className="text-xl font-bold text-ink-900">{helper.name}</h3>
                    <p className="mt-1 text-sm text-muted-600">
                      {helper.area} | {helper.experience || "Experienced helper"}
                    </p>
                    {distanceLabel ? (
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-teal-700">
                        {distanceLabel} from your live location
                      </p>
                    ) : helperCoordinates ? (
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-muted-600">
                        Live distance available
                      </p>
                    ) : null}
                  </div>
                </div>

                {helper.portfolioPhotos?.[0] ? (
                  <img
                    alt={`${helper.name} portfolio preview`}
                    className="h-44 w-full rounded-[22px] object-cover"
                    src={helper.portfolioPhotos[0]}
                  />
                ) : null}

                <p className="text-sm text-muted-600">
                  {helper.bio || "Trusted local help for day-to-day service requests."}
                </p>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-teal-700/8 px-3 py-1 text-xs font-semibold text-teal-700">
                    Rating {helper.rating}
                  </span>
                  <span className="rounded-full bg-teal-700/8 px-3 py-1 text-xs font-semibold text-teal-700">
                    {helper.price}
                  </span>
                  <span className="rounded-full bg-teal-700/8 px-3 py-1 text-xs font-semibold text-teal-700">
                    Jobs {helper.completedJobs || 0}
                  </span>
                  {helper.portfolioPhotos?.length ? (
                    <span className="rounded-full bg-teal-700/8 px-3 py-1 text-xs font-semibold text-teal-700">
                      Portfolio {helper.portfolioPhotos.length}
                    </span>
                  ) : null}
                </div>

                {helper.postalCodes?.length ? (
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-600">
                    Works in PIN: {helper.postalCodes.join(", ")}
                  </p>
                ) : null}

                <Link
                  className="inline-flex items-center justify-center rounded-2xl bg-rust-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-rust-700"
                  to={`/helpers/${helper.id}`}
                >
                  Open Details
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[28px] border border-black/5 bg-white/70 p-6 text-muted-600 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
          No live helper was found for this filter combination. As soon as a helper
          registers and saves a profile, they will appear here.
        </div>
      )}
    </section>
  );
}

export default HelpersPage;
