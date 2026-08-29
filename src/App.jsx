import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from './components/LandingPage';
import Homepage from './pages/Homepage';
import Protect from './components/auth/ProtectedRoutes';
function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/homepage" element={<Protect><Homepage /></Protect>} />
            </Routes>
        </BrowserRouter>
    );
}

export default App
