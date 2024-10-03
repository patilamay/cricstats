const express = require('express');
const { getPlayerStats } = require('../controllers/playerstatsController');

const router = express.Router();

router.get('/stats/:playerName/:matchType', getPlayerStats);

module.exports = router;
