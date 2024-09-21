// Home.js
import React, { useState, useEffect } from 'react';
import './Home.css';
import { getTotalRuns, getTotalWickets } from './api';

const Home = () => {
    const [stats, setStats] = useState({
        ODI: { batsman: null, bowler: null },
        Test: { batsman: null, bowler: null },
        T20: { batsman: null, bowler: null },
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const matchTypes = ['ODI', 'Test', 'T20'];

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const promises = matchTypes.map(async (type) => {
                    const batsmanData = await getTotalRuns(type, 1);
                    const bowlerData = await getTotalWickets(type, 1);
                    return { type, batsman: batsmanData[0], bowler: bowlerData[0] };
                });

                const results = await Promise.all(promises);

                const newStats = { ODI: {}, Test: {}, T20: {} };
                results.forEach(({ type, batsman, bowler }) => {
                    newStats[type].batsman = batsman;
                    newStats[type].bowler = bowler;
                });

                setStats(newStats);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching data:', err);
                setError('Failed to fetch cricket stats. Please try again later.');
                setLoading(false);
            }
        };

        fetchStats();
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
                <h3 className="section-title">Top Records by Match Type</h3>
                {matchTypes.map((type) => (
                    <div key={type} className="match-type-section">
                        <h4>{type} Matches</h4>
                        <div className="record-section">
                            <div className="record-card">
                                <h5>Top Batsman</h5>
                                {stats[type].batsman ? (
                                    <>
                                        <p>Player: {stats[type].batsman._id.player}</p>
                                        <p>Runs: {stats[type].batsman.totalRuns}</p>
                                    </>
                                ) : (
                                    <p>No data available.</p>
                                )}
                            </div>
                            <div className="record-card">
                                <h5>Top Bowler</h5>
                                {stats[type].bowler ? (
                                    <>
                                        <p>Player: {stats[type].bowler._id.bowler}</p>
                                        <p>Wickets: {stats[type].bowler.totalWickets}</p>
                                    </>
                                ) : (
                                    <p>No data available.</p>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </section>
        </div>
    );
};

export default Home;
