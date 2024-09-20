const express = require('express');
const cors = require('cors');
require('dotenv').config();

const batsmanRoutes = require('./routes/batsmanRoutes');
const bowlerRoutes = require('./routes/bowlerRoutes');
const foursRoutes = require('./routes/foursRoutes');
const sixesRoutes = require('./routes/sixesRoutes');
const economyRoutes = require('./routes/economyRoutes');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Use the routes
app.use('/api', batsmanRoutes);
app.use('/api', bowlerRoutes);
app.use('/api', foursRoutes);
app.use('/api', sixesRoutes);
app.use('/api', economyRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
