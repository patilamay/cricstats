import React from 'react';
import './Home.css'; 

const Home = () => {
    return (
        <section id="introduction" className="home-section">
            <h2 className="home-title">Welcome to CricStats</h2>
            <p className="home-subtitle">Your one-stop destination for comprehensive cricket player statistics and analysis.</p>
            <p className="home-subtitle">Explore detailed statistics, rankings, and insights into the world of cricket. Stay updated with the latest news and trends in the cricket world.</p>

            <h3 className="section-title">Top Batting Records</h3>
            <div className="record-section">
                <div className="record-card">
                    <h4>Most Runs in Test</h4>
                    <p>Player: Player A</p>
                    <p>Runs: 15,000</p>
                </div>
                <div className="record-card">
                    <h4>Most Runs in ODI</h4>
                    <p>Player: Player B</p>
                    <p>Runs: 12,000</p>
                </div>
                <div className="record-card">
                    <h4>Most Runs in T20</h4>
                    <p>Player: Player C</p>
                    <p>Runs: 3,000</p>
                </div>
            </div>

            <h3 className="section-title">Top Bowling Records</h3>
            <div className="record-section">
                <div className="record-card">
                    <h4>Most Wickets in Test</h4>
                    <p>Player: Player D</p>
                    <p>Wickets: 800</p>
                </div>
                <div className="record-card">
                    <h4>Most Wickets in ODI</h4>
                    <p>Player: Player E</p>
                    <p>Wickets: 700</p>
                </div>
                <div className="record-card">
                    <h4>Most Wickets in T20</h4>
                    <p>Player: Player F</p>
                    <p>Wickets: 400</p>
                </div>
            </div>
        </section>
    );
};

export default Home;
