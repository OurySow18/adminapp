/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 * 
 * Login Seite
 */
import  './login.scss'
import {useState, useContext} from "react"
import {signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../../firebase"
import { useNavigate } from "react-router-dom";
import {AuthContext} from "../../context/AuthContext"


const Login = () => {

  const [error, setError] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate()

  const {dispatch} = useContext(AuthContext)

   const handleLogin = (e) =>{
     e.preventDefault();
      //SignIn Methode
      signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        // Signed in 
        const user = userCredential.user;
        //versendet LOGIN Aktion
        dispatch({type:"LOGIN", payload:user})
        
        setError(false)
        //navigiert zu der Startseite
        navigate("/")
      }
    
  )
  .catch((error) => {
    const errorCode = error.code;
    const errorMessage = error.message;
    console.log(errorCode)
    console.log(errorMessage)
  });
   }
    return (
      <div className="login">
          <form onSubmit={handleLogin}>
            <input type="email" placeholder="email" onChange={e=>setEmail(e.target.value)} />
            <input type="password" placeholder="password" onChange={e=>setPassword(e.target.value)} />
            <button type="submit">Login</button>
            {error && <span>Wrong email or password!</span>}
          </form>
      </div>
    ) 
}
export default Login;