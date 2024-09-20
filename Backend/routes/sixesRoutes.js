const express = require('express');
const { getTotalSixes,getMostSixes } = require('../controllers/sixesController');
const router = express.Router();

router.get('/most-sixes', getMostSixes);
router.get('/total-sixes', getTotalSixes);

module.exports = router;
