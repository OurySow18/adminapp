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