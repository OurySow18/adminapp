// Actions d'administration sur un vendeur (approuver, bloquer, debloquer,
// mettre en pause, reprendre, archiver+supprimer, statut partenaire) et sur
// ses produits (bloquer/reactiver un produit ou tous les produits), plus le
// systeme de dialogue de confirmation qui les declenche. Extrait de
// VendorDetails.jsx tel quel : chaque handler fait de vraies ecritures
// Firestore et envoie de vrais emails, aucune logique n'a ete modifiee lors
// du deplacement.
import { useCallback, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteField,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../../firebase";
import { ensureUniqueVendorSlug } from "../../utils/slugUtils";
import {
  BLOCKED_VENDOR_NOTIFY_EMAIL,
  buildArchivedDocId,
  getPrimaryProductDocRef,
  getProductLabel,
  sanitizeForFirestore,
} from "./vendorDetailsHelpers";

export const useVendorActions = ({
  id,
  vendor,
  company,
  navigate,
  isProtectedVendor,
  isBlocked,
  isApproved,
  isPaused,
  isPauseRequested,
  vendorIdentifiers,
  products,
  blockedProducts,
  fetchProductsForVendor,
  blockProductsForVendor,
  reactivateProductsForVendor,
  pauseProductsForVendor,
  restoreProductsAfterPause,
  updatePublicProductsForVendor,
  fetchPublicProductSnapshotsForVendor,
  pausePublicProductsForVendor,
  restorePublicProductsAfterPause,
  fetchVendorProductSnapshotsForDeletion,
  refreshProducts,
  syncLegacyProductDoc,
}) => {
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [dialogReason, setDialogReason] = useState("");
  const [dialogValidationError, setDialogValidationError] = useState("");
  const [approvalLocation, setApprovalLocation] = useState(null);
  const [locationFallback, setLocationFallback] = useState(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [locationMessage, setLocationMessage] = useState(null);

  useEffect(() => {
    setApprovalLocation(null);
    setLocationError(null);
    setLocationMessage(null);
    setFetchingLocation(false);
  }, [id]);

  const handleCaptureLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator?.geolocation) {
      setLocationError(
        "La geolocalisation n'est pas supportee sur cet appareil."
      );
      return;
    }

    setLocationFallback(null);
    setFetchingLocation(true);
    setLocationError(null);
    setLocationMessage(null);

    const onSuccess = (position, message = "Coordonnees recuperees.") => {
      const {
        accuracy,
        altitude,
        altitudeAccuracy,
        heading,
        latitude,
        longitude,
        speed,
      } = position.coords;
      setApprovalLocation({
        latitude,
        longitude,
        accuracy: typeof accuracy === "number" ? accuracy : null,
        altitude: typeof altitude === "number" ? altitude : null,
        altitudeAccuracy:
          typeof altitudeAccuracy === "number" ? altitudeAccuracy : null,
        heading: typeof heading === "number" ? heading : null,
        speed: typeof speed === "number" ? speed : null,
        timestamp: position.timestamp || Date.now(),
      });
      setLocationMessage(message);
      setFetchingLocation(false);
    };

    const finalizeError = (error) => {
      let message = "Impossible de récupérer la position.";
      if (error) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "Autorisez l'acces a la localisation pour continuer.";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "Les informations de localisation sont indisponibles.";
            break;
          case error.TIMEOUT:
            message =
              "La recuperation de la position a expire. Activez la localisation puis reessayez.";
            break;
          default:
            break;
        }
      }
      setFetchingLocation(false);
      setLocationMessage(null);
      setLocationError(message);
    };

    const attemptFallback = () => {
      // Essaye une localisation plus tolérante (moins précise) si la version haute précision échoue.
      navigator.geolocation.getCurrentPosition(
        (position) => onSuccess(position, "Coordonnees recuperees (precision standard)."),
        (fallbackError) => finalizeError(fallbackError),
        {
          enableHighAccuracy: false,
          maximumAge: 300000, // accepte une position cachee jusqu'a 5 minutes
          timeout: 20000, // laisse plus de temps sur reseaux lents
        }
      );
    };

    navigator.geolocation.getCurrentPosition(
      (position) => onSuccess(position),
      (error) => {
        if (
          error &&
          (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE)
        ) {
          attemptFallback();
          return;
        }
        finalizeError(error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  }, []);

  const handleApproveVendor = useCallback(async () => {
    if (!vendor?.id) return false;
    if (!approvalLocation && !locationFallback) {
      setActionError(
        "Veuillez recuperer les coordonnees avant de valider le vendeur."
      );
      return false;
    }
    setActionBusy(true);
    setActionError(null);
    let success = false;

    try {
      const timestamp = serverTimestamp();
      const vendorRef = doc(db, "vendors", vendor.id);
      const updates = {
        status: "approved",
        approved: true,
        vendorStatus: "approved",
        "profile.status": "approved",
        approvedAt: timestamp,
        blocked: false,
        "profile.blocked": false,
        active: true,
        isActive: true,
        "profile.active": true,
        "profile.isActive": true,
        lockCatalog: false,
        lockEdits: false,
        "profile.lockCatalog": false,
        "profile.lockEdits": false,
        blockedAt: deleteField(),
        blockedReason: deleteField(),
        blockedBy: deleteField(),
        blockedByUid: deleteField(),
        updatedAt: timestamp,
        "profile.blockedAt": deleteField(),
        "profile.blockedReason": deleteField(),
        "profile.blockedBy": deleteField(),
        "profile.blockedByUid": deleteField(),
      };

      if (auth.currentUser?.email) {
        updates.approvedBy = auth.currentUser.email;
      }
      if (auth.currentUser?.uid) {
        updates.approvedByUid = auth.currentUser.uid;
      }

      const existingSlugCandidates = [
        vendor?.slug,
        vendor?.profile?.slug,
      ];
      const existingSlug = existingSlugCandidates.find(
        (value) => typeof value === "string" && value.trim()
      );

      if (existingSlug) {
        if (!vendor?.slug) {
          updates.slug = existingSlug.trim();
        }
        if (!vendor?.profile?.slug) {
          updates["profile.slug"] = existingSlug.trim();
        }
      } else {
        const slugSource =
          vendor?.displayName ||
          company?.name ||
          vendor?.name ||
          vendor?.companyName ||
          vendor?.profile?.company?.name ||
          vendor?.profile?.name ||
          vendor?.id;
        const generatedSlug = await ensureUniqueVendorSlug(slugSource, vendor.id);
        if (generatedSlug) {
          updates.slug = generatedSlug;
          updates["profile.slug"] = generatedSlug;
        }
      }

      if (approvalLocation) {
        const locationPayload = {
          latitude: approvalLocation.latitude,
          longitude: approvalLocation.longitude,
        };
        if (typeof approvalLocation.accuracy === "number") {
          locationPayload.accuracy = approvalLocation.accuracy;
        }
        if (typeof approvalLocation.altitude === "number") {
          locationPayload.altitude = approvalLocation.altitude;
        }
        if (typeof approvalLocation.altitudeAccuracy === "number") {
          locationPayload.altitudeAccuracy = approvalLocation.altitudeAccuracy;
        }
        if (typeof approvalLocation.heading === "number") {
          locationPayload.heading = approvalLocation.heading;
        }
        if (typeof approvalLocation.speed === "number") {
          locationPayload.speed = approvalLocation.speed;
        }
        if (approvalLocation.timestamp) {
          locationPayload.capturedAt = approvalLocation.timestamp;
        }
        updates.approvedCoordinates = locationPayload;
      } else if (locationFallback) {
        updates.approvedCoordinatesNote = locationFallback;
      }

      await updateDoc(vendorRef, updates);
      setActionMessage("Le vendeur a ete valide.");
      success = true;
    } catch (err) {
      console.error("Erreur validation vendeur:", err);
      setActionError(
        "Impossible de valider le vendeur pour le moment."
      );
    } finally {
      setActionBusy(false);
    }

    return success;
  }, [vendor, company, approvalLocation, locationFallback]);

  const handleBlockVendor = useCallback(
    async (reason) => {
      if (!vendor?.id) return false;
      if (isProtectedVendor) {
        setActionError(
          "Le compte Monmarche est protege et ne peut pas etre bloque."
        );
        return false;
      }
      setActionBusy(true);
      setActionError(null);
      let success = false;

      try {
        const timestamp = serverTimestamp();
        const vendorRef = doc(db, "vendors", vendor.id);
        const adminEmail = auth.currentUser?.email ?? null;
        const adminUid = auth.currentUser?.uid ?? null;
        const normalizedReason = reason?.trim();
        const vendorEmail =
          company?.email ||
          vendor?.email ||
          vendor?.contactEmail ||
          vendor?.profile?.email ||
          vendor?.profile?.company?.email ||
          vendor?.company?.email ||
          null;
        const preBlockSnapshot = {
          status: vendor?.status ?? vendor?.vendorStatus ?? null,
          vendorStatus: vendor?.vendorStatus ?? vendor?.status ?? null,
          profileStatus: vendor?.profile?.status ?? null,
          active: vendor?.active ?? null,
          isActive: vendor?.isActive ?? null,
          profileActive: vendor?.profile?.active ?? null,
          profileIsActive: vendor?.profile?.isActive ?? null,
          lockCatalog: vendor?.lockCatalog ?? null,
          lockEdits: vendor?.lockEdits ?? null,
          profileLockCatalog: vendor?.profile?.lockCatalog ?? null,
          profileLockEdits: vendor?.profile?.lockEdits ?? null,
        };
        const updates = {
          status: "blocked",
          vendorStatus: "blocked",
          "profile.status": "blocked",
          blocked: true,
          "profile.blocked": true,
          active: false,
          isActive: false,
          lockCatalog: true,
          lockEdits: true,
          blockedAt: timestamp,
          updatedAt: timestamp,
          "profile.blockedAt": timestamp,
          "profile.lockCatalog": true,
          "profile.lockEdits": true,
          "profile.active": false,
          "profile.isActive": false,
          preBlockSnapshot,
        };

        if (adminEmail) {
          updates.blockedBy = adminEmail;
          updates["profile.blockedBy"] = adminEmail;
        } else {
          updates.blockedBy = "admin";
          updates["profile.blockedBy"] = "admin";
        }

        if (adminUid) {
          updates.blockedByUid = adminUid;
          updates["profile.blockedByUid"] = adminUid;
        }

        if (normalizedReason) {
          updates.blockedReason = normalizedReason;
          updates["profile.blockedReason"] = normalizedReason;
        } else {
          updates.blockedReason = deleteField();
          updates["profile.blockedReason"] = deleteField();
          updates["profile.blockedByUid"] = deleteField();
        }

        await updateDoc(vendorRef, updates);

        const targetProducts =
          products.length > 0
            ? products
            : await fetchProductsForVendor();

        const updatedCount = await blockProductsForVendor(
          targetProducts,
          normalizedReason
        );
        const publicCount = await updatePublicProductsForVendor(false);

        if (updatedCount > 0) {
          setActionMessage(
            `Le vendeur a ete bloque et ${updatedCount} produit(s) ont ete desactives.`
          );
        } else {
          setActionMessage("Le vendeur a ete bloque.");
        }
        if (publicCount > 0) {
          setActionMessage(
            `Le vendeur a ete bloque et ${publicCount} produit(s) publics ont ete masques.`
          );
        }

        await refreshProducts();

        // Notifications email (vendeur + infos@)
        const mailCollection = collection(db, "mail");
        const blockedAtText = new Date().toLocaleString("fr-FR");
        const vendorName =
          vendor?.displayName ||
          company?.name ||
          vendor?.name ||
          vendor?.companyName ||
          vendor?.profile?.company?.name ||
          vendor?.profile?.name ||
          vendor?.id ||
          "Boutique";
        const reasonText = normalizedReason || "Aucun motif renseigné";

        const vendorHtml = `
          <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Boutique bloquée - Monmarché</title></head>
          <body style="font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif">
            <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
              <div style="background:#ff6f00;color:#fff;padding:12px;text-align:center">
                <h1 style="margin:0;font-size:20px">Votre boutique a été bloquée</h1>
              </div>
              <div style="padding:20px">
                <p>Bonjour,</p>
                <p>Votre boutique <strong>${vendorName}</strong> a été bloquée le ${blockedAtText}.</p>
                <p><strong>Motif :</strong> ${reasonText}</p>
                <p>Si vous pensez qu'il s'agit d'une erreur, contactez le support Monmarché.</p>
                <p>Merci,</p>
                <p>Service Client Monmarché</p>
              </div>
              <div style="background:#ff6f00;color:#fff;padding:10px;text-align:center;font-size:12px">
                &copy; ${new Date().getFullYear()} Monmarché
              </div>
            </div>
          </body></html>`;

        const adminHtml = `
          <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Boutique bloquée - Monmarché</title></head>
          <body style="font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif">
            <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
              <div style="background:#111827;color:#fff;padding:12px;text-align:center">
                <h1 style="margin:0;font-size:18px">Boutique bloquée (admin)</h1>
              </div>
              <div style="padding:20px">
                <p><strong>Boutique :</strong> ${vendorName}</p>
                <p><strong>Vendor ID :</strong> ${vendor?.id ?? "-"}</p>
                <p><strong>Email :</strong> ${vendorEmail || "-"}</p>
                <p><strong>Bloquée le :</strong> ${blockedAtText}</p>
                <p><strong>Motif :</strong> ${reasonText}</p>
                <p><strong>Admin :</strong> ${adminEmail || "admin"} (${adminUid || "-"})</p>
              </div>
            </div>
          </body></html>`;

        const mailWrites = [];
        if (vendorEmail) {
          mailWrites.push(
            addDoc(mailCollection, {
              to: vendorEmail,
              message: {
                subject: "Votre boutique a été bloquée",
                text: `Votre boutique "${vendorName}" a été bloquée. Motif: ${reasonText}`,
                html: vendorHtml,
              },
            })
          );
        }
        mailWrites.push(
          addDoc(mailCollection, {
            to: BLOCKED_VENDOR_NOTIFY_EMAIL,
            message: {
              subject: "Boutique bloquée (admin)",
              text: `Boutique "${vendorName}" bloquée. Motif: ${reasonText}`,
              html: adminHtml,
            },
          })
        );
        await Promise.all(mailWrites);

        success = true;
      } catch (err) {
        console.error("Erreur blocage vendeur:", err);
        setActionError(
          "Impossible de bloquer le vendeur. Merci de reessayer."
        );
      } finally {
        setActionBusy(false);
      }

      return success;
    },
    [
      vendor,
      company,
      isProtectedVendor,
      products,
      fetchProductsForVendor,
      blockProductsForVendor,
      refreshProducts,
      updatePublicProductsForVendor,
    ]
  );

  const handleUnblockVendor = useCallback(async () => {
    if (!vendor?.id) return false;
    setActionBusy(true);
    setActionError(null);
    let success = false;

    try {
      const timestamp = serverTimestamp();
      const vendorRef = doc(db, "vendors", vendor.id);
      const adminEmail = auth.currentUser?.email ?? null;
      const adminUid = auth.currentUser?.uid ?? null;
      const vendorEmail =
        company?.email ||
        vendor?.email ||
        vendor?.contactEmail ||
        vendor?.profile?.email ||
        vendor?.profile?.company?.email ||
        vendor?.company?.email ||
        null;
      const preBlock = vendor?.preBlockSnapshot || vendor?.profile?.preBlockSnapshot || {};
      const restoreValue = (value, fallback) =>
        value === undefined || value === null ? fallback : value;
      const restored = {
        status: restoreValue(preBlock.status, "under_review"),
        vendorStatus: restoreValue(preBlock.vendorStatus, "under_review"),
        "profile.status": restoreValue(preBlock.profileStatus, "under_review"),
        active: restoreValue(preBlock.active, true),
        isActive: restoreValue(preBlock.isActive, true),
        "profile.active": restoreValue(preBlock.profileActive, true),
        "profile.isActive": restoreValue(preBlock.profileIsActive, true),
        lockCatalog: restoreValue(preBlock.lockCatalog, false),
        lockEdits: restoreValue(preBlock.lockEdits, false),
        "profile.lockCatalog": restoreValue(preBlock.profileLockCatalog, false),
        "profile.lockEdits": restoreValue(preBlock.profileLockEdits, false),
      };
      await updateDoc(vendorRef, {
        ...restored,
        blocked: false,
        "profile.blocked": false,
        blockedAt: deleteField(),
        blockedReason: deleteField(),
        blockedBy: deleteField(),
        blockedByUid: deleteField(),
        updatedAt: timestamp,
        "profile.blockedAt": deleteField(),
        "profile.blockedReason": deleteField(),
        "profile.blockedBy": deleteField(),
        "profile.blockedByUid": deleteField(),
        preBlockSnapshot: deleteField(),
      });

      // Notifications email (vendeur + infos@)
      const mailCollection = collection(db, "mail");
      const unblockedAtText = new Date().toLocaleString("fr-FR");
      const vendorName =
        vendor?.displayName ||
        company?.name ||
        vendor?.name ||
        vendor?.companyName ||
        vendor?.profile?.company?.name ||
        vendor?.profile?.name ||
        vendor?.id ||
        "Boutique";

      const vendorHtml = `
        <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Boutique débloquée - Monmarché</title></head>
        <body style="font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif">
          <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
            <div style="background:#16a34a;color:#fff;padding:12px;text-align:center">
              <h1 style="margin:0;font-size:20px">Votre boutique a été débloquée</h1>
            </div>
            <div style="padding:20px">
              <p>Bonjour,</p>
              <p>Votre boutique <strong>${vendorName}</strong> a été débloquée le ${unblockedAtText}.</p>
              <p>Vous pouvez reprendre votre activité sur Monmarché.</p>
              <p>Merci,</p>
              <p>Service Client Monmarché</p>
            </div>
            <div style="background:#16a34a;color:#fff;padding:10px;text-align:center;font-size:12px">
              &copy; ${new Date().getFullYear()} Monmarché
            </div>
          </div>
        </body></html>`;

      const adminHtml = `
        <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Boutique débloquée - Monmarché</title></head>
        <body style="font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif">
          <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
            <div style="background:#111827;color:#fff;padding:12px;text-align:center">
              <h1 style="margin:0;font-size:18px">Boutique débloquée (admin)</h1>
            </div>
            <div style="padding:20px">
              <p><strong>Boutique :</strong> ${vendorName}</p>
              <p><strong>Vendor ID :</strong> ${vendor?.id ?? "-"}</p>
              <p><strong>Email :</strong> ${vendorEmail || "-"}</p>
              <p><strong>Débloquée le :</strong> ${unblockedAtText}</p>
              <p><strong>Admin :</strong> ${adminEmail || "admin"} (${adminUid || "-"})</p>
            </div>
          </div>
        </body></html>`;

      const mailWrites = [];
      if (vendorEmail) {
        mailWrites.push(
          addDoc(mailCollection, {
            to: vendorEmail,
            message: {
              subject: "Votre boutique a été débloquée",
              text: `Votre boutique "${vendorName}" a été débloquée.`,
              html: vendorHtml,
            },
          })
        );
      }
      mailWrites.push(
        addDoc(mailCollection, {
          to: BLOCKED_VENDOR_NOTIFY_EMAIL,
          message: {
            subject: "Boutique débloquée (admin)",
            text: `Boutique "${vendorName}" débloquée.`,
            html: adminHtml,
          },
        })
      );
      await Promise.all(mailWrites);

      setActionMessage(
        "Le vendeur a ete debloque. Les valeurs precedentes ont ete restaurees."
      );
      await updatePublicProductsForVendor(true);
      success = true;
    } catch (err) {
      console.error("Erreur deblocage vendeur:", err);
      setActionError(
        "Impossible de debloquer le vendeur pour le moment."
      );
    } finally {
      setActionBusy(false);
    }

    return success;
  }, [vendor, company, updatePublicProductsForVendor]);

  const handlePauseVendor = useCallback(
    async (reason) => {
      if (!vendor?.id) return false;
      if (isProtectedVendor) {
        setActionError(
          "Le compte Monmarche est protege et ne peut pas etre mis en pause."
        );
        return false;
      }
      if (isBlocked) {
        setActionError(
          "Un vendeur bloque ne peut pas etre mis en pause."
        );
        return false;
      }
      if (!isPauseRequested && !isApproved) {
        setActionError(
          "Le vendeur doit etre approuve avant une mise en pause."
        );
        return false;
      }
      if (isPaused) {
        setActionError("Ce vendeur est deja en pause.");
        return false;
      }

      setActionBusy(true);
      setActionError(null);
      let success = false;

      try {
        const isValidationFlow = isPauseRequested;
        const timestamp = serverTimestamp();
        const vendorRef = doc(db, "vendors", vendor.id);
        const adminEmail = auth.currentUser?.email ?? null;
        const adminUid = auth.currentUser?.uid ?? null;
        const normalizedReason = reason?.trim();
        const vendorEmail =
          company?.email ||
          vendor?.email ||
          vendor?.contactEmail ||
          vendor?.profile?.email ||
          vendor?.profile?.company?.email ||
          vendor?.company?.email ||
          null;
        const requestedDaysRaw =
          vendor?.pause?.requestedDays ??
          vendor?.profile?.pause?.requestedDays ??
          vendor?.pauseRequestedDays;
        const requestedDaysNumber = Number(requestedDaysRaw);
        const hasRequestedDays =
          Number.isFinite(requestedDaysNumber) && requestedDaysNumber > 0;
        const pauseResumeAtDate = hasRequestedDays
          ? new Date(Date.now() + requestedDaysNumber * 24 * 60 * 60 * 1000)
          : null;
        const requestedAtValue =
          vendor?.pause?.requestedAt ??
          vendor?.profile?.pause?.requestedAt ??
          vendor?.pauseRequestedAt ??
          timestamp;
        const pauseResumeAtValue =
          vendor?.pause?.resumeAt ??
          vendor?.pause?.pauseResumeAt ??
          vendor?.pauseResumeAt ??
          vendor?.profile?.pauseResumeAt ??
          pauseResumeAtDate;

        const prePauseSnapshot = {
          status: vendor?.status ?? vendor?.vendorStatus ?? "approved",
          vendorStatus: vendor?.vendorStatus ?? vendor?.status ?? "approved",
          profileStatus: vendor?.profile?.status ?? "approved",
        };

        const updates = {
          status: "paused",
          vendorStatus: "paused",
          "profile.status": "paused",
          isPaused: true,
          paused: true,
          "profile.isPaused": true,
          "profile.paused": true,
          pauseStartedAt: timestamp,
          pauseRequestedAt: requestedAtValue,
          "pause.requestedAt": requestedAtValue,
          "pause.active": true,
          pauseApprovedAt: timestamp,
          "pause.approvedAt": timestamp,
          "pause.pauseStartedAt": timestamp,
          "pause.startedAt": timestamp,
          pauseResumedAt: deleteField(),
          "pause.resumedAt": deleteField(),
          "pause.resumedBy": deleteField(),
          "pause.resumedByUid": deleteField(),
          updatedAt: timestamp,
          prePauseSnapshot,
        };

        if (adminEmail) {
          updates.pauseApprovedBy = adminEmail;
          updates["pause.approvedBy"] = adminEmail;
        } else {
          updates.pauseApprovedBy = "admin";
          updates["pause.approvedBy"] = "admin";
        }
        if (adminUid) {
          updates.pauseApprovedByUid = adminUid;
          updates["pause.approvedByUid"] = adminUid;
        }
        if (hasRequestedDays) {
          updates.pauseRequestedDays = requestedDaysNumber;
          updates["pause.requestedDays"] = requestedDaysNumber;
        }
        if (pauseResumeAtValue) {
          updates.pauseResumeAt = pauseResumeAtValue;
          updates["pause.pauseResumeAt"] = pauseResumeAtValue;
          updates["pause.resumeAt"] = pauseResumeAtValue;
        }
        if (normalizedReason) {
          updates.pauseReason = normalizedReason;
          updates["pause.reason"] = normalizedReason;
        }

        await updateDoc(vendorRef, updates);

        const targetProducts =
          products.length > 0
            ? products
            : await fetchProductsForVendor();

        const updatedCount = await pauseProductsForVendor(targetProducts);
        const publicCount = await pausePublicProductsForVendor();

        if (updatedCount > 0 || publicCount > 0) {
          setActionMessage(
            `${isValidationFlow ? "La pause a ete validee" : "Le vendeur est en pause"}. ${updatedCount} produit(s) vendor et ${publicCount} produit(s) publics ont ete masques.`
          );
        } else {
          setActionMessage(
            isValidationFlow
              ? "La pause a ete validee."
              : "Le vendeur est en pause."
          );
        }

        await refreshProducts();

        // Notifications email (vendeur + infos@) - non bloquant
        try {
          const mailCollection = collection(db, "mail");
          const pausedAtText = new Date().toLocaleString("fr-FR");
          const vendorName =
            vendor?.displayName ||
            company?.name ||
            vendor?.name ||
            vendor?.companyName ||
            vendor?.profile?.company?.name ||
            vendor?.profile?.name ||
            vendor?.id ||
            "Boutique";
          const reasonText = normalizedReason || "Aucun motif renseigné";
          const titleText = isValidationFlow
            ? "Votre pause a été validée"
            : "Votre boutique est en pause";

          const vendorHtml = `
            <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>${titleText} - Monmarché</title></head>
            <body style="font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif">
              <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
                <div style="background:#f97316;color:#fff;padding:12px;text-align:center">
                  <h1 style="margin:0;font-size:20px">${titleText}</h1>
                </div>
                <div style="padding:20px">
                  <p>Bonjour,</p>
                  <p>Votre boutique <strong>${vendorName}</strong> est en pause depuis le ${pausedAtText}.</p>
                  <p><strong>Motif :</strong> ${reasonText}</p>
                  <p>Si vous pensez qu'il s'agit d'une erreur, contactez le support Monmarché.</p>
                  <p>Merci,</p>
                  <p>Service Client Monmarché</p>
                </div>
                <div style="background:#f97316;color:#fff;padding:10px;text-align:center;font-size:12px">
                  &copy; ${new Date().getFullYear()} Monmarché
                </div>
              </div>
            </body></html>`;

          const adminHtml = `
            <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Boutique en pause - Monmarché</title></head>
            <body style="font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif">
              <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
                <div style="background:#111827;color:#fff;padding:12px;text-align:center">
                  <h1 style="margin:0;font-size:18px">Boutique en pause (admin)</h1>
                </div>
                <div style="padding:20px">
                  <p><strong>Boutique :</strong> ${vendorName}</p>
                  <p><strong>Vendor ID :</strong> ${vendor?.id ?? "-"}</p>
                  <p><strong>Email :</strong> ${vendorEmail || "-"}</p>
                  <p><strong>Pause le :</strong> ${pausedAtText}</p>
                  <p><strong>Motif :</strong> ${reasonText}</p>
                  <p><strong>Admin :</strong> ${adminEmail || "admin"} (${adminUid || "-"})</p>
                </div>
              </div>
            </body></html>`;

          const mailWrites = [];
          if (vendorEmail) {
            mailWrites.push(
              addDoc(mailCollection, {
                to: vendorEmail,
                message: {
                  subject: titleText,
                  text: `Votre boutique "${vendorName}" est en pause. Motif: ${reasonText}`,
                  html: vendorHtml,
                },
              })
            );
          }
          mailWrites.push(
            addDoc(mailCollection, {
              to: BLOCKED_VENDOR_NOTIFY_EMAIL,
              message: {
                subject: "Boutique en pause (admin)",
                text: `Boutique "${vendorName}" en pause. Motif: ${reasonText}`,
                html: adminHtml,
              },
            })
          );
          await Promise.all(mailWrites);
        } catch (mailError) {
          console.warn("Email pause vendeur non envoyé (non bloquant):", mailError);
        }

        success = true;
      } catch (err) {
        console.error("Erreur mise en pause vendeur:", err);
        setActionError(
          "Impossible de mettre ce vendeur en pause pour le moment."
        );
      } finally {
        setActionBusy(false);
      }

      return success;
    },
    [
      vendor,
      company,
      isProtectedVendor,
      isBlocked,
      isApproved,
      isPaused,
      isPauseRequested,
      products,
      fetchProductsForVendor,
      pauseProductsForVendor,
      pausePublicProductsForVendor,
      refreshProducts,
    ]
  );

  const handleResumeVendor = useCallback(async () => {
    if (!vendor?.id) return false;
    if (!isPaused) {
      setActionError("Ce vendeur n'est pas en pause.");
      return false;
    }

    setActionBusy(true);
    setActionError(null);
    let success = false;

    try {
      const timestamp = serverTimestamp();
      const vendorRef = doc(db, "vendors", vendor.id);
      const adminEmail = auth.currentUser?.email ?? null;
      const adminUid = auth.currentUser?.uid ?? null;
      const prePause = vendor?.prePauseSnapshot || {};
      const restoreValue = (value, fallback) =>
        value === undefined || value === null ? fallback : value;

      const updates = {
        status: restoreValue(prePause.status, "approved"),
        vendorStatus: restoreValue(prePause.vendorStatus, "approved"),
        "profile.status": restoreValue(prePause.profileStatus, "approved"),
        isPaused: false,
        paused: false,
        "profile.isPaused": false,
        "profile.paused": false,
        pauseResumedAt: timestamp,
        "pause.active": false,
        "pause.resumedAt": timestamp,
        updatedAt: timestamp,
        prePauseSnapshot: deleteField(),
      };
      if (adminEmail) {
        updates.pauseResumedBy = adminEmail;
        updates["pause.resumedBy"] = adminEmail;
      } else {
        updates.pauseResumedBy = "admin";
        updates["pause.resumedBy"] = "admin";
      }
      if (adminUid) {
        updates.pauseResumedByUid = adminUid;
        updates["pause.resumedByUid"] = adminUid;
      }

      await updateDoc(vendorRef, updates);

      const targetProducts =
        products.length > 0 ? products : await fetchProductsForVendor();
      const updatedCount = await restoreProductsAfterPause(targetProducts);
      const publicCount = await restorePublicProductsAfterPause();

      if (updatedCount > 0 || publicCount > 0) {
        setActionMessage(
          `La pause est levee. ${updatedCount} produit(s) vendor et ${publicCount} produit(s) publics ont ete reactives.`
        );
      } else {
        setActionMessage("La pause du vendeur a ete levee.");
      }
      await refreshProducts();
      success = true;
    } catch (err) {
      console.error("Erreur reprise vendeur:", err);
      setActionError(
        "Impossible de lever la pause du vendeur pour le moment."
      );
    } finally {
      setActionBusy(false);
    }

    return success;
  }, [
    vendor,
    isPaused,
    products,
    fetchProductsForVendor,
    restoreProductsAfterPause,
    restorePublicProductsAfterPause,
    refreshProducts,
  ]);

  const handleArchiveAndDeleteVendor = useCallback(
    async (reason) => {
      if (!vendor?.id) return false;
      if (isProtectedVendor) {
        setActionError(
          "Le compte Monmarche est protege et ne peut pas etre supprime."
        );
        return false;
      }
      if (!isBlocked) {
        setActionError(
          "La suppression est autorisee uniquement pour un vendeur bloque."
        );
        return false;
      }

      setActionBusy(true);
      setActionError(null);
      setActionMessage(null);
      let success = false;

      try {
        const normalizedReason = reason?.trim();
        if (!normalizedReason) {
          setActionError("Le motif de suppression est obligatoire.");
          return false;
        }

        const actorEmail = auth.currentUser?.email ?? null;
        const actorUid = auth.currentUser?.uid ?? null;
        const actor = actorEmail || actorUid || "admin";
        const vendorEmail =
          company?.email ||
          vendor?.email ||
          vendor?.contactEmail ||
          vendor?.profile?.email ||
          vendor?.profile?.company?.email ||
          vendor?.company?.email ||
          null;
        const deletedVendorRef = doc(db, "deletedVendors", vendor.id);

        const vendorProductSnapshots =
          await fetchVendorProductSnapshotsForDeletion();
        const publicProductSnapshots =
          await fetchPublicProductSnapshotsForVendor();

        const archiveEntries = [];

        const archivedVendorPayload = {
          ...sanitizeForFirestore(vendor),
          archivedFromPath: `vendors/${vendor.id}`,
          archivedAt: serverTimestamp(),
          archivedBy: actor,
          deletedAt: serverTimestamp(),
          deletedBy: actor,
          deletedByEmail: actorEmail,
          deletedByUid: actorUid,
          deleteReason: normalizedReason,
          archivedVendorProductsCount: vendorProductSnapshots.length,
          deletedPublicProductsCount: publicProductSnapshots.length,
        };
        archiveEntries.push({
          ref: deletedVendorRef,
          payload: archivedVendorPayload,
        });

        const refsToDeleteByPath = new Map();
        const addDeleteRef = (ref) => {
          if (!ref?.path) return;
          refsToDeleteByPath.set(ref.path, ref);
        };

        vendorProductSnapshots.forEach((docSnap, index) => {
          const sourcePath = docSnap.ref.path;
          addDeleteRef(docSnap.ref);

          const archiveDocId = buildArchivedDocId(
            sourcePath,
            `vendor_products_${index}`
          );
          const archiveRef = doc(
            db,
            "deletedVendors",
            vendor.id,
            "products",
            archiveDocId
          );

          archiveEntries.push({
            ref: archiveRef,
            payload: {
              ...sanitizeForFirestore({ id: docSnap.id, ...docSnap.data() }),
              archivedAt: serverTimestamp(),
              archivedBy: actor,
              deletedAt: serverTimestamp(),
              deletedBy: actor,
              deletedByEmail: actorEmail,
              deletedByUid: actorUid,
              deleteReason: normalizedReason,
              archivedFromPath: sourcePath,
              archivedFromCollection: "vendor_products",
              originalProductId: docSnap.id,
            },
          });
        });

        publicProductSnapshots.forEach((docSnap) => {
          addDeleteRef(docSnap.ref);
        });

        vendorIdentifiers
          .filter((value) => typeof value === "string" && value.trim())
          .forEach((value) => {
            addDeleteRef(doc(db, "vendor_products", value));
          });

        const archiveChunkSize = 350;
        for (let i = 0; i < archiveEntries.length; i += archiveChunkSize) {
          const chunk = archiveEntries.slice(i, i + archiveChunkSize);
          const batch = writeBatch(db);
          chunk.forEach(({ ref, payload }) => {
            batch.set(ref, payload, { merge: true });
          });
          await batch.commit();
        }

        addDeleteRef(doc(db, "vendors", vendor.id));
        const refsToDelete = Array.from(refsToDeleteByPath.values());
        const deleteChunkSize = 450;
        for (let i = 0; i < refsToDelete.length; i += deleteChunkSize) {
          const chunk = refsToDelete.slice(i, i + deleteChunkSize);
          const batch = writeBatch(db);
          chunk.forEach((ref) => batch.delete(ref));
          await batch.commit();
        }

        // Notifications email (vendeur + infos@) - non bloquant
        try {
          const mailCollection = collection(db, "mail");
          const deletedAtText = new Date().toLocaleString("fr-FR");
          const vendorName =
            vendor?.displayName ||
            company?.name ||
            vendor?.name ||
            vendor?.companyName ||
            vendor?.profile?.company?.name ||
            vendor?.profile?.name ||
            vendor?.id ||
            "Boutique";
          const reasonText = normalizedReason || "Aucun motif renseigné";

          const vendorHtml = `
            <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Boutique supprimée - Monmarché</title></head>
            <body style="font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif">
              <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
                <div style="background:#dc2626;color:#fff;padding:12px;text-align:center">
                  <h1 style="margin:0;font-size:20px">Votre boutique a été supprimée</h1>
                </div>
                <div style="padding:20px">
                  <p>Bonjour,</p>
                  <p>Votre boutique <strong>${vendorName}</strong> a été supprimée le ${deletedAtText}.</p>
                  <p><strong>Motif :</strong> ${reasonText}</p>
                  <p>Si vous pensez qu'il s'agit d'une erreur, contactez le support Monmarché.</p>
                  <p>Merci,</p>
                  <p>Service Client Monmarché</p>
                </div>
                <div style="background:#dc2626;color:#fff;padding:10px;text-align:center;font-size:12px">
                  &copy; ${new Date().getFullYear()} Monmarché
                </div>
              </div>
            </body></html>`;

          const adminHtml = `
            <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Boutique supprimée - Monmarché</title></head>
            <body style="font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif">
              <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
                <div style="background:#111827;color:#fff;padding:12px;text-align:center">
                  <h1 style="margin:0;font-size:18px">Boutique supprimée (admin)</h1>
                </div>
                <div style="padding:20px">
                  <p><strong>Boutique :</strong> ${vendorName}</p>
                  <p><strong>Vendor ID :</strong> ${vendor?.id ?? "-"}</p>
                  <p><strong>Email :</strong> ${vendorEmail || "-"}</p>
                  <p><strong>Supprimée le :</strong> ${deletedAtText}</p>
                  <p><strong>Motif :</strong> ${reasonText}</p>
                  <p><strong>Admin :</strong> ${actorEmail || actor} (${actorUid || "-"})</p>
                </div>
              </div>
            </body></html>`;

          const mailWrites = [];
          if (vendorEmail) {
            mailWrites.push(
              addDoc(mailCollection, {
                to: vendorEmail,
                message: {
                  subject: "Votre boutique a été supprimée",
                  text: `Votre boutique "${vendorName}" a été supprimée. Motif: ${reasonText}`,
                  html: vendorHtml,
                },
              })
            );
          }
          mailWrites.push(
            addDoc(mailCollection, {
              to: BLOCKED_VENDOR_NOTIFY_EMAIL,
              message: {
                subject: "Boutique supprimée (admin)",
                text: `Boutique "${vendorName}" supprimée. Motif: ${reasonText}`,
                html: adminHtml,
              },
            })
          );
          await Promise.all(mailWrites);
        } catch (mailError) {
          console.warn("Email suppression vendeur non envoyé (non bloquant):", mailError);
        }

        success = true;
        window.alert(
          "Le vendeur et tous ses produits ont ete supprimes de l'application."
        );
        navigate("/vendors");
      } catch (err) {
        console.error("Erreur suppression archivee vendeur:", err);
        setActionError(
          "Impossible d'archiver puis supprimer ce vendeur pour le moment."
        );
      } finally {
        setActionBusy(false);
      }

      return success;
    },
    [
      vendor,
      company,
      isBlocked,
      isProtectedVendor,
      vendorIdentifiers,
      fetchVendorProductSnapshotsForDeletion,
      fetchPublicProductSnapshotsForVendor,
      navigate,
    ]
  );

  const handlePartnerToggle = useCallback(
    async (enabled) => {
      if (!vendor?.id) return;
      setActionBusy(true);
      setActionError(null);
      setActionMessage(null);
      try {
        const timestamp = serverTimestamp();
        const vendorRef = doc(db, "vendors", vendor.id);
        await updateDoc(vendorRef, {
          isPartner: enabled,
          partner: enabled,
          "profile.isPartner": enabled,
          "profile.partner": enabled,
          updatedAt: timestamp,
          "profile.updatedAt": timestamp,
        });
        setActionMessage(
          enabled
            ? "Vendeur marque comme partenaire."
            : "Vendeur retire des partenaires."
        );
      } catch (err) {
        console.error("Partner toggle failed:", err);
        setActionError("Impossible de mettre a jour le statut partenaire.");
      } finally {
        setActionBusy(false);
      }
    },
    [vendor]
  );

  const handleBlockAllProducts = useCallback(
    async (reason) => {
      setActionBusy(true);
      setActionError(null);
      let success = false;

      try {
        const normalizedReason = reason?.trim();
        const targetProducts =
          products.length > 0
            ? products
            : await fetchProductsForVendor();

        if (targetProducts.length === 0) {
          setActionMessage("Aucun produit associe a ce vendeur.");
          success = true;
        } else {
          const updatedCount = await blockProductsForVendor(
            targetProducts,
            normalizedReason
          );
          setActionMessage(
            `${updatedCount} produit(s) ont ete bloques.`
          );
          await refreshProducts();
          success = true;
        }
      } catch (err) {
        console.error("Erreur blocage produits:", err);
        setActionError(
          "Impossible de bloquer les produits du vendeur."
        );
      } finally {
        setActionBusy(false);
      }

      return success;
    },
    [products, fetchProductsForVendor, blockProductsForVendor, refreshProducts]
  );

  const handleReactivateAllProducts = useCallback(async () => {
    setActionBusy(true);
    setActionError(null);
    let success = false;

    try {
      let targetProducts = blockedProducts;
      if (targetProducts.length === 0) {
        const fetched = await fetchProductsForVendor();
        targetProducts = fetched.filter(
          (product) =>
            product?.blocked === true || product?.status === false
        );
      }

      if (targetProducts.length === 0) {
        setActionMessage("Aucun produit bloque pour ce vendeur.");
        success = true;
      } else {
        const updatedCount = await reactivateProductsForVendor(
          targetProducts
        );
        setActionMessage(
          `${updatedCount} produit(s) ont ete reactives.`
        );
        await refreshProducts();
        success = true;
      }
    } catch (err) {
      console.error("Erreur reactivation produits:", err);
      setActionError(
        "Impossible de reactiver les produits du vendeur."
      );
    } finally {
      setActionBusy(false);
    }

    return success;
  }, [blockedProducts, fetchProductsForVendor, reactivateProductsForVendor, refreshProducts]);

  const handleToggleProduct = useCallback(
    async (product, shouldBlock, reason) => {
      if (!product?.id) return false;
      setActionBusy(true);
      setActionError(null);
      let success = false;
      const productLabel = getProductLabel(product) || product?.id;

      try {
        const productRef = getPrimaryProductDocRef(product, db);
        if (shouldBlock) {
          const timestamp = serverTimestamp();
          const adminEmail = auth.currentUser?.email ?? null;
          const adminUid = auth.currentUser?.uid ?? null;
          const normalizedReason = reason?.trim();

          const payload = {
            status: "archived",
            blocked: true,
            published: false,
            homePage: false,
            blockedAt: timestamp,
            updatedAt: timestamp,
          };

          payload.active = false;
          payload.isActive = false;
          payload["profile.blocked"] = true;
          payload["profile.active"] = false;
          payload["profile.isActive"] = false;
          payload["core.status"] = "archived";
          payload["core.active"] = false;
          payload["core.isActive"] = false;
          payload["core.blocked"] = true;
          payload["draft.core.status"] = "archived";
          payload["draft.core.active"] = false;
          payload["draft.core.isActive"] = false;
          payload["draft.core.blocked"] = true;
          payload["draft.core.published"] = false;
          payload["core.updatedAt"] = timestamp;
          payload["draft.core.updatedAt"] = timestamp;
          payload["draft.updatedAt"] = timestamp;

          if (adminEmail) {
            payload.blockedBy = adminEmail;
            payload["profile.blockedBy"] = adminEmail;
            payload["core.blockedBy"] = adminEmail;
            payload["draft.core.blockedBy"] = adminEmail;
          } else {
            payload.blockedBy = "admin";
            payload["profile.blockedBy"] = "admin";
            payload["core.blockedBy"] = "admin";
            payload["draft.core.blockedBy"] = "admin";
          }

          if (adminUid) {
            payload.blockedByUid = adminUid;
            payload["profile.blockedByUid"] = adminUid;
            payload["core.blockedByUid"] = adminUid;
            payload["draft.core.blockedByUid"] = adminUid;
          }

          if (normalizedReason) {
            payload.blockedReason = normalizedReason;
            payload["profile.blockedReason"] = normalizedReason;
            payload["core.blockedReason"] = normalizedReason;
            payload["draft.core.blockedReason"] = normalizedReason;
          } else {
            payload.blockedReason = deleteField();
            payload["profile.blockedReason"] = deleteField();
            payload["core.blockedReason"] = deleteField();
            payload["draft.core.blockedReason"] = deleteField();
            payload["profile.blockedByUid"] = deleteField();
            payload["core.blockedByUid"] = deleteField();
            payload["draft.core.blockedByUid"] = deleteField();
          }

          await updateDoc(productRef, payload);
          await syncLegacyProductDoc(product, payload);
          setActionMessage(
            `Le produit "${productLabel}" a ete bloque.`
          );
        } else {
          const updateTimestamp = serverTimestamp();
          const payload = {
            status: "active",
            updatedAt: updateTimestamp,
            blocked: false,
            published: true,
            blockedAt: deleteField(),
            blockedBy: deleteField(),
            blockedByUid: deleteField(),
            blockedReason: deleteField(),
            "profile.blockedBy": deleteField(),
            "profile.blockedByUid": deleteField(),
            "profile.blockedReason": deleteField(),
            "core.blockedBy": deleteField(),
            "core.blockedByUid": deleteField(),
            "core.blockedReason": deleteField(),
            "draft.core.blockedBy": deleteField(),
            "draft.core.blockedByUid": deleteField(),
            "draft.core.blockedReason": deleteField(),
          };

          payload.active = true;
          payload.isActive = true;
          payload["profile.blocked"] = false;
          payload["profile.active"] = true;
          payload["profile.isActive"] = true;
          payload["core.status"] = "active";
          payload["core.active"] = true;
          payload["core.isActive"] = true;
          payload["core.blocked"] = false;
          payload["draft.core.status"] = "active";
          payload["draft.core.active"] = true;
          payload["draft.core.isActive"] = true;
          payload["draft.core.blocked"] = false;
          payload["draft.core.published"] = true;
          payload["core.updatedAt"] = updateTimestamp;
          payload["draft.core.updatedAt"] = updateTimestamp;
          payload["draft.updatedAt"] = updateTimestamp;

          await updateDoc(productRef, payload);
          await syncLegacyProductDoc(product, payload);
          setActionMessage(
            `Le produit "${productLabel}" a ete reactive.`
          );
        }

        await refreshProducts();
        success = true;
      } catch (err) {
        console.error("Erreur mise a jour produit:", err);
        setActionError(
          "Impossible de mettre a jour le produit. Merci de reessayer."
        );
      } finally {
        setActionBusy(false);
      }

      return success;
    },
    [refreshProducts, syncLegacyProductDoc]
  );

  useEffect(() => {
    if (!actionMessage) return;
    const timer = setTimeout(() => {
      setActionMessage(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [actionMessage]);

  useEffect(() => {
    if (!actionError) return;
    const timer = setTimeout(() => {
      setActionError(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [actionError]);

  useEffect(() => {
    if (!locationMessage) return;
    const timer = setTimeout(() => {
      setLocationMessage(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [locationMessage]);

  const closeDialog = useCallback(() => {
    setDialog(null);
    setDialogReason("");
    setDialogValidationError("");
  }, []);

  const openDialog = useCallback((payload) => {
    setDialogReason("");
    setDialogValidationError("");
    setDialog(payload);
  }, []);

  const handleDialogConfirm = useCallback(async () => {
    if (!dialog) return;
    const reason = dialogReason.trim();
    const reasonRequired = dialog.type === "deleteVendor";
    if (reasonRequired && !reason) {
      setDialogValidationError("Le motif de suppression est obligatoire.");
      return;
    }
    setDialogValidationError("");
    let success = false;

    switch (dialog.type) {
      case "approveVendor":
        success = await handleApproveVendor();
        break;
      case "blockVendor":
        success = await handleBlockVendor(reason);
        break;
      case "unblockVendor":
        success = await handleUnblockVendor();
        break;
      case "pauseVendor":
        success = await handlePauseVendor(reason);
        break;
      case "resumeVendor":
        success = await handleResumeVendor();
        break;
      case "blockAllProducts":
        success = await handleBlockAllProducts(reason);
        break;
      case "reactivateAllProducts":
        success = await handleReactivateAllProducts();
        break;
      case "blockProduct":
        if (dialog.product) {
          success = await handleToggleProduct(dialog.product, true, reason);
        }
        break;
      case "reactivateProduct":
        if (dialog.product) {
          success = await handleToggleProduct(dialog.product, false);
        }
        break;
      case "deleteVendor":
        success = await handleArchiveAndDeleteVendor(reason);
        break;
      default:
        break;
    }

    if (success) {
      closeDialog();
    }
  }, [
    dialog,
    dialogReason,
    setDialogValidationError,
    handleApproveVendor,
    handleBlockVendor,
    handleUnblockVendor,
    handlePauseVendor,
    handleResumeVendor,
    handleBlockAllProducts,
    handleReactivateAllProducts,
    handleToggleProduct,
    handleArchiveAndDeleteVendor,
    closeDialog,
  ]);

  return {
    actionBusy,
    actionError,
    setActionError,
    actionMessage,
    setActionMessage,
    dialog,
    setDialog,
    dialogReason,
    setDialogReason,
    dialogValidationError,
    setDialogValidationError,
    approvalLocation,
    setApprovalLocation,
    locationFallback,
    setLocationFallback,
    fetchingLocation,
    locationError,
    setLocationError,
    locationMessage,
    setLocationMessage,
    handleCaptureLocation,
    handleApproveVendor,
    handleBlockVendor,
    handleUnblockVendor,
    handlePauseVendor,
    handleResumeVendor,
    handleArchiveAndDeleteVendor,
    handlePartnerToggle,
    handleBlockAllProducts,
    handleReactivateAllProducts,
    handleToggleProduct,
    openDialog,
    closeDialog,
    handleDialogConfirm,
  };
};
