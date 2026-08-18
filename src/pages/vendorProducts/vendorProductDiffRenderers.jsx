// Rendu JSX des valeurs comparees dans le diff brouillon vs publie de
// VendorProductDetails.jsx. Fonctions pures (aucune fermeture sur l'etat du
// composant), extraites telles quelles.
import DiffImagePreview from "./DiffImagePreview";
import { getDisplayValue, getFieldLabel, isLikelyImageUrl } from "./vendorProductDetailsHelpers";

export const renderChangeValue = (value, path = "") => {
  const renderEmpty = () => (
    <span className="vendorProductDetails__draftValue vendorProductDetails__draftValue--empty">
      -
    </span>
  );

  if (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return renderEmpty();
  }

  if (typeof value === "boolean") {
    return (
      <span className="vendorProductDetails__draftValue">
        {value ? "Oui" : "Non"}
      </span>
    );
  }

  if (typeof value === "number") {
    return (
      <span className="vendorProductDetails__draftValue">
        {value}
      </span>
    );
  }

  if (typeof value === "string") {
    if (isLikelyImageUrl(value, path)) {
      return (
        <div className="vendorProductDetails__diffImages">
          <DiffImagePreview src={value} label="Image" />
        </div>
      );
    }
    if (/^https?:\/\//i.test(value.trim())) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="vendorProductDetails__draftLink"
        >
          {value}
        </a>
      );
    }
    return (
      <span className="vendorProductDetails__draftValue">
        {getDisplayValue(value)}
      </span>
    );
  }

  if (Array.isArray(value)) {
    const cleaned = value.filter(
      (entry) =>
        entry !== undefined &&
        entry !== null &&
        !(typeof entry === "string" && entry.trim() === "")
    );
    if (!cleaned.length) return renderEmpty();

    if (
      cleaned.every(
        (entry) =>
          typeof entry === "string" && isLikelyImageUrl(entry, path || "gallery")
      )
    ) {
      return (
        <div className="vendorProductDetails__diffImages">
          {cleaned.map((url, index) => (
            <DiffImagePreview
              key={`${url}-${index}`}
              src={url}
              label={`Image ${index + 1}`}
            />
          ))}
        </div>
      );
    }

    return (
      <ul className="vendorProductDetails__diffList vendorProductDetails__diffList--bullets">
        {cleaned.map((entry, index) => (
          <li key={`${path}-${index}`}>
            {renderChangeValue(entry, `${path || ""}[${index}]`)}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) return renderEmpty();
    return (
      <dl className="vendorProductDetails__diffDefinition">
        {entries.map(([key, val]) => {
          const childPath = path ? `${path}.${key}` : key;
          return (
            <div
              key={childPath}
              className="vendorProductDetails__diffDefinitionRow"
            >
              <dt>{getFieldLabel(childPath)}</dt>
              <dd>{renderChangeValue(val, childPath)}</dd>
            </div>
          );
        })}
      </dl>
    );
  }

  return renderEmpty();
};

export const renderAttributeValue = (value) => {
  if (value === undefined || value === null) return "-";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (Array.isArray(value)) {
    const cleaned = value
      .filter((v) => v !== undefined && v !== null && String(v).trim() !== "")
      .map((v) => (typeof v === "boolean" ? (v ? "Oui" : "Non") : v));
    return cleaned.length ? cleaned.join(", ") : "-";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (err) {
      return "-";
    }
  }
  return String(value);
};
