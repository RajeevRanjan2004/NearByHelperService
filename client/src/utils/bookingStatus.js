const bookingStatusLabels = {
  requested: "Requested",
  accepted: "Accepted",
  rejected: "Rejected",
  in_progress: "On the way",
  completed: "Completed",
  cancelled: "Cancelled",
};

const bookingStatusSteps = [
  { key: "requested", label: "Requested" },
  { key: "accepted", label: "Accepted" },
  { key: "in_progress", label: "On the way" },
  { key: "completed", label: "Completed" },
];

function getBookingStatusLabel(status) {
  return bookingStatusLabels[status] || String(status || "").replace(/_/g, " ");
}

export { bookingStatusLabels, bookingStatusSteps, getBookingStatusLabel };
