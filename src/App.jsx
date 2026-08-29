import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from './components/LandingPage';
import Homepage from './components/Homepage';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/homepage" element={<Homepage />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App
