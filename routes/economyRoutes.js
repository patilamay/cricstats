const express = require('express');
const { getEconomyRate } = require('../controllers/economyController');
const router = express.Router();

router.get('/economy-rates', getEconomyRate);

module.exports = router;
