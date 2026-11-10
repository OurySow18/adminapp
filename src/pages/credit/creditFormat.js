// Petits formatteurs partages par les pages du module Credit entreprise.
export const formatGNF = (value) =>
  `${(Number(value) || 0).toLocaleString("fr-FR")} GNF`;

// "AAAA-MM-JJ" -> "31 mars 2026".
export const formatDueDate = (value) => {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  return null;
};

export const formatDateTime = (value) => {
  const date = toDate(value);
  return date
    ? date.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
};

// Jours de retard par rapport a AAAA-MM-JJ aujourd'hui (0 si pas en retard).
export const daysLate = (dueDateStr, todayStr) => {
  if (!dueDateStr || dueDateStr >= todayStr) return 0;
  const due = new Date(`${dueDateStr}T00:00:00Z`);
  const today = new Date(`${todayStr}T00:00:00Z`);
  return Math.max(0, Math.round((today.getTime() - due.getTime()) / 86400000));
};

export { toDate };
