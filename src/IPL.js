// src/IPL.js
import React from 'react';

const IPL = () => {
    return (
        <section id="ipl">
            <h2>IPL</h2>
            <p>Information and statistics about the Indian Premier League.</p>
            <h3>Team Standings</h3>
            <div className="team-card">
                <h4>Team A</h4>
                <p>Matches Played: 14</p>
                <p>Wins: 10</p>
                <p>Losses: 4</p>
            </div>
            <div className="team-card">
                <h4>Team B</h4>
                <p>Matches Played: 14</p>
                <p>Wins: 9</p>
                <p>Losses: 5</p>
            </div>
            
            <h3>Player Statistics</h3>
            <div className="player-card">
                <h4>Player 1</h4>
                <p>Runs Scored: 500</p>
                <p>Wickets Taken: 20</p>
            </div>
            <div className="player-card">
                <h4>Player 2</h4>
                <p>Runs Scored: 450</p>
                <p>Wickets Taken: 15</p>
            </div>
            
        </section>
    );
};

export default IPL;
