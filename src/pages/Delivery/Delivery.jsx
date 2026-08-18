/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 *
 * Delivery Daten werden hier abgerufen
 *
 */
import "./delivery.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import OrderList from "../../components/order/OrderList";

const IN_PROGRESS_WHERE = [["payed", "==", true]];
const renderInProgressCount = (count) => `Nombre de Livraisons a effectuées: ${count}`;

const Delivery = ({ typeColumns }) => {
  return (
    <div className="delivery">
      <Sidebar />
      <div className="deliveryContainer">
        <Navbar />
        <div className="listContainer">
          <div className="listTitle">Livraisons</div>
          <OrderList
            typeColumns={typeColumns}
            collectionName="orders"
            whereFilters={IN_PROGRESS_WHERE}
            renderCountLabel={renderInProgressCount}
          />
        </div>
      </div>
    </div>
  );
};

export default Delivery;
