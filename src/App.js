// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import Home from './Home';
import Statistics from './Statistics';
import IPL from './IPL';
import Ranking from './Ranking';
import Glossary from './Glossary';
import About from './About';
import './App.css';

const App = () => {
    return (
        <Router>
            <div>
                <Header />
                <main>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/statistics/:playerName/:matchType" element={<Statistics />} />
                        <Route path="/ipl" element={<IPL />} />
                        <Route path="/ranking" element={<Ranking />} />
                        <Route path="/glossary" element={<Glossary />} />
                        <Route path="/about" element={<About />} />
                    </Routes>
                </main>
                <Footer />
            </div>
        </Router>
    );
};

export default App;
