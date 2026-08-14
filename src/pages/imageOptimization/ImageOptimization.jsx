import "./imageOptimization.scss";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ConfirmModal from "../../components/modal/ConfirmModal";
import { db, functions } from "../../firebase";

const startJobCallable = httpsCallable(functions, "startImageOptimizationJob");
const processBatchCallable = httpsCallable(functions, "processImageOptimizationBatch");

const MODES = {
  simulation: {
    title: "Lancer la simulation",
    description:
      "Teste jusqu’à 5 produits, télécharge et convertit les images sans envoyer de fichier ni modifier les produits.",
    confirm: "Simuler",
  },
  test: {
    title: "Lancer le test réel",
    description:
      "Optimise réellement un maximum de 5 documents produit avant un lancement complet.",
    confirm: "Lancer le test",
  },
  full: {
    title: "Lancer l’optimisation complète",
    description:
      "Analyse les deux catalogues et traite les documents par lots serveur de 15.",
    confirm: "Lancer l’optimisation",
  },
};

const formatDate = (value) => {
  const date = typeof value?.toDate === "function" ? value.toDate() : null;
  return date ? date.toLocaleString("fr-FR") : "—";
};

const ImageOptimization = () => {
  const [activeJobId, setActiveJobId] = useState(null);
  const [job, setJob] = useState(null);
  const [logs, setLogs] = useState([]);
  const [recentJobs, setRecentJobs] = useState([]);
  const [confirmMode, setConfirmMode] = useState(null);
  const [starting, setStarting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const continueRef = useRef(false);

  useEffect(() => {
    const recentQuery = query(
      collection(db, "image_optimization_jobs"),
      orderBy("createdAt", "desc"),
      limit(10)
    );
    return onSnapshot(recentQuery, (snapshot) => {
      const jobs = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      setRecentJobs(jobs);
      setActiveJobId((current) => current || jobs.find((entry) => entry.status === "running")?.id || jobs[0]?.id || null);
    });
  }, []);

  useEffect(() => {
    if (!activeJobId) {
      setJob(null);
      setLogs([]);
      return undefined;
    }
    const unsubscribeJob = onSnapshot(
      doc(db, "image_optimization_jobs", activeJobId),
      (snapshot) => setJob(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null)
    );
    const logsQuery = query(
      collection(db, "image_optimization_jobs", activeJobId, "logs"),
      orderBy("createdAt", "desc"),
      limit(200)
    );
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      setLogs(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    });
    return () => {
      unsubscribeJob();
      unsubscribeLogs();
    };
  }, [activeJobId]);

  const runBatches = useCallback(async (jobId) => {
    if (!jobId) return;
    continueRef.current = true;
    setProcessing(true);
    setError("");
    try {
      while (continueRef.current) {
        const response = await processBatchCallable({ jobId, batchSize: 15 });
        if (response.data?.complete) break;
        if (!response.data?.processedInBatch) {
          throw new Error("Aucun élément disponible pour poursuivre ce job.");
        }
      }
    } catch (batchError) {
      console.error("Image optimization batch failed:", batchError);
      if (batchError?.code === "functions/aborted") {
        setError("Un lot est déjà en cours sur ce job. Réessayez dans quelques instants.");
      } else {
        setError(batchError?.message || "Le traitement du lot a échoué.");
      }
    } finally {
      continueRef.current = false;
      setProcessing(false);
    }
  }, []);

  useEffect(() => () => {
    continueRef.current = false;
  }, []);

  const startJob = async (mode, sourceJobId = null) => {
    setStarting(true);
    setError("");
    try {
      const response = await startJobCallable({ mode, sourceJobId });
      const jobId = response.data?.jobId;
      if (!jobId) throw new Error("Identifiant de job manquant.");
      setActiveJobId(jobId);
      setConfirmMode(null);
      await runBatches(jobId);
    } catch (startError) {
      console.error("Unable to start image optimization:", startError);
      setError(startError?.message || "Impossible de démarrer le job.");
    } finally {
      setStarting(false);
    }
  };

  const processed = Number(job?.processed || 0);
  const total = Number(job?.total || 0);
  const progress = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  const errors = useMemo(() => logs.filter((entry) => entry.status === "failed"), [logs]);
  const controlsDisabled = starting || processing || job?.status === "running";

  return (
    <div className="imageOptimization">
      <Sidebar />
      <main className="imageOptimization__container">
        <Navbar />
        <header className="imageOptimization__header">
          <div>
            <h1>Optimisation des images produits</h1>
            <p>Conversion WebP qualité 82 %, maximum 1600 px et miniature couverture 240 px.</p>
          </div>
          <div className="imageOptimization__actions">
            <button type="button" className="secondary" disabled={controlsDisabled} onClick={() => setConfirmMode("simulation")}>Simulation (5)</button>
            <button type="button" className="secondary" disabled={controlsDisabled} onClick={() => setConfirmMode("test")}>Test réel (5)</button>
            <button type="button" className="primary" disabled={controlsDisabled} onClick={() => setConfirmMode("full")}>Lancement complet</button>
          </div>
        </header>

        {error && <div className="imageOptimization__error">{error}</div>}

        <section className="imageOptimization__panel">
          <div className="imageOptimization__panelTitle">
            <div>
              <h2>Progression</h2>
              <p>{job ? `Job ${job.id} · ${job.mode}` : "Aucun job sélectionné"}</p>
            </div>
            {job?.status === "running" && !processing && (
              <button type="button" className="primary" onClick={() => runBatches(job.id)}>Reprendre</button>
            )}
            {processing && (
              <button type="button" className="secondary" onClick={() => { continueRef.current = false; }}>Arrêter après ce lot</button>
            )}
            {Number(job?.failed || 0) > 0 && job?.status === "complete" && (
              <button type="button" className="danger" disabled={starting} onClick={() => startJob("retry", job.id)}>Relancer les échecs</button>
            )}
          </div>
          <div className="imageOptimization__progressTrack" aria-label={`Progression ${progress} %`}>
            <div style={{ width: `${progress}%` }} />
          </div>
          <div className="imageOptimization__progressText"><strong>{progress} %</strong><span>{processed} / {total} document(s)</span></div>
          <div className="imageOptimization__counters">
            <div><span>Réussis</span><strong className="success">{job?.succeeded || 0}</strong></div>
            <div><span>Ignorés</span><strong>{job?.skipped || 0}</strong></div>
            <div><span>Échoués</span><strong className="failed">{job?.failed || 0}</strong></div>
            <div><span>Images traitées</span><strong>{job?.imagesProcessed || 0}</strong></div>
          </div>
        </section>

        <div className="imageOptimization__columns">
          <section className="imageOptimization__panel">
            <h2>Journal détaillé</h2>
            <div className="imageOptimization__logList">
              {!logs.length && <p className="empty">Aucune entrée.</p>}
              {logs.map((entry) => (
                <article key={entry.id} className={`log log--${entry.status}`}>
                  {entry.imageUrl ? (
                    <button
                      type="button"
                      className="log__imageButton"
                      onClick={() =>
                        setImagePreview({
                          src: entry.imageUrl,
                          originalSrc: entry.originalImageUrl,
                          title: entry.title || entry.productId,
                        })
                      }
                      aria-label={`Agrandir l’image de ${entry.title || entry.productId}`}
                    >
                      <img src={entry.thumbnailUrl || entry.imageUrl} alt={entry.title || entry.productId} />
                    </button>
                  ) : (
                    <div className="log__imagePlaceholder" aria-hidden="true">IMG</div>
                  )}
                  <div className="log__content">
                    <div><strong>{entry.title || entry.productId}</strong><span>{entry.collectionName}</span></div>
                    <small>{entry.productId}</small>
                    <p>{entry.error || entry.message}</p>
                    <small>{formatDate(entry.createdAt)} · {entry.imagesProcessed || 0} image(s)</small>
                  </div>
                </article>
              ))}
            </div>
            {errors.length > 0 && <p className="imageOptimization__errorCount">{errors.length} erreur(s) détaillée(s) dans ce journal.</p>}
          </section>

          <section className="imageOptimization__panel">
            <h2>Jobs récents</h2>
            <div className="imageOptimization__jobList">
              {recentJobs.map((entry) => (
                <button type="button" key={entry.id} className={entry.id === activeJobId ? "active" : ""} onClick={() => setActiveJobId(entry.id)}>
                  <span><strong>{entry.mode}</strong><small>{formatDate(entry.createdAt)}</small></span>
                  <span className={`status status--${entry.status}`}>{entry.status}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <ConfirmModal
          open={Boolean(confirmMode)}
          title={confirmMode ? MODES[confirmMode].title : ""}
          onClose={() => !starting && setConfirmMode(null)}
          onConfirm={() => startJob(confirmMode)}
          confirmText={confirmMode ? MODES[confirmMode].confirm : "Confirmer"}
          loading={starting}
        >
          <p>{confirmMode ? MODES[confirmMode].description : ""}</p>
          <p>Les images originales ne seront jamais supprimées.</p>
        </ConfirmModal>
        {imagePreview && (
          <div
            className="imageOptimization__preview"
            role="dialog"
            aria-modal="true"
            aria-label={`Image de ${imagePreview.title}`}
            onClick={() => setImagePreview(null)}
          >
            <div onClick={(event) => event.stopPropagation()}>
              <button type="button" onClick={() => setImagePreview(null)} aria-label="Fermer">×</button>
              <img src={imagePreview.src} alt={imagePreview.title} />
              <strong>{imagePreview.title}</strong>
              {imagePreview.originalSrc && imagePreview.originalSrc !== imagePreview.src && (
                <a href={imagePreview.originalSrc} target="_blank" rel="noreferrer">Voir l’image originale</a>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ImageOptimization;
