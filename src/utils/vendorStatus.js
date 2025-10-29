export const VENDOR_STATUS_VALUES = [
  "draft",
  "submitted",
  "needs_docs",
  "under_review",
  "approved",
  "rejected",
  "blocked",
];

const STATUS_ALIASES = {
  pending: "submitted",
  pending_docs: "needs_docs",
  needsdocs: "needs_docs",
  awaiting_docs: "needs_docs",
  review: "under_review",
  underreview: "under_review",
  validated: "approved",
  active: "approved",
  approved_vendor: "approved",
  refused: "rejected",
  declined: "rejected",
  suspended: "blocked",
  disabled: "blocked",
  inactive: "blocked",
};

export const VENDOR_STATUS_LABELS = {
  draft: "Brouillon",
  submitted: "Soumis",
  needs_docs: "Documents manquants",
  under_review: "En revue",
  approved: "Approuve",
  rejected: "Refuse",
  blocked: "Bloque",
};

export const isVendorStatus = (value) =>
  typeof value === "string" && VENDOR_STATUS_VALUES.includes(value);

export const normalizeVendorStatus = (value) => {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, "_").toLowerCase();
  if (isVendorStatus(normalized)) return normalized;
  const alias = STATUS_ALIASES[normalized];
  if (alias && isVendorStatus(alias)) return alias;
  return undefined;
};

export const resolveVendorStatus = (data, fallback = "draft") => {
  if (!data || typeof data !== "object") return fallback;
  const candidates = [
    data.status,
    data.vendorStatus,
    data?.profile?.status,
    data?.company?.status,
    data?.vendor?.status,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeVendorStatus(candidate);
    if (normalized) return normalized;
  }

  return fallback;
};

export const getVendorStatusLabel = (status) =>
  VENDOR_STATUS_LABELS[status] ?? status ?? "";
