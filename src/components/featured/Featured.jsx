/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 * 
 * Statistiken über das Geld
 */
import "./featured.scss"
import { CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

import MoreVertIcon from '@mui/icons-material/MoreVert';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';


const Featured = () => {
  return (
    <div className="featured" >
      <div className="top">
        <h1 className="title" >Total Revenue</h1>
        <MoreVertIcon font-size ="small" />
      </div>
      <div className="bottom">
        <div className="featuredChart">
          <CircularProgressbar value={90} text={"90%"} strockWidth={1} />
        </div>
        <p className="total">Ventes totales réalisées aujourd'hui</p>
        <p className="amount">€890</p>
        <p className="desc">Traitement des transactions précédentes.</p>
        <div className="summary">
          <div className="item">
            <div className="itemTitle">Cible</div>
            <div className="itemResult negative">
              <KeyboardArrowDownIcon font-size ="small"/>
              <div className="resultAmount">€12.4k</div>
            </div>
          </div>
          <div className="item">
            <div className="itemTitle">La semaine dernière</div>
            <div className="itemResult positive">
              <KeyboardArrowDownIcon font-size ="small"/>
              <div className="resultAmount">€583.9k</div>
            </div>
          </div>
          <div className="item">
            <div className="itemTitle">Le mois dernier</div>
            <div className="itemResult positive">
              <KeyboardArrowDownIcon font-size ="small"/>
              <div className="resultAmount">€3900.6k</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Featured