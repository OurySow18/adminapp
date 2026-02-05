export const resolveOrderDate = (details) => {
  const candidates = [
    details?.timeStamp,
    details?.timestamp,
    details?.createdAt,
    details?.created_at,
    details?.orderDate,
    details?.date,
  ];

  for (const value of candidates) {
    if (!value) continue;

    if (typeof value?.toDate === "function") {
      const date = value.toDate();
      if (date instanceof Date && !Number.isNaN(date.getTime())) return date;
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

    if (typeof value === "number") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }

    if (typeof value === "string") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }

    if (typeof value === "object" && value.seconds != null) {
      const millis =
        value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
      const date = new Date(millis);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }

  return new Date();
};
