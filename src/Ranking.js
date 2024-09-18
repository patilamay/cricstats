// src/Ranking.js
import React from 'react';

const Ranking = () => {
    return (
        <section id="ranking">
            <h2>Ranking</h2>
            <p>Current rankings of cricket players and teams.</p>
            <h3>Batting Rankings</h3>
            <div className="ranking-card">
                <h4>Player 1</h4>
                <p>Rank: 1</p>
                <p>Rating: 900</p>
            </div>
            <div className="ranking-card">
                <h4>Player 2</h4>
                <p>Rank: 2</p>
                <p>Rating: 850</p>
            </div>
            
            <h3>Bowling Rankings</h3>
            <div className="ranking-card">
                <h4>Player 1</h4>
                <p>Rank: 1</p>
                <p>Rating: 900</p>
            </div>
            <div className="ranking-card">
                <h4>Player 2</h4>
                <p>Rank: 2</p>
                <p>Rating: 850</p>
            </div>
           
        </section>
    );
};

export default Ranking;
