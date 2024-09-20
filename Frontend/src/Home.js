import React, { useState, useEffect } from 'react';
import './Home.css';
import { getTopBatsman, getTopBowler, getMostFours, getMostSixes } from './api';

const Home = () => {
    const [topBatsmen, setTopBatsmen] = useState([]);
    const [topBowlers, setTopBowlers] = useState([]);
    const [mostFours, setMostFours]   = useState([]);
    const [mostSixes, setMostSixes]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const batsmenData = await getTopBatsman();
                const bowlersData = await getTopBowler();
                const foursData   = await getMostFours();
                const sixesData   = await getMostSixes();
                setTopBatsmen(batsmenData);
                setTopBowlers(bowlersData);
                setMostFours(foursData);
                setMostSixes(sixesData);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching data:', error);
                setError('Failed to fetch cricket stats. Please try again later.');
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return <div>Loading cricket stats...</div>;
    if (error) return <div>{error}</div>;

    return (
        <div className="home-container">
            <section id="introduction" className="home-section">
                <h2 className="home-title">Welcome to CricStats</h2>
                <p className="home-subtitle">Your one-stop destination for comprehensive cricket player statistics and analysis.</p>
                <p className="home-subtitle">Explore detailed statistics, rankings, and insights into the world of cricket. Stay updated with the latest news and trends in the cricket world.</p>
            </section>
            <section id="top-records" className="home-section">
                <h3 className="section-title">Top Batting Records</h3>
                <div className="record-section">
                    {topBatsmen.map((batsman, index) => (
                        <div key={index} className="record-card">
                            <h4>Most Runs in {batsman._id}</h4>
                            <p>Player: {batsman.player}</p>
                            <p>Runs: {batsman.runs}</p>
                        </div>
                    ))}
                </div>

                <h3 className="section-title">Top Bowling Records</h3>
                <div className="record-section">
                    {topBowlers.map((bowler, index) => (
                        <div key={index} className="record-card">
                            <h4>Most Wickets in {bowler._id}</h4>
                            <p>Player: {bowler.player}</p>
                            <p>Wickets: {bowler.wickets}</p>
                        </div>
                    ))}
                </div>

                <h3 className="section-title">Most Fours Records</h3>
                <div className="record-section">
                    {mostFours.map((batsman, index) => (
                        <div key={index} className="record-card">
                            <h4>Most Fours in {batsman._id}</h4>
                            <p>Player: {batsman.player}</p>
                            <p>Fours: {batsman.fours}</p>
                        </div>
                    ))}
                </div>

                <h3 className="section-title">Most Sixes Records</h3>
                <div className="record-section">
                    {mostSixes.map((batsman, index) => (
                        <div key={index} className="record-card">
                            <h4>Most Sixes in {batsman._id}</h4>
                            <p>Player: {batsman.player}</p>
                            <p>Sixes: {batsman.sixes}</p>
                        </div>
                    ))}
                </div>

            </section>
        </div>
    );
};

export default Home;