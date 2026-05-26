import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import Avatar from "../common/Avatar";
import { BrandLogo } from "../branding/BrandLogo";

const navItems = [
  { label: "Home", to: "/" },
  { label: "Find Helpers", to: "/helpers" },
];

const roleIdentityMap = {
  customer: {
    label: "Customer Account",
    shortLabel: "Customer",
    description: "Book services and track requests",
    badgeClass: "border border-teal-700/15 bg-teal-700/10 text-teal-700",
    shellClass: "border-teal-700/12 bg-white/88",
  },
  helper: {
    label: "Helper Account",
    shortLabel: "Helper",
    description: "Manage services and customer bookings",
    badgeClass: "border border-rust-500/15 bg-rust-500/10 text-rust-700",
    shellClass: "border-rust-500/12 bg-white/88",
  },
  admin: {
    label: "Admin Account",
    shortLabel: "Admin",
    description: "Review platform activity and moderation",
    badgeClass: "border border-ink-900/10 bg-ink-900/8 text-ink-900",
    shellClass: "border-ink-900/10 bg-white/88",
  },
};

function getPageLabel(pathname) {
  if (pathname === "/") {
    return "Home";
  }

  if (pathname === "/helpers") {
    return "Helpers";
  }

  if (pathname.startsWith("/helpers/")) {
    return "Helper Profile";
  }

  if (pathname === "/login") {
    return "Login";
  }

  if (pathname === "/register") {
    return "Register";
  }

  if (pathname === "/forgot-password") {
    return "Forgot Password";
  }

  if (pathname === "/reset-password") {
    return "Reset Password";
  }

  if (pathname === "/helper-dashboard") {
    return "Dashboard";
  }

  if (pathname === "/become-helper") {
    return "Helper Profile";
  }

  if (pathname === "/bookings") {
    return "Bookings";
  }

  if (pathname.startsWith("/bookings/")) {
    return "Booking Details";
  }

  if (pathname === "/account") {
    return "Account";
  }

  if (pathname === "/admin-dashboard") {
    return "Admin Panel";
  }

  return "Current Page";
}

function getRoleIdentity(role) {
  return roleIdentityMap[role] || roleIdentityMap.customer;
}

function IdentityCard({ user, compact = false }) {
  if (!user) {
    return null;
  }

  const identity = getRoleIdentity(user.role);

  return (
    <span
      className={`inline-flex items-center gap-3 rounded-[24px] border px-3 py-2 text-ink-900 shadow-sm ${identity.shellClass}`}
    >
      <Avatar className={compact ? "h-10 w-10" : "h-9 w-9"} name={user.fullName} src={user.avatarUrl} />
      <span className="min-w-0">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.18em] ${identity.badgeClass}`}
        >
          {identity.shortLabel}
        </span>
        <span className="mt-1 block truncate text-sm font-bold text-ink-900">
          {user.fullName}
        </span>
        <span className="block text-xs text-muted-600">
          {compact ? identity.label : identity.description}
        </span>
      </span>
    </span>
  );
}

function AppShell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuth();
  const canGoBack = location.pathname !== "/";
  const currentPageLabel = getPageLabel(location.pathname);
  const pillClass =
    "rounded-full px-4 py-2 transition hover:bg-white/55 hover:text-ink-900";
  const mobilePillClass =
    "rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-ink-900";

  function goToPreviousPage() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/");
  }

  function getNavLinkClass(isActive) {
    return [
      "rounded-full px-4 py-2 transition",
      isActive
        ? "bg-white/80 text-ink-900 shadow-sm"
        : "hover:bg-white/55 hover:text-ink-900",
    ].join(" ");
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-[rgba(247,242,234,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex w-[min(1120px,calc(100%-32px))] items-center justify-between gap-5 py-4">
          <div className="flex items-center gap-3">
            <Link className="inline-flex items-center text-ink-900" to="/">
              <BrandLogo />
            </Link>
            {canGoBack ? (
              <button
                aria-label="Go to previous page"
                className="group inline-flex items-center gap-2 rounded-full border border-black/8 bg-white/78 px-3 py-2 text-sm text-ink-900 shadow-[0_10px_24px_rgba(22,33,38,0.08)] transition hover:-translate-y-0.5 hover:bg-white"
                onClick={goToPreviousPage}
                type="button"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-teal-700 text-white transition group-hover:bg-rust-500">
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8.25 5.5L3.75 10L8.25 14.5"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M4.5 10H16.25"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                </span>
                <span className="hidden sm:block">
                  <span className="block text-[0.62rem] font-black uppercase tracking-[0.22em] text-teal-700">
                    {currentPageLabel}
                  </span>
                  <span className="block font-semibold leading-none">Go Back</span>
                </span>
              </button>
            ) : null}
          </div>

          <nav className="hidden items-center gap-3 text-sm font-semibold text-muted-600 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                {item.label}
              </NavLink>
            ))}
            {user?.role === "helper" ? (
              <>
                <NavLink
                  className={({ isActive }) => getNavLinkClass(isActive)}
                  to="/helper-dashboard"
                >
                  Dashboard
                </NavLink>
                <NavLink
                  className={({ isActive }) => getNavLinkClass(isActive)}
                  to="/become-helper"
                >
                  Profile
                </NavLink>
              </>
            ) : user?.role === "admin" ? (
              <NavLink
                className={({ isActive }) => getNavLinkClass(isActive)}
                to="/admin-dashboard"
              >
                Admin Panel
              </NavLink>
            ) : (
              <Link className={pillClass} to="/register?role=helper">
                Join as Helper
              </Link>
            )}
            {isAuthenticated && user?.role === "customer" ? (
              <NavLink
                className={({ isActive }) => getNavLinkClass(isActive)}
                to="/bookings"
              >
                Bookings
              </NavLink>
            ) : null}
            {!isAuthenticated ? (
              <>
                <Link className={pillClass} to="/login">
                  Login
                </Link>
                <Link className="rounded-full bg-rust-500 px-4 py-2 text-white transition hover:bg-rust-700" to="/register">
                  Register
                </Link>
              </>
            ) : (
              <>
                <NavLink
                  className={({ isActive }) => getNavLinkClass(isActive)}
                  to="/account"
                >
                  Account
                </NavLink>
                <IdentityCard user={user} />
                <button
                  className="rounded-full bg-rust-500 px-4 py-2 text-white transition hover:bg-rust-700"
                  onClick={logout}
                  type="button"
                >
                  Logout
                </button>
              </>
            )}
          </nav>
        </div>

        <div className="mx-auto flex w-[min(1120px,calc(100%-32px))] gap-2 overflow-x-auto pb-4 md:hidden">
          {isAuthenticated ? <IdentityCard compact user={user} /> : null}
          <Link className={mobilePillClass} to="/">
            Home
          </Link>
          <Link className={mobilePillClass} to="/helpers">
            Helpers
          </Link>
          {user?.role === "helper" ? (
            <>
              <Link className={mobilePillClass} to="/helper-dashboard">
                Dashboard
              </Link>
              <Link className={mobilePillClass} to="/become-helper">
                Profile
              </Link>
            </>
          ) : user?.role === "admin" ? (
            <Link className={mobilePillClass} to="/admin-dashboard">
              Admin
            </Link>
          ) : (
            <Link className={mobilePillClass} to="/register?role=helper">
              Join
            </Link>
          )}
          {isAuthenticated && user?.role === "customer" ? (
            <Link className={mobilePillClass} to="/bookings">
              Bookings
            </Link>
          ) : null}
          {!isAuthenticated ? (
            <>
              <Link className={mobilePillClass} to="/login">
                Login
              </Link>
              <Link className="rounded-full bg-rust-500 px-4 py-2 text-sm font-semibold text-white" to="/register">
                Register
              </Link>
            </>
          ) : (
            <>
              <Link className={mobilePillClass} to="/account">
                Account
              </Link>
              <button
                className="rounded-full bg-rust-500 px-4 py-2 text-sm font-semibold text-white"
                onClick={logout}
                type="button"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </header>

      <main>{children}</main>

      <footer className="pb-10 pt-7 text-muted-600">
        <div className="mx-auto w-[min(1120px,calc(100%-32px))] rounded-[28px] border border-black/5 bg-white/60 px-6 py-5 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
          Trusted local helpers, clearer pricing, and easier booking.
        </div>
      </footer>
    </div>
  );
}

export default AppShell;
