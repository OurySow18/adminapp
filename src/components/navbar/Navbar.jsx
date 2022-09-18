/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 * 
 * Navbar Komponent
 */
import "./navbar.scss";
import {useContext} from "react"
import {DarkModeContext} from "../../context/darkModeContext"

import Bild from "../../images/Bild_Sow.jpeg"

import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import FullscreenExitOutlinedIcon from '@mui/icons-material/FullscreenExitOutlined';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import FormatListBulletedOutlinedIcon from '@mui/icons-material/FormatListBulletedOutlined';

const Navbar = () => {
  const {dispatch} = useContext(DarkModeContext)
  return (
    <div className="navbar">
          <div className="wrapper">
            <div className="search">
              <input type="text" placeholder="Search..." />
              <SearchOutlinedIcon/>
            </div>
            <div className="items">
            <div className="item">
              <LanguageOutlinedIcon/>
              English
            </div>
            <div className="item">
              <DarkModeOutlinedIcon className="icon" onClick={() => dispatch({type:"TOGGLE"})}/>              
            </div>
            <div className="item">
              <FullscreenExitOutlinedIcon className="icon"/>              
            </div>
            <div className="item">
              <NotificationsNoneOutlinedIcon className="icon"/>  
              <div className="counter">1</div>            
            </div>
            <div className="item">
              <ChatBubbleOutlineOutlinedIcon className="icon"/>  
              <div className="counter">2</div>              
            </div>
            <div className="item">
              <FormatListBulletedOutlinedIcon className="icon"/>              
            </div>
            <div className="item">
              <img src={Bild} alt="" className="avatar" />            
            </div>
            </div>
          </div>
      </div>
  )
}

export default Navbar