import React from 'react';
import './productHit.scss';
import { Link } from 'react-router-dom';

const ProductHit = ({ hit }) => { 
  
  return (
    <Link to={`/products/${hit.objectID}`} style={{ textDecoration: 'none' }}>
     <div className="productHit">
      <img src={hit.img} alt={hit.name} className="productImage" />
      <div className="productDetails">
        <h2 className="productName">{hit.name}</h2>
        <p className="productWeight">Poids: {hit.poids}</p>
        <p className="productPrice">Prix: {hit.price} GNF</p>
      </div>
    </div> 
    </Link>
  );
};

export default ProductHit;
