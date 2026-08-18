/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 *
 * Die Bestellungen weden hier agezeigt
 */
import "./deliveredOrders.scss";
import Sidebar from "../sidebar/Sidebar";
import Navbar from "../navbar/Navbar";
import OrderList from "../order/OrderList";

const ARCHIVED_WHERE = [
  ["payed", "==", true],
  ["delivered", "==", true],
];
const renderArchivedCount = (count) => `Nombre de Commandes archivées: ${count}`;

const DelivredOrder = ({ typeColumns }) => {
  return (
    <div className="order">
      <Sidebar />
      <div className="orderContainer">
        <Navbar />
        <div className="listContainer">
          <div className="listTitle">Commandes</div>
          <OrderList
            typeColumns={typeColumns}
            collectionName="archivedOrders"
            whereFilters={ARCHIVED_WHERE}
            renderCountLabel={renderArchivedCount}
          />
        </div>
      </div>
    </div>
  );
};

export default DelivredOrder;
