export const VENDOR_STATUS_VALUES = [
  "draft",
  "submitted",
  "paused",
  "needs_docs",
  "under_review",
  "approved",
  "rejected",
  "blocked",
] as const;

export type VendorStatus = (typeof VENDOR_STATUS_VALUES)[number];

const STATUS_ALIASES: Record<string, VendorStatus> = {
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

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  draft: "Brouillon",
  submitted: "Soumis",
  paused: "En pause",
  needs_docs: "Documents manquants",
  under_review: "En revue",
  approved: "Approuvé",
  rejected: "Refusé",
  blocked: "Bloqué",
};

// Les documents Firestore vendeur n'ont pas de schema formel garanti ; on les
// traite comme des sacs de champs potentiellement absents/mal types.
type VendorData = Record<string, any>;

interface AccountState {
  key: string;
  label: string;
  description: string;
  reason: string;
  deletedAt: unknown;
  requiresPayoutReview: boolean;
}

const toBooleanFlag = (value: unknown): boolean | undefined => {
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

const hasTimestampValue = (value: unknown): boolean => {
  if (value === undefined || value === null || value === "") return false;
  if (typeof (value as any)?.toDate === "function") return true;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime());
  }
  if (typeof value === "object" && typeof (value as any).seconds === "number") {
    return true;
  }
  return false;
};

const hasNonEmptyValue = (value: unknown): boolean => {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
};

const getPauseMeta = (data: VendorData) => {
  const pause = data?.pause ?? data?.profile?.pause ?? {};
  const explicitPauseCandidates = [
    data?.isPaused,
    data?.paused,
    data?.profile?.isPaused,
    data?.profile?.paused,
    pause?.isPaused,
    pause?.paused,
  ];

  let explicitPaused: boolean | undefined;
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

export const isVendorPauseRequested = (data: VendorData): boolean => {
  if (!data || typeof data !== "object") return false;
  const meta = getPauseMeta(data);
  if (meta.hasResumedMarker) return false;
  if (meta.hasApprovedMarker) return false;
  return meta.requestedActive === true;
};

export const isVendorPaused = (data: VendorData): boolean => {
  if (!data || typeof data !== "object") return false;
  const meta = getPauseMeta(data);
  if (meta.hasResumedMarker) return false;
  if (meta.hasApprovedMarker) return true;
  if (meta.explicitPaused === true && meta.requestedActive !== true) return true;
  return false;
};

export const isVendorStatus = (value: unknown): value is VendorStatus =>
  typeof value === "string" &&
  (VENDOR_STATUS_VALUES as readonly string[]).includes(value);

export const normalizeVendorStatus = (value: unknown): VendorStatus | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, "_").toLowerCase();
  if (isVendorStatus(normalized)) return normalized;
  const alias = STATUS_ALIASES[normalized];
  if (alias && isVendorStatus(alias)) return alias;
  return undefined;
};

export const resolveVendorStatus = (
  data: VendorData,
  fallback: VendorStatus | string = "draft"
): VendorStatus | string => {
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

export const getVendorStatusLabel = (status: VendorStatus | string): string =>
  VENDOR_STATUS_LABELS[status as VendorStatus] ?? status ?? "";

const firstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const firstBoolean = (...values: unknown[]): boolean | undefined => {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return undefined;
};

const hasDeletedMarker = (data: VendorData): boolean =>
  Boolean(
    data?.deletedAt ||
      data?.archivedAt ||
      data?.deletedBy ||
      data?.deletedByUid ||
      data?.deletedByEmail
  );

export const getVendorBlockedReason = (data: VendorData): string =>
  firstNonEmptyString(
    data?.blockedReason,
    data?.profile?.blockedReason,
    data?.company?.blockedReason,
    data?.vendor?.blockedReason
  );

export const getVendorDeletedReason = (data: VendorData): string =>
  firstNonEmptyString(data?.deleteReason, data?.deletedReason, data?.reason);

export const resolveVendorAccountState = (
  vendorData: VendorData,
  deletedVendorData: VendorData
): AccountState => {
  if (deletedVendorData && typeof deletedVendorData === "object") {
    return {
      key: "deleted",
      label: "Supprimé",
      description: "Ce vendeur est archivé dans deletedVendors.",
      reason: getVendorDeletedReason(deletedVendorData),
      deletedAt: deletedVendorData.deletedAt || deletedVendorData.archivedAt || null,
      requiresPayoutReview: true,
    };
  }

  if (!vendorData || typeof vendorData !== "object") {
    return {
      key: "missing",
      label: "Introuvable",
      description: "Aucun document vendeur actif n'a été trouvé.",
      reason: "",
      deletedAt: null,
      requiresPayoutReview: true,
    };
  }

  if (hasDeletedMarker(vendorData)) {
    return {
      key: "deleted",
      label: "Supprimé",
      description: "Ce vendeur porte des marqueurs de suppression.",
      reason: getVendorDeletedReason(vendorData),
      deletedAt: vendorData.deletedAt || vendorData.archivedAt || null,
      requiresPayoutReview: true,
    };
  }

  const explicitBlocked = firstBoolean(
    vendorData.blocked,
    vendorData.profile?.blocked,
    vendorData.company?.blocked,
    vendorData.vendor?.blocked
  );
  const explicitActive = firstBoolean(
    vendorData.active,
    vendorData.isActive,
    vendorData.profile?.active,
    vendorData.profile?.isActive,
    vendorData.company?.active,
    vendorData.vendor?.active
  );
  const explicitStatus = [
    vendorData.status,
    vendorData.vendorStatus,
    vendorData?.profile?.status,
    vendorData?.company?.status,
    vendorData?.vendor?.status,
  ]
    .map(normalizeVendorStatus)
    .find(Boolean);
  const status = explicitStatus || (isVendorPaused(vendorData) ? "paused" : undefined);

  if (explicitBlocked === true || status === "blocked") {
    return {
      key: "blocked",
      label: "Bloqué",
      description: "Ce vendeur est bloqué.",
      reason: getVendorBlockedReason(vendorData),
      deletedAt: null,
      requiresPayoutReview: true,
    };
  }

  if (!status && explicitActive === false) {
    return {
      key: "review",
      label: "Inactif",
      description: "Ce vendeur est marqué inactif.",
      reason: "",
      deletedAt: null,
      requiresPayoutReview: true,
    };
  }

  if (!status || status === "approved") {
    return {
      key: "active",
      label: "Actif",
      description: "Compte vendeur actif.",
      reason: "",
      deletedAt: null,
      requiresPayoutReview: false,
    };
  }

  return {
    key: status || "review",
    label: getVendorStatusLabel(status) || "À vérifier",
    description: "Ce vendeur n'est pas au statut approuvé.",
    reason: "",
    deletedAt: null,
    requiresPayoutReview: true,
  };
};
