/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 * 
 * Startseite, Wräppt die App.js in DarkModeContextProvider und der Provider
 */
import React from 'react';
import ReactDOM from 'react-dom'; 
import App from './App'; 
import {DarkModeContextProvider} from "./context/darkModeContext";
import {AuthContextProvider} from "./context/AuthContext";

ReactDOM.render(
  <React.StrictMode>
    <DarkModeContextProvider>
      <AuthContextProvider>
        <App />
      </AuthContextProvider>
    </DarkModeContextProvider>
  </React.StrictMode>,
  document.getElementById('root')
);