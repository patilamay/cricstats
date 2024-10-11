const express = require('express');
const { getAllPlayersDetailedStats } = require('../controllers/allPlayersDetailedStatsController');

const router = express.Router();

router.get('/playersdetailedstats/:matchType', getAllPlayersDetailedStats);

module.exports = router;