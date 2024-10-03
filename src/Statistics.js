// Statistics.js
import React, { useState, useEffect } from 'react';
import './Statistics.css';
import { useParams } from 'react-router-dom'; // For getting the player ID from URL
import { getPlayerStats } from './api'; // API call to get player details

const Statistics = () => {
  const { playerName, matchType } = useParams();
  const [playerStats, setPlayerStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPlayerStats = async () => {
      try {
        const response = await  getPlayerStats(playerName, matchType);
        console.log("Raw Response:", response);
        setPlayerStats(response);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching player stats:", error);
        setError(error.message);
        setLoading(false);
      }
    };

    fetchPlayerStats();
  }, [playerName, matchType]);  // Fetch data when playerName changes

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="player-stats-container">
      <h1>{playerName}'s {matchType} Stats</h1>

      {/* Batting Stats Card */}
      <div className="stats-card batting-card">
        <h2>Batting Stats</h2>
        <p><strong>Matches Played:</strong> {playerStats.matchesPlayed}</p>
        <p><strong>Batting Innings:</strong> {playerStats.totalBattingInnings}</p>
        <p><strong>Total Runs:</strong> {playerStats.totalRuns}</p>
        <p><strong>Total Fours:</strong> {playerStats.totalFours}</p>
        <p><strong>Total Sixes:</strong> {playerStats.totalSixes}</p>
      </div>

      {/* Bowling Stats Card */}
      <div className="stats-card bowling-card">
        <h2>Bowling Stats</h2>
        <p><strong>Matches Played:</strong> {playerStats.matchesPlayed}</p>
        <p><strong>Bowling Innings:</strong> {playerStats.totalBowlingInnings}</p>
        <p><strong>Total Overs:</strong> {playerStats.totalOvers}</p>
        <p><strong>Total Wickets:</strong> {playerStats.totalWickets}</p>
      </div>
    </div>
  );
};

export default Statistics;