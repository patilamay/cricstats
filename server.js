const express = require('express');
const redis = require('redis');
const cors = require('cors');
require('dotenv').config();

const batsmanRoutes = require('./routes/batsmanRoutes');
const bowlerRoutes = require('./routes/bowlerRoutes');
const foursRoutes = require('./routes/foursRoutes');
const sixesRoutes = require('./routes/sixesRoutes');
const economyRoutes = require('./routes/economyRoutes');
const playerstatsRoutes = require('./routes/playerstatsRoutes');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Use the routes
app.use('/api/batsman', batsmanRoutes);
app.use('/api/bowler', bowlerRoutes);
app.use('/api/fours', foursRoutes);
app.use('/api/sixes', sixesRoutes);
app.use('/api/economy', economyRoutes);
app.use('/api/player',playerstatsRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
