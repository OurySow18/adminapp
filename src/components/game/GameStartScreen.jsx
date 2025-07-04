import "./gameStartScreen.scss";
import Sidebar from "../sidebar/Sidebar";
import Navbar from "../navbar/Navbar";   
import GameStats from "../gameStats/GameStats";

const GameStartScreen = ({ typeColumns }) => {
  return (
    <div className="order">
      <Sidebar />
      <div className="orderContainer">
        <Navbar />
        <div className="listContainer">
          <div className="listTitle">Statistique Jeu</div>
          <GameStats  typeColumns={typeColumns} />
        </div>
      </div>
    </div>
  );
};

export default GameStartScreen;
