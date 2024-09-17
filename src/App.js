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
                        <Route path="/" element={Home} />
                        <Route path="/Statistics" element={Statistics} />
                        <Route path="/IPL" element={IPL} />
                        <Route path="/Ranking" element={Ranking} />
                        <Route path="/Glossary" element={Glossary} />
                        <Route path="/About" element={About} />
                    </Routes>
                </main>
                <Footer />
            </div>
        </Router>
    );
};

export default App;
