const express = require('express');
const { getTotalWicketsByPlayer,getTopBowler } = require('../controllers/bowlerController');
const router = express.Router();

router.get('/top-bowler', getTopBowler);
router.get('/total-wickets',getTotalWicketsByPlayer);

module.exports = router;