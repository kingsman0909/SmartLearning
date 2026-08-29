import React from 'react'
import {useState} from 'react';
import '../styles/Landing.css';
import DotGrid from './animatedComponents/Background';
import Text from './animatedComponents/Text';
import Login from './auth/login';
import Signup from './auth/signup';

const LandingPage = () => {
  const [login, setLogin] = useState(false);
  const [signup, setSignup] = useState(false);

  return (
    <div className='landing-page'>
      <DotGrid
        dotSize={5}
        gap={15}
        baseColor="#2F293A"
        activeColor="#5227FF"
        proximity={120}
        shockRadius={250}
        shockStrength={5}
        resistance={750}
        returnDuration={1.5}
      />
      
    <Text className='landing-title'
      text="ProbLearn"
      mediaType="video"
      src="/reel.mp4"
      poster="/reel-poster.jpg"
      fillScale={1.25}
      parallax={26}
      reveal="rise"
      trigger="view"
      drift={18}
      brightness={1}
      saturation={1}
      grayscale={false}
      duration={1.1}
      stagger={0.09}
      align="center"
      weight={700}
      tracking={-0.03}
      lineHeight={1.06}
      textScale={0.115}
    />
      <p>
         makes probability easier to understand through interactive
         lessons, practice questions, <br />and real-world scenarios. 
        Learn at your own pace and put your knowledge to the test.
      </p>
      <div className='landing-btn'>
        <button className='landing-login' onClick={()=>setLogin(true)}>Login</button>
        <button className='landing-signup' onClick={()=>setSignup(true)}>Sign-up</button>
      </div>
      {login && <Login setLogin={setLogin}/>}
      {signup && <Signup setSignup={setSignup}/>}
    </div>
  )
}

export default LandingPage;
