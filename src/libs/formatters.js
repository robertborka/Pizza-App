export function safeNumber(value, fallback = 0) {
  const number = Number(value);

  if (!Number.isFinite(number) || Number.isNaN(number)) {
    return fallback;
  }

  return number;
}

export function roundTo(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(safeNumber(value) * factor) / factor;
}

export function formatMoney(value, fallback = "0 lei") {
  const number = safeNumber(value, null);

  if (number === null) {
    return fallback;
  }

  const rounded = roundTo(number, 2);

  return `${new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rounded)} lei`;
}

export function formatMinutes(value, fallback = "-") {
  const minutes = safeNumber(value, null);

  if (minutes === null) {
    return fallback;
  }

  return `${Math.round(minutes)} min`;
}

export function formatDistanceKm(value, fallback = "-") {
  const distance = safeNumber(value, null);

  if (distance === null) {
    return fallback;
  }

  return `${new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: distance % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(distance)} km`;
}

export function formatDateTime(value, fallback = "-") {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
