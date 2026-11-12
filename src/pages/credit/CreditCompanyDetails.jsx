import "./credit.scss";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ConfirmModal from "../../components/modal/ConfirmModal";
import FeedbackPopup from "../../components/feedbackPopup/FeedbackPopup";
import { db } from "../../firebase";
import { formatGNF } from "./creditFormat";
import {
  COMPANIES_COLLECTION,
  COMPANY_ADMINS_COLLECTION,
  COMPANY_MEMBERS_COLLECTION,
  loadCompanyAdmins,
  loadCompanyMembers,
} from "../../utils/creditRepository";

const PLAN_OPTIONS = [
  { value: "end_of_month", label: "Fin de mois" },
  { value: "three_months", label: "3 mois" },
];

const emptyForm = {
  name: "",
  globalLimit: "",
  cutoffDay: "20",
  defaultMemberLimit: "",
  plans: ["end_of_month"],
  contactName: "",
  contactPhone: "",
  contactEmail: "",
};

const CreditCompanyDetails = () => {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const isNew = companyId === "new";

  const [company, setCompany] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [members, setMembers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [feedback, setFeedback] = useState({ open: false, type: "success", message: "" });

  const [memberTarget, setMemberTarget] = useState(null);
  const [memberLimit, setMemberLimit] = useState("");
  const [memberStatus, setMemberStatus] = useState("active");

  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminUid, setAdminUid] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminError, setAdminError] = useState("");

  const loadAll = async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const [companySnap, membersData, adminsData] = await Promise.all([
        getDoc(doc(db, COMPANIES_COLLECTION, companyId)),
        loadCompanyMembers(companyId),
        loadCompanyAdmins(companyId),
      ]);
      if (companySnap.exists()) {
        const data = { id: companySnap.id, ...companySnap.data() };
        setCompany(data);
        setForm({
          name: data.name || "",
          globalLimit: String(data.globalLimit ?? ""),
          cutoffDay: String(data.cutoffDay ?? 20),
          defaultMemberLimit: String(data.defaultMemberLimit ?? ""),
          plans: Array.isArray(data.plans) ? data.plans : ["end_of_month"],
          contactName: data.contact?.name || "",
          contactPhone: data.contact?.phone || "",
          contactEmail: data.contact?.email || "",
        });
      }
      setMembers(membersData);
      setAdmins(adminsData);
    } catch (err) {
      console.error("Failed to load company:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const togglePlan = (plan) => {
    setForm((prev) => ({
      ...prev,
      plans: prev.plans.includes(plan)
        ? prev.plans.filter((p) => p !== plan)
        : [...prev.plans, plan],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError("Le nom est obligatoire.");
      return;
    }
    if (!form.plans.length) {
      setFormError("Choisissez au moins une formule.");
      return;
    }
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        currency: "GNF",
        globalLimit: Number(form.globalLimit) || 0,
        plans: form.plans,
        cutoffDay: Math.min(28, Math.max(1, Number(form.cutoffDay) || 20)),
        defaultMemberLimit: Number(form.defaultMemberLimit) || 0,
        contact: {
          name: form.contactName.trim(),
          phone: form.contactPhone.trim(),
          email: form.contactEmail.trim(),
        },
        updatedAt: serverTimestamp(),
      };
      if (isNew) {
        const ref = await addDoc(collection(db, COMPANIES_COLLECTION), {
          ...payload,
          status: "active",
          outstanding: 0,
          createdAt: serverTimestamp(),
        });
        setFeedback({ open: true, type: "success", message: "Entreprise créée." });
        navigate(`/admin/credit/entreprises/${ref.id}`, { replace: true });
      } else {
        await updateDoc(doc(db, COMPANIES_COLLECTION, companyId), payload);
        setFeedback({ open: true, type: "success", message: "Entreprise mise à jour." });
        await loadAll();
      }
    } catch (err) {
      console.error("Erreur enregistrement entreprise:", err);
      setFormError(err?.message || "Impossible d'enregistrer.");
    } finally {
      setSaving(false);
    }
  };

  const toggleCompanyStatus = async () => {
    if (!company) return;
    const nextStatus = company.status === "active" ? "suspended" : "active";
    try {
      await updateDoc(doc(db, COMPANIES_COLLECTION, companyId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      setFeedback({
        open: true,
        type: "success",
        message: nextStatus === "active" ? "Entreprise réactivée." : "Entreprise suspendue.",
      });
      await loadAll();
    } catch (err) {
      setFeedback({ open: true, type: "error", message: err?.message || "Action impossible." });
    }
  };

  const openMemberModal = (member) => {
    setMemberTarget(member);
    setMemberLimit(String(member.creditLimit ?? ""));
    setMemberStatus(member.status || "active");
  };

  const handleSaveMember = async () => {
    try {
      await updateDoc(doc(db, COMPANY_MEMBERS_COLLECTION, memberTarget.id), {
        // Entier : le portail correspondant devra satisfaire creditLimit is int.
        creditLimit: Math.round(Number(memberLimit) || 0),
        status: memberStatus,
        updatedAt: serverTimestamp(),
      });
      setMemberTarget(null);
      setFeedback({ open: true, type: "success", message: "Employé mis à jour." });
      await loadAll();
    } catch (err) {
      setFeedback({ open: true, type: "error", message: err?.message || "Action impossible." });
    }
  };

  const handleAddAdmin = async () => {
    if (!adminUid.trim() || !adminEmail.trim()) {
      setAdminError("L'uid et l'e-mail sont obligatoires.");
      return;
    }
    try {
      await setDoc(doc(db, COMPANY_ADMINS_COLLECTION, adminUid.trim()), {
        companyId,
        name: adminName.trim(),
        email: adminEmail.trim(),
        phone: adminPhone.trim(),
        status: "active",
        createdAt: serverTimestamp(),
      });
      setAdminModalOpen(false);
      setAdminUid("");
      setAdminName("");
      setAdminEmail("");
      setAdminPhone("");
      setFeedback({ open: true, type: "success", message: "Correspondant ajouté." });
      await loadAll();
    } catch (err) {
      setAdminError(err?.message || "Impossible d'ajouter ce correspondant.");
    }
  };

  const toggleAdminStatus = async (admin) => {
    try {
      await updateDoc(doc(db, COMPANY_ADMINS_COLLECTION, admin.id), {
        status: admin.status === "active" ? "disabled" : "active",
      });
      await loadAll();
    } catch (err) {
      setFeedback({ open: true, type: "error", message: err?.message || "Action impossible." });
    }
  };

  const remainingLimit = useMemo(() => {
    if (!company) return null;
    return Math.max(0, (company.globalLimit || 0) - (company.outstanding || 0));
  }, [company]);

  if (loading) {
    return (
      <div className="credit">
        <Sidebar />
        <main className="credit__container">
          <Navbar />
          <p className="credit__empty">Chargement...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="credit">
      <Sidebar />
      <main className="credit__container">
        <Navbar />
        <Link to="/admin/credit/entreprises" className="credit__back">
          ← Entreprises
        </Link>
        <header className="credit__header">
          <div>
            <h1>{isNew ? "Nouvelle entreprise" : company?.name}</h1>
            {!isNew && company && (
              <p>
                Encours {formatGNF(company.outstanding)} / {formatGNF(company.globalLimit)} — plafond
                restant {formatGNF(remainingLimit)}
              </p>
            )}
          </div>
          {!isNew && company && (
            <div className="credit__actions">
              <button type="button" className="credit__button" onClick={toggleCompanyStatus}>
                {company.status === "active" ? "Suspendre" : "Réactiver"}
              </button>
            </div>
          )}
        </header>

        <section className="credit__panel">
          <h2>Informations</h2>
          <div className="credit__filterBar" style={{ marginBottom: 0 }}>
            <div className="credit__field">
              <label htmlFor="company-name">Nom</label>
              <input
                id="company-name"
                type="text"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="credit__field credit__field--narrow">
              <label htmlFor="company-limit">Plafond global (GNF)</label>
              <input
                id="company-limit"
                type="number"
                value={form.globalLimit}
                onChange={(event) => setForm((prev) => ({ ...prev, globalLimit: event.target.value }))}
              />
            </div>
            <div className="credit__field credit__field--narrow">
              <label htmlFor="company-member-limit">Plafond employé par défaut (GNF)</label>
              <input
                id="company-member-limit"
                type="number"
                value={form.defaultMemberLimit}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, defaultMemberLimit: event.target.value }))
                }
              />
            </div>
            <div className="credit__field credit__field--narrow">
              <label htmlFor="company-cutoff">Jour d'échéance (1-28)</label>
              <input
                id="company-cutoff"
                type="number"
                min={1}
                max={28}
                value={form.cutoffDay}
                onChange={(event) => setForm((prev) => ({ ...prev, cutoffDay: event.target.value }))}
              />
            </div>
            <div className="credit__field">
              <label>Formules autorisées</label>
              <div style={{ display: "flex", gap: 10, paddingTop: 6 }}>
                {PLAN_OPTIONS.map((plan) => (
                  <label key={plan.value} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input
                      type="checkbox"
                      checked={form.plans.includes(plan.value)}
                      onChange={() => togglePlan(plan.value)}
                    />
                    {plan.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="credit__field">
              <label htmlFor="company-contact-name">Correspondant - nom</label>
              <input
                id="company-contact-name"
                type="text"
                value={form.contactName}
                onChange={(event) => setForm((prev) => ({ ...prev, contactName: event.target.value }))}
              />
            </div>
            <div className="credit__field">
              <label htmlFor="company-contact-phone">Correspondant - téléphone</label>
              <input
                id="company-contact-phone"
                type="text"
                value={form.contactPhone}
                onChange={(event) => setForm((prev) => ({ ...prev, contactPhone: event.target.value }))}
              />
            </div>
            <div className="credit__field">
              <label htmlFor="company-contact-email">Correspondant - e-mail</label>
              <input
                id="company-contact-email"
                type="email"
                value={form.contactEmail}
                onChange={(event) => setForm((prev) => ({ ...prev, contactEmail: event.target.value }))}
              />
            </div>
          </div>
          {formError && <p className="workModal__error" style={{ marginTop: 10 }}>{formError}</p>}
          <div className="credit__actions" style={{ marginTop: 14 }}>
            <button
              type="button"
              className="credit__button credit__button--primary"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </section>

        {!isNew && (
          <>
            <section className="credit__panel">
              <h2>Employés rattachés</h2>
              {!members.length && <p className="credit__empty">Aucun employé rattaché.</p>}
              {members.length > 0 && (
                <table className="credit__table">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Plafond</th>
                      <th>Encours</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id}>
                        <td>{member.name}</td>
                        <td>{formatGNF(member.creditLimit)}</td>
                        <td>{formatGNF(member.outstanding)}</td>
                        <td>
                          <span
                            className={`credit__pill ${
                              member.status === "active" ? "credit__pill--active" : "credit__pill--rejected"
                            }`}
                          >
                            {member.status}
                          </span>
                        </td>
                        <td>
                          <button type="button" className="credit__button" onClick={() => openMemberModal(member)}>
                            Modifier
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="credit__panel">
              <h2>Correspondants</h2>
              <p className="credit__muted">
                Le compte de connexion (Firebase Authentication) se crée pour l'instant à la main
                dans la console. Renseignez ensuite son uid ici pour créer son accès au portail.
              </p>
              {admins.length > 0 && (
                <table className="credit__table">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>E-mail</th>
                      <th>Téléphone</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((companyAdmin) => (
                      <tr key={companyAdmin.id}>
                        <td>{companyAdmin.name}</td>
                        <td>{companyAdmin.email}</td>
                        <td>{companyAdmin.phone}</td>
                        <td>{companyAdmin.status === "active" ? "Actif" : "Désactivé"}</td>
                        <td>
                          <button
                            type="button"
                            className="credit__button"
                            onClick={() => toggleAdminStatus(companyAdmin)}
                          >
                            {companyAdmin.status === "active" ? "Désactiver" : "Réactiver"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="credit__actions" style={{ marginTop: 12 }}>
                <button type="button" className="credit__button" onClick={() => setAdminModalOpen(true)}>
                  Ajouter un correspondant
                </button>
              </div>
            </section>
          </>
        )}

        <ConfirmModal
          open={Boolean(memberTarget)}
          title="Modifier l'employé"
          onClose={() => setMemberTarget(null)}
          onConfirm={handleSaveMember}
          confirmText="Enregistrer"
        >
          <div className="workModal__field">
            <label htmlFor="member-limit">Plafond (GNF)</label>
            <input
              id="member-limit"
              type="number"
              value={memberLimit}
              onChange={(event) => setMemberLimit(event.target.value)}
            />
          </div>
          <div className="workModal__field">
            <label htmlFor="member-status">Statut</label>
            <select id="member-status" value={memberStatus} onChange={(event) => setMemberStatus(event.target.value)}>
              <option value="active">Actif</option>
              <option value="suspended">Suspendu</option>
              <option value="left">Parti</option>
            </select>
          </div>
        </ConfirmModal>

        <ConfirmModal
          open={adminModalOpen}
          title="Ajouter un correspondant"
          onClose={() => setAdminModalOpen(false)}
          onConfirm={handleAddAdmin}
          confirmText="Ajouter"
        >
          <div className="workModal__field">
            <label htmlFor="admin-uid">UID Firebase Authentication</label>
            <input id="admin-uid" type="text" value={adminUid} onChange={(event) => setAdminUid(event.target.value)} />
          </div>
          <div className="workModal__field">
            <label htmlFor="admin-name">Nom</label>
            <input id="admin-name" type="text" value={adminName} onChange={(event) => setAdminName(event.target.value)} />
          </div>
          <div className="workModal__field">
            <label htmlFor="admin-email">E-mail</label>
            <input id="admin-email" type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} />
          </div>
          <div className="workModal__field">
            <label htmlFor="admin-phone">Téléphone</label>
            <input id="admin-phone" type="text" value={adminPhone} onChange={(event) => setAdminPhone(event.target.value)} />
          </div>
          {adminError && <p className="workModal__error">{adminError}</p>}
        </ConfirmModal>

        <FeedbackPopup
          open={feedback.open}
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback((prev) => ({ ...prev, open: false }))}
        />
      </main>
    </div>
  );
};

export default CreditCompanyDetails;
