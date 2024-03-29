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
        <p className="total">Total sales made today</p>
        <p className="amount">€890</p>
        <p className="desc">Previous transactions processing. Last payments may not be included</p>
        <div className="summary">
          <div className="item">
            <div className="itemTitle">Target</div>
            <div className="itemResult negative">
              <KeyboardArrowDownIcon font-size ="small"/>
              <div className="resultAmount">€12.4k</div>
            </div>
          </div>
          <div className="item">
            <div className="itemTitle">Last Week</div>
            <div className="itemResult positive">
              <KeyboardArrowDownIcon font-size ="small"/>
              <div className="resultAmount">€583.9k</div>
            </div>
          </div>
          <div className="item">
            <div className="itemTitle">Last Month</div>
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