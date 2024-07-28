// ListProducts.js
import './listProducts.scss';
import Sidebar from '../../components/sidebar/Sidebar';
import Navbar from '../../components/navbar/Navbar';
import algoliasearch from 'algoliasearch/lite';
import { InstantSearch, SearchBox, InfiniteHits } from 'react-instantsearch-dom';
import ProductHit from '../../components/productHit/ProductHit'; // Adjust the path as needed
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

const ListProducts = ({ title }) => {
  const searchClient = algoliasearch(
    process.env.REACT_APP_ALGOLIA_APP_ID,
    process.env.REACT_APP_ALGOLIA_SEARCH_KEY
  );

  // Number of products in the database
  const [count, setCount] = useState(0);

  // Fetch data from Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, title),
      (snapShot) => {
        let list = [];
        snapShot.docs.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setCount(list.length);
      },
      (error) => {
        console.log(error);
      }
    );
    return () => {
      unsub();
    };
  }, [title]);

  return (
    <div className="listProductsContainer">
      <Sidebar />
      <div className="listProductContainer">
        <Navbar />
        <div className="listProductTitle">
          Nombre de Produits {count}
          <Link to={{ pathname: "new" }} className="link">
            Ajouter Nouveau Produit
          </Link>
        </div>
        <InstantSearch searchClient={searchClient} indexName="products">
          <div className="searchProductContainer">
            <SearchBox />
          </div>
          <div className="infiniteHits">
            <InfiniteHits hitComponent={ProductHit} />
          </div>
        </InstantSearch>
      </div>
    </div>
  );
};

export default ListProducts;
