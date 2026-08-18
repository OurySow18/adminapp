// Vignette d'apercu d'image utilisee dans le rendu des differences
// brouillon vs publie sur VendorProductDetails.jsx.
import { useState } from "react";

const DiffImagePreview = ({ src, label }) => {
  const [dimensions, setDimensions] = useState(null);
  const [error, setError] = useState(false);

  const handleLoad = (event) => {
    setDimensions({
      width: event.currentTarget.naturalWidth,
      height: event.currentTarget.naturalHeight,
    });
  };

  const handleError = () => {
    setError(true);
  };

  return (
    <figure className="vendorProductDetails__diffImage">
      <img
        src={src}
        alt={label || "Apercu du media"}
        onLoad={handleLoad}
        onError={handleError}
      />
      <figcaption>
        {label && <strong>{label}</strong>}
        <span>
          {error
            ? "Impossible de charger l'image"
            : dimensions
            ? `${dimensions.width}  ${dimensions.height} px`
            : "Taille en cours de chargement"}
        </span>
      </figcaption>
    </figure>
  );
};

export default DiffImagePreview;
