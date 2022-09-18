/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 * 
 * ruft die Table mit der entsprechenden Daten und Forms{Products oder Users} 
 */
import "./list.scss"
import Sidebar from "../../components/sidebar/Sidebar"
import Navbar from "../../components/navbar/Navbar"
import Datatable from "../../components/datatable/Datatable"

const Liste = ({typeColumns, title}) => {
   
    return (
      <div className="list">
          <Sidebar />
          <div className="listContainer">
            <Navbar/>
            <Datatable typeColumns={typeColumns} title={title} />
          </div>
      </div>
    ) 
}
export default Liste;