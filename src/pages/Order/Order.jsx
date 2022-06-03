import "./order.scss"
import Sidebar from "../../components/sidebar/Sidebar"
import Navbar from "../../components/navbar/Navbar"

const Order = () => {
   
    return (
      <div className="order">
          <Sidebar />
          <div className="orderContainer">
            <Navbar/>
          </div>
     </div>
    );
    }

export default Order;