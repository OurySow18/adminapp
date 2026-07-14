export const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value?.seconds === "number") {
    return value.seconds * 1000;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

export const formatNumber = (value) =>
  new Intl.NumberFormat("fr-FR").format(toNumber(value));

export const formatCurrency = (value, currency = "GNF") =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  }).format(toNumber(value));

export const formatDateTime = (value) => {
  const millis = toMillis(value);
  if (!millis) return "—";
  return new Date(millis).toLocaleString("fr-FR");
};

export const pickVendorName = (data, fallback = "Vendeur") => {
  const candidates = [
    data?.vendorName,
    data?.displayName,
    data?.profile?.displayName,
    data?.profile?.company?.name,
    data?.company?.name,
    data?.companyName,
    data?.name,
    data?.label,
    data?.vendorId,
    data?.id,
  ];
  const hit = candidates.find(
    (value) => typeof value === "string" && value.trim()
  );
  return hit ? hit.trim() : fallback;
};
