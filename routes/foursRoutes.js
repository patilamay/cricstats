const express = require('express');
const { getTotalFours, getMostFours } = require('../controllers/foursController');
const router = express.Router();

router.get('/most-fours', getMostFours);
router.get('/total-fours',getTotalFours);
module.exports = router;
