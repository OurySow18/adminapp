/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 * 
 * Hier ist die Table mit der produktdaten abgerufen
 */
import "./users.scss"
import Sidebar from "../../components/sidebar/Sidebar"
import Navbar from "../../components/navbar/Navbar"

const Users = () => {
   
    return (
      <div className="users">
          <Sidebar />
          <div className="usersContainer">
            <Navbar/>
          </div>
     </div>
    );
    }

export default Users;