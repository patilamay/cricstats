import React, { useState, useEffect } from 'react';
import './Home.css';
import { getTotalRuns, getTotalWickets, getTotalSixes, getTotalFours, getEconomyRate } from './api';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPersonRunning, faVolleyball, faDiceSix, faDiceFour, faBaseball, faE } from '@fortawesome/free-solid-svg-icons';
import { useNavigate  } from 'react-router-dom';


const Home = () => {
    const [stats, setStats] = useState({
        ODI: { batsman: null, bowler: null, sixes: null, fours: null },
        Test: { batsman: null, bowler: null, sixes: null, fours: null },
        T20: { batsman: null, bowler: null, sixes: null, fours: null },
    });
    
    const navigate  = useNavigate();
    const handleCardClick = (playerName, matchType) => {
        console.log(`Navigating to statistics for player: ${playerName}`);
        navigate(`/statistics/${playerName}/${matchType}`);
    }; 
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('Test'); // For controlling active tab
    const handleTabClick = (tab) => {
        setActiveTab(tab);
    };

    const matchTypes = ['Test', 'ODI', 'T20'];

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const promises = matchTypes.map(async (type) => {
                    const batsmanData = await getTotalRuns(type, 1);
                    const bowlerData = await getTotalWickets(type, 1);
                    const sixesData = await getTotalSixes(type, 1);
                    const foursData = await getTotalFours(type, 1);
                    const economyData = await getEconomyRate(type, 1);
                    return { type, batsman: batsmanData[0], bowler: bowlerData[0], sixes: sixesData[0], fours: foursData[0], economy: economyData[0] };
                });

                const results = await Promise.all(promises);

                const newStats = { ODI: {}, Test: {}, T20: {} };
                results.forEach(({ type, batsman, bowler, sixes, fours, economy }) => {
                    newStats[type].batsman = batsman;
                    newStats[type].bowler = bowler;
                    newStats[type].sixes = sixes;
                    newStats[type].fours = fours;
                    newStats[type].economy = economy;
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
                <section id="top-records" className="home-section">
                    <h3 className="section-title"><Skeleton width={200} height={25} /></h3>
                    {matchTypes.map((type) => (
                        <div key={type} className="match-type-section">
                            <h4><Skeleton width={150} height={20} /></h4>
                            <div className="record-section">
                                {[...Array(3)].map((_, idx) => (
                                    <div key={idx} className="record-card">
                                        <h5><Skeleton width={120} /></h5>
                                        <p><Skeleton width={80} /></p>
                                        <p><Skeleton width={60} /></p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </section>
            </div>
        );
    }
    if (error) return <div className="error-message">{error}</div>;

    const renderCards = (type) => (
        <div className="record-section">
            <div className="record-card batsman-card" onClick={() => handleCardClick(stats[type].batsman._id.player, type)}>
                <h5>Most Runs Scored<FontAwesomeIcon icon={faPersonRunning} /></h5>
                {stats[type].batsman ? (
                    <>
                        <p>Player: {stats[type].batsman._id.player}</p>
                        <p>Runs: {stats[type].batsman.totalRuns}</p>
                    </>
                ) : (
                    <p>No data available.</p>
                )}
            </div>
            <div className="record-card bowler-card" onClick={() => handleCardClick(stats[type].bowler._id.player, type)}>
                <h5>Most Wickets Taken<FontAwesomeIcon icon={faBaseball} /></h5>
                {stats[type].bowler ? (
                    <>
                        <p>Player: {stats[type].bowler._id.player}</p>
                        <p>Wickets: {stats[type].bowler.totalWickets}</p>
                    </>
                ) : (
                    <p>No data available.</p>
                )}
            </div>
            <div className="record-card sixes-card" onClick={() => handleCardClick(stats[type].sixes._id.player)}>
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
            <div className="record-card fours-card" onClick={() => handleCardClick(stats[type].fours._id.player)}>
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
            <div className="record-card economy-card" onClick={() => handleCardClick(stats[type].economy._id.player)}>
                <h5>Best Economy<FontAwesomeIcon icon={faE} /></h5>
                {stats[activeTab].economy ? (
                    <>
                        <p>Player: {stats[activeTab].economy._id.player}</p>
                        <p>Economy: {stats[activeTab].economy.economyRate}</p>
                    </>
                ) : (
                    <p>No data available.</p>
                )}
            </div>

            <div className="record-card catches-card" onClick={() => handleCardClick(stats[type].catches._id.player)}>
                <h5>Most Catches<FontAwesomeIcon icon={faDiceFour} /></h5>
                {stats[activeTab].catches ? (
                    <>
                        <p>Player: {stats[activeTab].catches._id.player}</p>
                        <p>Catches: {stats[activeTab].catches.totalCatches}</p>
                    </>
                ) : (
                    <p>No data available.</p>
                )}
            </div>

            <div className="record-card team-score-card" onClick={() => handleCardClick(stats[type].totalScore._id.player)}>
                <h5>Highest Score<FontAwesomeIcon icon={faDiceFour} /></h5>
                {stats[activeTab].teamscore ? (
                    <>
                        <p>Team: {stats[activeTab].totalScore._id.player}</p>
                        <p>Score: {stats[activeTab].totalScore.totalScore}</p>
                    </>
                ) : (
                    <p>No data available.</p>
                )}
            </div>

            <div className="record-card player-score-card" onClick={() => handleCardClick(stats[type].playerscore._id.player)}>
                <h5>Highest score by Player<FontAwesomeIcon icon={faDiceFour} /></h5>
                {stats[activeTab].playerscore ? (
                    <>
                        <p>Player: {stats[activeTab].playerscore._id.player}</p>
                        <p>Score: {stats[activeTab].playerscore.totalScorebyPlayer}</p>
                    </>
                ) : (
                    <p>No data available.</p>
                )}
            </div>
        </div>
    );

    return (
        <div className="home-container">
            <section id="introduction" className="home-section">
                <h2 className="home-title"></h2>
            </section>
            <section id="top-records" className="home-section">
                 <div className="tabs">
                    {matchTypes.map((type) => (
                        <span
                            key={type}
                            className={`tab ${activeTab === type ? 'active' : ''}`}
                            onClick={() => setActiveTab(type)}
                        >
                            {type}
                        </span>
                    ))}
                </div>
                <div className={`card-container ${activeTab}`} key={activeTab}>
                    {renderCards(activeTab)}
                </div>
            </section>
        </div>
    );
};

export default Home;
