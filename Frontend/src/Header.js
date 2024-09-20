import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

const Header = () => {
    const [isSticky, setIsSticky] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 50) {
                setIsSticky(true);
            } else {
                setIsSticky(false);
            }
        };
        window.addEventListener('scroll', handleScroll);

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    return (
        <header className={isSticky ? 'sticky' : ''}>
            <div className="logo">CricStats</div>
            <nav>
                <ul>
                    <li><Link to="/">Home</Link></li>
                    <li><Link to="/statistics">Statistics</Link></li>
                    <li><Link to="/ipl">IPL</Link></li>
                    <li><Link to="/ranking">Ranking</Link></li>
                    <li><Link to="/glossary">Glossary</Link></li>
                    <li><Link to="/about">About</Link></li>
                </ul>
            </nav>
            <form className="search-form">
                <input type="text" placeholder="Search..." className="search-input" />
                <button type="submit" className="search-button">🔍</button>
            </form>
        </header>
    );
};

export default Header;
