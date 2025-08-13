import "./gameStartScreen_test.scss";
import Sidebar from "../sidebar/Sidebar";
import Navbar from "../navbar/Navbar";    
import GameStats_test from "../gameStats_test/GameStats_test";

const GameStartScreen_test = ({ typeColumns }) => {
  return (
    <div className="order">
      <Sidebar />
      <div className="orderContainer">
        <Navbar />
        <div className="listContainer">
          <div className="listTitle">Statistique Jeu</div>
          <GameStats_test  typeColumns={typeColumns} />
        </div>
      </div>
    </div>
  );
};

export default GameStartScreen_test;
