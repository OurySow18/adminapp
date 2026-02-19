export const VENDOR_STATUS_VALUES = [
  "draft",
  "submitted",
  "paused",
  "needs_docs",
  "under_review",
  "approved",
  "rejected",
  "blocked",
];

const STATUS_ALIASES = {
  pending: "submitted",
  pause: "paused",
  en_pause: "paused",
  enpause: "paused",
  paused_vendor: "paused",
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
  paused: "En pause",
  needs_docs: "Documents manquants",
  under_review: "En revue",
  approved: "Approuve",
  rejected: "Refuse",
  blocked: "Bloque",
};

const toBooleanFlag = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (["true", "1", "yes", "oui", "paused", "en_pause"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "non", "active", "approved"].includes(normalized)) {
      return false;
    }
  }
  return undefined;
};

const hasTimestampValue = (value) => {
  if (value === undefined || value === null || value === "") return false;
  if (typeof value?.toDate === "function") return true;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime());
  }
  if (typeof value === "object" && typeof value.seconds === "number") {
    return true;
  }
  return false;
};

const hasNonEmptyValue = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
};

const getPauseMeta = (data) => {
  const pause = data?.pause ?? data?.profile?.pause ?? {};
  const explicitPauseCandidates = [
    data?.isPaused,
    data?.paused,
    data?.profile?.isPaused,
    data?.profile?.paused,
    pause?.isPaused,
    pause?.paused,
  ];

  let explicitPaused;
  for (const candidate of explicitPauseCandidates) {
    const normalized = toBooleanFlag(candidate);
    if (normalized !== undefined) {
      explicitPaused = normalized;
      break;
    }
  }

  const requestedActive = toBooleanFlag(pause?.active);

  const approvedDateMarkers = [
    pause?.approvedAt,
    data?.pauseApprovedAt,
    data?.profile?.pauseApprovedAt,
  ];
  const approvedActorMarkers = [
    pause?.approvedBy,
    pause?.approvedByUid,
    data?.pauseApprovedBy,
    data?.pauseApprovedByUid,
    data?.profile?.pauseApprovedBy,
    data?.profile?.pauseApprovedByUid,
  ];
  const resumedMarkers = [
    pause?.resumedAt,
    data?.pauseResumedAt,
    data?.profile?.pauseResumedAt,
  ];

  return {
    explicitPaused,
    requestedActive,
    hasApprovedMarker:
      approvedDateMarkers.some(hasTimestampValue) ||
      approvedActorMarkers.some(hasNonEmptyValue),
    hasResumedMarker: resumedMarkers.some(hasTimestampValue),
  };
};

export const isVendorPauseRequested = (data) => {
  if (!data || typeof data !== "object") return false;
  const meta = getPauseMeta(data);
  if (meta.hasResumedMarker) return false;
  if (meta.hasApprovedMarker) return false;
  return meta.requestedActive === true;
};

export const isVendorPaused = (data) => {
  if (!data || typeof data !== "object") return false;
  const meta = getPauseMeta(data);
  if (meta.hasResumedMarker) return false;
  if (meta.hasApprovedMarker) return true;
  if (meta.explicitPaused === true && meta.requestedActive !== true) return true;
  return false;
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
  const effectivePause = isVendorPaused(data);
  if (effectivePause) return "paused";
  const candidates = [
    data.status,
    data.vendorStatus,
    data?.profile?.status,
    data?.company?.status,
    data?.vendor?.status,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeVendorStatus(candidate);
    if (normalized === "paused" && !effectivePause) continue;
    if (normalized) return normalized;
  }

  return fallback;
};

export const getVendorStatusLabel = (status) =>
  VENDOR_STATUS_LABELS[status] ?? status ?? "";
