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

// Convertit une valeur de type date/Timestamp Firestore en millisecondes,
// pour trier des listes de commandes par date sans creer d'objet Date.
export const toTimeNumber = (value) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date ? date.getTime() : 0;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }
  if (typeof value === "object" && typeof value.seconds === "number") {
    const millis = value.seconds * 1000;
    if (typeof value.nanoseconds === "number") {
      return millis + Math.floor(value.nanoseconds / 1e6);
    }
    return millis;
  }
  return 0;
};
