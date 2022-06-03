import "./delivery.scss";
import Sidebar from "../../components/sidebar/Sidebar"
import Navbar from "../../components/navbar/Navbar"

const Delivery = () => {
   
    return (
      <div className="delivery">
          <Sidebar />
          <div className="deliveryContainer">
            <Navbar/>
          </div>
     </div>
    );
    }

export default Delivery;