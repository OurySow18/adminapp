// Sections d'informations en lecture seule du dossier vendeur : entreprise,
// contact, statut, resume, informations legales, ops/livraison, food,
// consentements, documents requis. Extrait de VendorDetails.jsx.
const REQUIRED_DOC_LABELS = {
  repId: "Pièce d'identité du représentant",
  gewerbe: "Enregistrement commerce",
  handelsregister: "Extrait registre de commerce",
  ifsg: "Certificat IFSG",
  haccp: "Plan HACCP",
  liability: "Assurance responsabilité civile",
  foodRegistration: "Enregistrement établissement alimentaire",
};

const CONSENT_LABELS = {
  acceptPrivacy: "Politique de confidentialité",
  contactConsent: "Consentement de contact",
  attestTrue: "Déclaration sur l'honneur",
  acceptTos: "Conditions d'utilisation",
};

const formatConsentLabel = (key) =>
  CONSENT_LABELS[key] ||
  String(key || "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim() ||
  "-";

const VendorProfileSections = ({
  company,
  profile,
  vendor,
  statusHistory,
  stats,
  legal,
  bank,
  opsDetails,
  food,
  consent,
  requiredDocs,
  vendorStatus,
}) => {
  return (
    <>
      <section>
        <h2>Informations générales</h2>
        <div className="vendorDetails__grid vendorDetails__grid--two">
          <div>
            <h3>Entreprise</h3>
            <ul>
              <li>
                <strong>Nom :</strong> {company?.name ?? "-"}
              </li>
              <li>
                <strong>Forme juridique :</strong>{" "}
                {company?.legalForm ?? profile?.legalForm ?? "-"}
              </li>
              <li>
                <strong>Adresse :</strong> {company?.address ?? "-"}
              </li>
              <li>
                <strong>Code postal :</strong> {company?.zip ?? "-"}
              </li>
              <li>
                <strong>Ville :</strong> {company?.city ?? "-"}
              </li>
              <li>
                <strong>Pays :</strong> {company?.country ?? "-"}
              </li>
            </ul>
          </div>
          <div>
            <h3>Contact</h3>
            <ul>
              <li>
                <strong>Représentant :</strong>{" "}
                {company?.representative ?? "-"}
              </li>
              <li>
                <strong>Email :</strong> {company?.email ?? vendor?.email ?? "-"}
              </li>
              <li>
                <strong>Téléphone :</strong> {company?.phone ?? vendor?.phone ?? "-"}
              </li>
              <li>
                <strong>Site web :</strong>{" "}
                {company?.website ? (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {company.website}
                  </a>
                ) : (
                  "-"
                )}
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h2>Statut du dossier</h2>
        <div className="vendorDetails__grid vendorDetails__grid--four">
          {statusHistory.map((item) => (
            <div key={item.label} className="vendorDetails__stat">
              <span className="vendorDetails__statLabel">{item.label}</span>
              <span className="vendorDetails__statValue">{item.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Résumé</h2>
        <div className="vendorDetails__grid vendorDetails__grid--four">
          {stats.map((item) => (
            <div key={item.label} className="vendorDetails__stat">
              <span className="vendorDetails__statLabel">{item.label}</span>
              <span className="vendorDetails__statValue">{item.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Informations légales</h2>
        <div className="vendorDetails__grid vendorDetails__grid--three">
          <div className="vendorDetails__card">
            <h3>Immatriculation</h3>
            <ul>
              <li>
                <strong>Numéro fiscal :</strong>{" "}
                {legal?.steuernummer ?? vendor?.steuernummer ?? "-"}
              </li>
              <li>
                <strong>Numéro TVA :</strong> {legal?.ustIdNr ?? "-"}
              </li>
              <li>
                <strong>Micro-entreprise :</strong>{" "}
                {legal?.kleinunternehmer ? "Oui" : "Non"}
              </li>
            </ul>
          </div>
          <div className="vendorDetails__card">
            <h3>Documents légaux</h3>
            <ul>
              <li>
                <strong>Mentions légales :</strong>{" "}
                {legal?.impressumUrl ? (
                  <a
                    href={legal.impressumUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Consulter
                  </a>
                ) : (
                  "-"
                )}
              </li>
              <li>
                <strong>CGV :</strong>{" "}
                {legal?.cgvUrl ? (
                  <a href={legal.cgvUrl} target="_blank" rel="noreferrer">
                    Consulter
                  </a>
                ) : (
                  "-"
                )}
              </li>
              <li>
                <strong>Droit de rétractation :</strong>{" "}
                {legal?.widerrufUrl ? (
                  <a
                    href={legal.widerrufUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Consulter
                  </a>
                ) : (
                  "-"
                )}
              </li>
            </ul>
          </div>
          <div className="vendorDetails__card">
            <h3>Paiements</h3>
            <ul>
              <li>
                <strong>IBAN :</strong> {bank?.iban ?? "-"}
              </li>
              <li>
                <strong>Orange Money :</strong> {bank?.orangeMoney ?? "-"}
              </li>
              <li>
                <strong>Code marchand :</strong> {bank?.merchantCode ?? "-"}
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h2>Activité & opérations</h2>
        <div className="vendorDetails__grid vendorDetails__grid--two">
          <div className="vendorDetails__card">
            <h3>Ops, livraison & retrait</h3>
            {opsDetails.length > 0 ? (
              <ul>
                {opsDetails.map((item) => (
                  <li key={item.key}>
                    <strong>{item.label} :</strong>{" "}
                    <span style={{ whiteSpace: "pre-line" }}>{item.value}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Aucune donnée ops enregistrée.</p>
            )}
          </div>
          <div className="vendorDetails__card">
            <h3>Food & conformité</h3>
            <ul>
              <li>
                <strong>Activité alimentaire :</strong>{" "}
                {food?.isFoodBusiness ? "Oui" : "Non"}
              </li>
              <li>
                <strong>Chaîne du froid :</strong>{" "}
                {food?.coldChain ? "Oui" : "Non"}
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h2>Consentements</h2>
        <div className="vendorDetails__card">
          {consent && Object.keys(consent).length > 0 ? (
            <ul>
              {Object.entries(consent).map(([key, value]) => (
                <li key={key}>
                  <strong>{formatConsentLabel(key)} :</strong>{" "}
                  {value ? "Oui" : "Non"}
                </li>
              ))}
            </ul>
          ) : (
            <p>Aucun consentement enregistré.</p>
          )}
        </div>
      </section>

      <section>
        <h2>Documents requis</h2>
        <div className="vendorDetails__card">
          {requiredDocs.length > 0 ? (
            <div className="vendorDetails__docsGrid">
              {requiredDocs.map((docKey) => {
                const label = REQUIRED_DOC_LABELS[docKey] || docKey;
                const delivered = Boolean(
                  profile?.deliveredDocs?.[docKey] ?? vendor?.deliveredDocs?.[docKey]
                );
                return (
                  <label
                    key={docKey}
                    className={`vendorDetails__docItem ${
                      delivered ? "vendorDetails__docItem--delivered" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={delivered}
                      readOnly
                      disabled
                    />
                    <span className="vendorDetails__docLabel">{label}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p>Aucun document supplémentaire requis.</p>
          )}
        </div>
      </section>

      <section>
        <h2>Informations générales</h2>
        <div className="vendorDetails__infoGrid--highlight">
          <div className="vendorDetails__infoChip">
            <span>Statut vendeur</span>
            <span>{vendorStatus}</span>
          </div>
          <div className="vendorDetails__infoChip">
            <span>Email</span>
            <span>{company?.email ?? vendor?.email ?? "-"}</span>
          </div>
          <div className="vendorDetails__infoChip">
            <span>Téléphone</span>
            <span>{company?.phone ?? vendor?.phone ?? "-"}</span>
          </div>
          <div className="vendorDetails__infoChip">
            <span>Ville</span>
            <span>{company?.city ?? vendor?.city ?? "-"}</span>
          </div>
          <div className="vendorDetails__infoChip">
            <span>Pays</span>
            <span>{company?.country ?? vendor?.country ?? "-"}</span>
          </div>
        </div>
      </section>
    </>
  );
};

export default VendorProfileSections;
