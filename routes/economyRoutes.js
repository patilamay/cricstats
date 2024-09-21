const express = require('express');
const { getEconomyRate } = require('../controllers/economyController');
const router = express.Router();

router.get('/economy-rate', getEconomyRate);

module.exports = router;
