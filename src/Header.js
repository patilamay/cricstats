// src/Header.js
import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

const Header = () => {
    return (
        <header>
            <div className="logo">CricStats</div>
            <nav>
                <ul>
                    <li><Link to="/">Home</Link></li>
                    <li><Link to="/statistics">Statistics</Link></li>
                    <li><Link to="/ipl">IPL</Link></li>
                    <li><Link to="/ranking">Ranking</Link></li>
                    <li><Link to="/glossary">Glossary</Link></li>
                    <li><Link to="/about">About</Link></li>
                    <li>
                        <form className="search-form">
                            <input type="text" placeholder="Search..." className="search-input" />
                            <button type="submit" className="search-button">🔍</button>
                        </form>
                    </li>
                </ul>
            </nav>
        </header>
    );
};

export default Header;
