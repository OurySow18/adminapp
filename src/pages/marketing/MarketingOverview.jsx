import "./MarketingPage.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { Link } from "react-router-dom";

const MarketingOverview = () => (
  <div className="marketingPage">
    <Sidebar />
    <div className="marketingPage__container">
      <Navbar />
      <div className="marketingPage__content">
        <div className="marketingPage__header marketingPage__header--between">
          <div>
            <h1>Marketing</h1>
            <p className="subtitle">
              Gérez vos contenus marketing, bannières et sponsors.
            </p>
          </div>
        </div>
        <div className="marketingPage__cards">
          <Link to="/admin/marketing/banners" className="marketingPage__cardLink">
            <div className="marketingPage__card">
              <h2>Banniere</h2>
              <p>Créez les visuels principaux et contenus de marque.</p>
            </div>
          </Link>
          <Link to="/admin/marketing/bestsellers" className="marketingPage__cardLink">
            <div className="marketingPage__card">
              <h2>Recommandés</h2>
              <p>Gérez les produits recommandés.</p>
            </div>
          </Link>
          <Link to="/admin/marketing/sponsors" className="marketingPage__cardLink">
            <div className="marketingPage__card">
              <h2>Sponsors</h2>
              <p>Gérez les sponsors et leurs associations produit/catégorie.</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  </div>
);

export default MarketingOverview;
