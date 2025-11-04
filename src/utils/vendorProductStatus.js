export const VENDOR_PRODUCT_STATUS_VALUES = [
  "draft",
  "pending",
  "published",
  "blocked",
  "unknown",
];

const STATUS_ALIASES = {
  submitted: "pending",
  submit: "pending",
  awaiting_validation: "pending",
  awaiting_approval: "pending",
  awaiting_review: "pending",
  pending_review: "pending",
  in_review: "pending",
  review: "pending",
  waiting: "pending",
  review_pending: "pending",
  pending_validation: "pending",
  validation_pending: "pending",
  approved: "published",
  approve: "published",
  active: "published",
  activated: "published",
  published: "published",
  enabled: "published",
  live: "published",
  visible: "published",
  online: "published",
  valid: "published",
  validated: "published",
  blocked: "blocked",
  disabled: "blocked",
  inactive: "blocked",
  rejected: "blocked",
  refused: "blocked",
  declined: "blocked",
  banned: "blocked",
  suspended: "blocked",
  removed: "blocked",
  archived: "blocked",
  archive: "blocked",
  deleted: "blocked",
  hidden: "blocked",
  draft_version: "draft",
  drafting: "draft",
  draft_pending: "draft",
  staging: "draft",
  sandbox: "draft",
};

const toCandidate = (value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\s+/g, "_").toLowerCase();
};

export const isVendorProductStatus = (value) =>
  typeof value === "string" && VENDOR_PRODUCT_STATUS_VALUES.includes(value);

export const normalizeVendorProductStatus = (value) => {
  const candidate = toCandidate(value);
  if (!candidate) return undefined;
  if (isVendorProductStatus(candidate)) return candidate;
  const alias = STATUS_ALIASES[candidate];
  if (alias && isVendorProductStatus(alias)) return alias;
  return undefined;
};

const pathIncludes = (segments, target) =>
  Array.isArray(segments) &&
  segments.some((segment) => segment?.toLowerCase?.() === target);

export const resolveVendorProductActiveFlag = (data, context = {}) => {
  if (!data || typeof data !== "object") return undefined;

  const {
    pathSegments = [],
    source,
    publicStatusFlag,
    publicMmStatusFlag,
  } = context ?? {};

  const isPublicSource =
    source === "public" || pathIncludes(pathSegments, "products_public");

  if (!isPublicSource) {
    return false;
  }

  if (
    typeof publicStatusFlag === "boolean" ||
    typeof publicMmStatusFlag === "boolean"
  ) {
    return publicStatusFlag === true && publicMmStatusFlag === true;
  }

  const candidates = [
    data.active,
    data.isActive,
    data?.core?.active,
    data?.core?.isActive,
    data?.draft?.core?.active,
    data?.draft?.core?.isActive,
  ];

  for (const value of candidates) {
    if (typeof value === "boolean") return value;
  }

  const blockedCandidates = [
    data.blocked,
    data.isBlocked,
    data?.core?.blocked,
    data?.core?.isBlocked,
    data?.draft?.core?.blocked,
    data?.draft?.core?.isBlocked,
  ];

  for (const value of blockedCandidates) {
    if (typeof value === "boolean") return !value;
  }

  return undefined;
};

export const resolveVendorProductStatus = (
  data,
  fallback = "unknown",
  context = {}
) => {
  if (!data || typeof data !== "object") return fallback;

  const {
    pathSegments = [],
    active,
    source,
    publicActive,
    publicStatusFlag,
    publicMmStatusFlag,
  } = context ?? {};

  const isPublicSource =
    source === "public" || pathIncludes(pathSegments, "products_public");
  const derivedPublicActive =
    typeof publicActive === "boolean"
      ? publicActive
      : publicStatusFlag === true && publicMmStatusFlag === true;

  const statusCandidates = [
    data.status,
    data.productStatus,
    data.lifecycleStatus,
    data.lifecycle?.status,
    data.workflowStatus,
    data.workflow?.status,
    data.state,
    data?.core?.status,
    data?.draft?.status,
    data?.draft?.core?.status,
  ];

  for (const candidate of statusCandidates) {
    const normalized = normalizeVendorProductStatus(candidate);
    if (normalized) {
      if (normalized === "published") {
        if (!isPublicSource) {
          return "blocked";
        }
        if (!derivedPublicActive) {
          return "blocked";
        }
      }
      return normalized;
    }
  }

  if (isPublicSource) {
    if (derivedPublicActive) {
      return "published";
    }
    if (
      publicStatusFlag === false ||
      publicMmStatusFlag === false ||
      derivedPublicActive === false
    ) {
      return "blocked";
    }
  }

  if (
    Array.isArray(pathSegments) &&
    pathSegments.some((segment) =>
      ["drafts", "draft", "staging"].includes(segment?.toLowerCase?.())
    )
  ) {
    return "draft";
  }

  const activeFlag =
    typeof active === "boolean"
      ? active
      : resolveVendorProductActiveFlag(data, {
          pathSegments,
          source,
          publicStatusFlag,
          publicMmStatusFlag,
        });
  if (typeof activeFlag === "boolean") {
    return activeFlag ? "published" : "blocked";
  }

  return fallback;
};

export const getVendorProductStatusLabel = (status) => {
  switch (status) {
    case "draft":
      return "Brouillons";
    case "pending":
      return "En attente";
    case "published":
      return "Actifs";
    case "blocked":
      return "Bloqués";
    case "unknown":
      return "Indéterminés";
    default:
      return status ?? "";
  }
};
