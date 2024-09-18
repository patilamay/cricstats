// src/Statistics.js
import React from 'react';

const Statistics = () => {
    return (
        <section id="statistics">
            <h2>Statistics</h2>
            <p>Detailed statistics for cricket players and teams.</p>
            <h3>Batting Statistics</h3>
            <div className="stat-card">
                <h4>Player 1</h4>
                <p>Matches Played: 100</p>
                <p>Runs Scored: 5000</p>
                <p>Average: 50.0</p>
            </div>
            <div className="stat-card">
                <h4>Player 2</h4>
                <p>Matches Played: 80</p>
                <p>Runs Scored: 4000</p>
                <p>Average: 45.0</p>
            </div>
           
            <h3>Bowling Statistics</h3>
            <div className="stat-card">
                <h4>Player 1</h4>
                <p>Matches Played: 100</p>
                <p>Wickets Taken: 200</p>
                <p>Average: 25.0</p>
            </div>
            <div className="stat-card">
                <h4>Player 2</h4>
                <p>Matches Played: 80</p>
                <p>Wickets Taken: 150</p>
                <p>Average: 28.0</p>
            </div>
           
        </section>
    );
};

export default Statistics;
