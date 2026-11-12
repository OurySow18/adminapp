import "./routeLoader.scss";

// Affiche pendant le telechargement du code d'une page (React.lazy/Suspense)
// a chaque changement de menu. Remplace le fallback={null} precedent : sur
// une connexion lente, un ecran totalement vide donnait l'impression d'un
// plantage. Reste volontairement leger (pas de dependance aux styles des
// pages, qui ne sont pas encore charges a ce moment-la).
const RouteLoader = () => (
  <div className="routeLoader">
    <div className="routeLoader__spinner" aria-hidden="true" />
    <span>Chargement...</span>
  </div>
);

export default RouteLoader;
