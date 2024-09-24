import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBarsStaggered, faTimes } from '@fortawesome/free-solid-svg-icons';
import './Header.css';

const Header = () => {
    const [isSticky, setIsSticky] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

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

    const toggleMenu = () => {
        setMenuOpen(!menuOpen);
    };

    return (
        <header className={isSticky ? 'sticky' : ''}>
            <Link to="/" className="logo">CricStats</Link>
            <div className="hamburger" onClick={toggleMenu}>
                <FontAwesomeIcon icon={menuOpen ? faTimes : faBarsStaggered} size="2x"/>
            </div>
            <nav className={menuOpen ? 'nav-open' : ''}>
                <ul>
                    <li><Link to="/statistics" onClick={toggleMenu}>Statistics</Link></li>
                    <li><Link to="/ipl" onClick={toggleMenu}>IPL</Link></li>
                    <li><Link to="/ranking" onClick={toggleMenu}>Ranking</Link></li>
                    <li><Link to="/glossary" onClick={toggleMenu}>Glossary</Link></li>
                    <li><Link to="/about" onClick={toggleMenu}>About</Link></li>
                </ul>
            </nav>
        </header>
    );
};

export default Header;
