const express = require('express');
const { getTotalRunsByPlayer, getTopBatsman } = require('../controllers/batsmanController');

const router = express.Router();

router.get('/total-runs', getTotalRunsByPlayer);
router.get('/top-batsman', getTopBatsman);

module.exports = router;
