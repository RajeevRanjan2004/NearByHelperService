import { bookingStatusSteps, getBookingStatusLabel } from "../../utils/bookingStatus";

function BookingStatusTimeline({ status, className = "" }) {
  const activeIndex = bookingStatusSteps.findIndex((step) => step.key === status);
  const isClosedStatus = status === "cancelled" || status === "rejected";

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {bookingStatusSteps.map((step, index) => {
          const isReached = activeIndex >= index;
          const isCurrent = step.key === status;

          return (
            <div className="flex items-center gap-2" key={step.key}>
              <span
                className={[
                  "inline-flex min-w-[6.5rem] items-center justify-center rounded-full px-3 py-2 text-[0.7rem] font-bold uppercase tracking-[0.08em]",
                  isCurrent
                    ? "bg-rust-500 text-white"
                    : isReached
                      ? "bg-teal-700/12 text-teal-700"
                      : "bg-black/5 text-muted-600",
                ].join(" ")}
              >
                {step.label}
              </span>
              {index < bookingStatusSteps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={[
                    "h-1 w-6 rounded-full",
                    isReached && activeIndex > index ? "bg-teal-700/35" : "bg-black/8",
                  ].join(" ")}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      {isClosedStatus ? (
        <p className="mt-3 text-sm font-medium text-rust-700">
          Final status: {getBookingStatusLabel(status)}
        </p>
      ) : null}
    </div>
  );
}

export default BookingStatusTimeline;
