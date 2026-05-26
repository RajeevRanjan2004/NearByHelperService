const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseTimeToMinutes(value) {
  const [hours, minutes] = String(value || "")
    .split(":")
    .map((item) => Number(item));

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatMinutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function normalizeSlotDuration(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 60;
  }

  return Math.min(240, Math.max(15, Math.round(parsed / 15) * 15));
}

function normalizeAvailability(availability = {}) {
  return {
    days: Array.isArray(availability.days) ? availability.days.filter(Boolean) : [],
    startTime: availability.startTime || "",
    endTime: availability.endTime || "",
    slotDurationMinutes: normalizeSlotDuration(availability.slotDurationMinutes || 60),
  };
}

function validateAvailabilityInput(availability = {}) {
  const normalized = normalizeAvailability(availability);

  if (!normalized.days.length) {
    return "Select at least one available day";
  }

  const startMinutes = parseTimeToMinutes(normalized.startTime);
  const endMinutes = parseTimeToMinutes(normalized.endTime);

  if (startMinutes === null || endMinutes === null) {
    return "Start and end times must be valid";
  }

  if (endMinutes <= startMinutes) {
    return "End time must be after start time";
  }

  if (endMinutes - startMinutes < normalized.slotDurationMinutes) {
    return "Availability window must be longer than one slot";
  }

  return null;
}

function getDateDayLabel(date) {
  return weekDays[date.getDay()];
}

function buildSlotLabel(startAt, endAt) {
  const dayLabel = startAt.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const startLabel = startAt.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const endLabel = endAt.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${dayLabel} | ${startLabel}-${endLabel}`;
}

function generateUpcomingSlots(availability = {}, options = {}) {
  const normalized = normalizeAvailability(availability);
  const validationError = validateAvailabilityInput(normalized);

  if (validationError) {
    return [];
  }

  const startMinutes = parseTimeToMinutes(normalized.startTime);
  const endMinutes = parseTimeToMinutes(normalized.endTime);
  const now = options.now ? new Date(options.now) : new Date();
  const lookAheadDays = options.lookAheadDays || 14;
  const maxSlots = options.maxSlots || 12;
  const slots = [];

  for (let dayOffset = 0; dayOffset < lookAheadDays && slots.length < maxSlots; dayOffset += 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + dayOffset);

    if (!normalized.days.includes(getDateDayLabel(date))) {
      continue;
    }

    for (
      let minuteOffset = startMinutes;
      minuteOffset + normalized.slotDurationMinutes <= endMinutes && slots.length < maxSlots;
      minuteOffset += normalized.slotDurationMinutes
    ) {
      const startAt = new Date(date);
      startAt.setHours(Math.floor(minuteOffset / 60), minuteOffset % 60, 0, 0);

      if (startAt <= now) {
        continue;
      }

      const endAt = new Date(startAt);
      endAt.setMinutes(endAt.getMinutes() + normalized.slotDurationMinutes);

      slots.push({
        id: startAt.toISOString(),
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        dayLabel: getDateDayLabel(startAt),
        startTime: formatMinutesToTime(minuteOffset),
        endTime: formatMinutesToTime(minuteOffset + normalized.slotDurationMinutes),
        label: buildSlotLabel(startAt, endAt),
      });
    }
  }

  return slots;
}

function isScheduledDateWithinAvailability(scheduledDate, availability = {}) {
  const date = new Date(scheduledDate);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const normalized = normalizeAvailability(availability);
  const validationError = validateAvailabilityInput(normalized);

  if (validationError) {
    return false;
  }

  const dayLabel = getDateDayLabel(date);

  if (!normalized.days.includes(dayLabel)) {
    return false;
  }

  const startMinutes = parseTimeToMinutes(normalized.startTime);
  const endMinutes = parseTimeToMinutes(normalized.endTime);
  const currentMinutes = date.getHours() * 60 + date.getMinutes();

  if (
    currentMinutes < startMinutes ||
    currentMinutes + normalized.slotDurationMinutes > endMinutes
  ) {
    return false;
  }

  return (currentMinutes - startMinutes) % normalized.slotDurationMinutes === 0;
}

export {
  generateUpcomingSlots,
  getDateDayLabel,
  isScheduledDateWithinAvailability,
  normalizeAvailability,
  normalizeSlotDuration,
  parseTimeToMinutes,
  validateAvailabilityInput,
};
