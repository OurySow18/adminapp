/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 *
 * Die Bestellungen weden hier agezeigt
 */
import "./order.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import OrderList from "../../components/order/OrderList";

const PENDING_WHERE = [["payed", "==", false]];
const isNotFakeOrder = (orderData) => orderData?.fakeOrder !== true;
const renderPendingCount = (count) => `Nombre de Commandes: ${count}`;

const FAKE_WHERE = [["fakeOrder", "==", true]];
const renderFakeCount = (count) => `Nombre de fausses commandes: ${count}`;

const Order = ({ typeColumns, listTitle = "Commandes", showFakeOrders = false }) => {
  return (
    <div className="order">
      <Sidebar />
      <div className="orderContainer">
        <Navbar />
        <div className="listContainer">
          <div className="listTitle">{listTitle}</div>
          <OrderList
            typeColumns={typeColumns}
            collectionName="orders"
            whereFilters={showFakeOrders ? FAKE_WHERE : PENDING_WHERE}
            clientFilter={showFakeOrders ? undefined : isNotFakeOrder}
            renderCountLabel={showFakeOrders ? renderFakeCount : renderPendingCount}
            showSearch
          />
        </div>
      </div>
    </div>
  );
};

export default Order;
