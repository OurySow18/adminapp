/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 * 
 * Hier ist die Table mit der produktdaten abgerufen
 */
import "./products.scss"
import Sidebar from "../../components/sidebar/Sidebar"
import Navbar from "../../components/navbar/Navbar"

const Products = () => {
   
    return (
      <div className="products">
          <Sidebar />
          <div className="productsContainer">
            <Navbar/>
          </div>
     </div>
    );
    }

export default Products;