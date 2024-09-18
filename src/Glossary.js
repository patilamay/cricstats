// src/Glossary.js
import React from 'react';

const Glossary = () => {
    return (
        <section id="glossary">
            <h2>Glossary</h2>
            <p>Definitions of cricket terms and jargon.</p>
            <h3>A</h3>
            <div className="glossary-card">
                <h4>All-rounder</h4>
                <p>A player who is proficient in both batting and bowling.</p>
            </div>
            <h3>B</h3>
            <div className="glossary-card">
                <h4>Bouncer</h4>
                <p>A fast, short-pitched delivery that bounces high towards the batsman's head.</p>
            </div>
            
        </section>
    );
};

export default Glossary;
