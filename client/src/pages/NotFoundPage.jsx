import { Link } from "react-router-dom";

function NotFoundPage() {
  return (
    <section className="mx-auto w-[min(1120px,calc(100%-32px))] py-12">
      <div className="rounded-[28px] border border-black/5 bg-white/70 p-6 shadow-[0_18px_40px_rgba(22,33,38,0.08)]">
        <h1 className="text-3xl font-black text-ink-900">Page not found</h1>
        <p className="mt-3 text-sm text-muted-600">
          This route is not available yet or was opened incorrectly.
        </p>
        <Link
          className="mt-5 inline-flex items-center justify-center rounded-2xl bg-teal-700/10 px-4 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-700/15"
          to="/"
        >
          Go Home
        </Link>
      </div>
    </section>
  );
}

export default NotFoundPage;
