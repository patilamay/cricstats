// Home.js
import React, { useState, useEffect } from 'react';
import './Home.css';
import { getTotalRuns, getTotalWickets, getTotalSixes, getTotalFours } from './api'; // Your API utility functions
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPersonRunning, faVolleyball, faDiceSix, faDiceFour } from '@fortawesome/free-solid-svg-icons';

const Home = () => {
    const [stats, setStats] = useState({
        ODI: { batsman: null, bowler: null, sixes: null, fours: null },
        Test: { batsman: null, bowler: null, sixes: null, fours: null },
        T20: { batsman: null, bowler: null, sixes: null, fours: null },
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const matchTypes = ['Test', 'ODI', 'T20'];

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const promises = matchTypes.map(async (type) => {
                    const batsmanData = await getTotalRuns(type, 1);
                    const bowlerData = await getTotalWickets(type, 1);
                    const sixesData = await getTotalSixes(type, 1);
                    const foursData = await getTotalFours(type, 1);
                    return { type, 
                        batsman: batsmanData[0], 
                        bowler: bowlerData[0],
                        sixes: sixesData[0],
                        fours: foursData[0] };
                });

                const results = await Promise.all(promises);

                const newStats = { ODI: {}, Test: {}, T20: {} };
                results.forEach(({ type, batsman, bowler, sixes, fours }) => {
                    newStats[type].batsman = batsman;
                    newStats[type].bowler = bowler;
                    newStats[type].sixes = sixes;
                    newStats[type].fours = fours;
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

    if (loading) {
        return (
            <div className="home-container">
                <section id="introduction" className="home-section">
                    <h2 className="home-title"><Skeleton width={300} height={30} /></h2>
                    <p className="home-subtitle"><Skeleton count={2} /></p>
                </section>
                <section id="top-records" className="home-section">
                    <h3 className="section-title"><Skeleton width={200} height={25} /></h3>
                    {matchTypes.map((type) => (
                        <div key={type} className="match-type-section">
                            <h4><Skeleton width={150} height={20} /></h4>
                            <div className="record-section">
                                <div className="record-card">
                                    <h5><Skeleton width={100} height={20} /></h5>
                                    <p><Skeleton width={150} /></p>
                                    <p><Skeleton width={100} /></p>
                                </div>
                                <div className="record-card">
                                    <h5><Skeleton width={100} height={20} /></h5>
                                    <p><Skeleton width={150} /></p>
                                    <p><Skeleton width={100} /></p>
                                </div>
                                <div className="record-card">
                                    <h5><Skeleton width={100} height={20} /></h5>
                                    <p><Skeleton width={150} /></p>
                                    <p><Skeleton width={100} /></p>
                                </div>
                                <div className="record-card">
                                    <h5><Skeleton width={100} height={20} /></h5>
                                    <p><Skeleton width={150} /></p>
                                    <p><Skeleton width={100} /></p>
                                </div>
                            </div>
                        </div>
                    ))}
                </section>
            </div>
        );
    }

    if (error) return <div className="error-message">{error}</div>;

    return (
        <div className="home-container">
            <section id="introduction" className="home-section">
                <h2 className="home-title">Welcome to CricStats</h2>
                <p className="home-subtitle">
                    Your one-stop destination for comprehensive cricket player statistics and analysis.
                </p>
                <p className="home-subtitle">
                    Explore detailed statistics, rankings, and insights into the world of cricket. Stay
                    updated with the latest news and trends in the cricket world.
                </p>
            </section>
            <section id="top-records" className="home-section">
                <h3 className="section-title">Top Records by Match Type</h3>
                {matchTypes.map((type) => (
                    <div key={type} className="match-type-section">
                        <h4>{type} Matches</h4>
                        <div className="record-section">
                            <div className="record-card batsman-card">
                                <h5>Top Batsman<FontAwesomeIcon icon={faPersonRunning} /></h5>
                                {stats[type].batsman ? (
                                    <>
                                        <p>Player: {stats[type].batsman._id.player}</p>
                                        <p>Runs: {stats[type].batsman.totalRuns}</p>
                                    </>
                                ) : (
                                    <p>No data available.</p>
                                )}
                            </div>
                            <div className="record-card bowler-card">
                                <h5>Top Bowler<FontAwesomeIcon icon={faVolleyball} /></h5>
                                {stats[type].bowler ? (
                                    <>
                                        <p>Player: {stats[type].bowler._id.player}</p>
                                        <p>Wickets: {stats[type].bowler.totalWickets}</p>
                                    </>
                                ) : (
                                    <p>No data available.</p>
                                )}
                            </div>
                            <div className="record-card sixes-card">
                                <h5>Most Sixes<FontAwesomeIcon icon={faDiceSix} /></h5>
                                {stats[type].sixes ? (
                                    <>
                                        <p>Player: {stats[type].sixes._id.player}</p>
                                        <p>Sixes: {stats[type].sixes.totalSixes}</p>
                                    </>
                                ) : (
                                    <p>No data available.</p>
                                )}
                            </div>
                            <div className="record-card fours-card">
                                <h5>Most Fours<FontAwesomeIcon icon={faDiceFour} /></h5>
                                {stats[type].fours ? (
                                    <>
                                        <p>Player: {stats[type].fours._id.player}</p>
                                        <p>Fours: {stats[type].fours.totalFours}</p>
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
