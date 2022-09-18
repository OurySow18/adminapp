/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 * 
 * Die Notifikation werden hier angezeigt
 */
import "./notifications.scss"
import Sidebar from "../../components/sidebar/Sidebar"
import Navbar from "../../components/navbar/Navbar"

const Notifications = () => {
   
    return (
      <div className="notifications">
          <Sidebar />
          <div className="notificationsContainer">
            <Navbar/>
          </div>
     </div>
    );
    }

export default Notifications;