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