const client = require('../db');

const getAllPlayersDetailedStats = async (req, res) => {
  try {
    const database = client.db('AllMatches');
    const collection = database.collection('Matches');

    const { matchType } = req.params;

    // Log to check if matchType is passed correctly
    console.log("Match Type:", matchType);
    const { page = 1, limit = 10, sortColumn = 'playerName', sortOrder = 'asc' } = req.query;

    // Pagination variables
    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;

    const validSortColumn = sortColumn && sortColumn.trim() !== '' ? sortColumn : 'playerName';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const pipeline = [
      // Step 1: Match the document by match type
      { $match: { 'info.match_type': matchType } },

      {
        $facet: {
          // Collect all players and their stats
          detailedStats: [
            { $unwind: '$innings' },
            { $unwind: '$innings.overs' },
            { $unwind: '$innings.overs.deliveries' },

            // Group by player name and innings to calculate stats
            {
              $group: {
                _id: '$innings.overs.deliveries.batter',
                totalRuns: { $sum: '$innings.overs.deliveries.runs.batter' },
                totalBallsFaced: { $sum: 1 },  // Balls faced (for strike rate)
                totalFours: { $sum: { $cond: [{ $eq: ['$innings.overs.deliveries.runs.batter', 4] }, 1, 0] } },
                totalSixes: { $sum: { $cond: [{ $eq: ['$innings.overs.deliveries.runs.batter', 6] }, 1, 0] } },
                totalHundreds: { $sum: { $cond: [{ $gte: ['$innings.overs.deliveries.runs.batter', 100] }, 1, 0] } },
                totalFifties: { $sum: { $cond: [{ $and: [{ $gte: ['$innings.overs.deliveries.runs.batter', 50] }, { $lt: ['$innings.overs.deliveries.runs.batter', 100] }] }, 1, 0] } },
                totalWickets: { $sum: { $cond: [{ $ifNull: ['$innings.overs.deliveries.wicket', null] }, 1, 0] } },
                totalBallsBowled: { $sum: 1 },  // Balls bowled for economy rate
                totalRunsConceded: { $sum: '$innings.overs.deliveries.runs.total' },  // Total runs conceded for bowling
                bestBowling: { $max: '$innings.overs.deliveries.wicket' }
              }
            },

            // Further calculations for each player
            {
              $project: {
                playerName: '$_id',
                totalRuns: 1,
                totalFours: 1,
                totalSixes: 1,
                totalHundreds: 1,
                totalFifties: 1,
                totalWickets: 1,
                totalBallsFaced: 1,
                totalBallsBowled: 1,
                totalRunsConceded: 1,
                bestBowling: 1,
                battingAverage: { $cond: [{ $ne: ['$totalFifties', 0] }, { $divide: ['$totalRuns', '$totalFifties'] }, 0] },
                strikeRate: { $cond: [{ $ne: ['$totalBallsFaced', 0] }, { $multiply: [{ $divide: ['$totalRuns', '$totalBallsFaced'] }, 100] }, 0] },
                bowlingAverage: { $cond: [{ $ne: ['$totalWickets', 0] }, { $divide: ['$totalRunsConceded', '$totalWickets'] }, 0] },
                economyRate: { $cond: [{ $ne: ['$totalBallsBowled', 0] }, { $multiply: [{ $divide: ['$totalRunsConceded', '$totalBallsBowled'] }, 6] }, 0] },
                fiveWicketHauls: { $cond: [{ $gte: ['$totalWickets', 5] }, 1, 0] }
              }
            },

            // Step 5: Sort by the specified column
            { $sort: { [validSortColumn]: sortDirection } },
      
            // Step 6: Skip and limit for pagination
            { $skip: skip },
            { $limit: pageSize }
          ]
        }
      }
    ];

    // Execute the aggregation pipeline
    const results = await collection.aggregate(pipeline).toArray();
    const totalCount = await collection.countDocuments({ 'info.match_type': matchType });

    // Check if results contain data
    if (!results[0] || results[0].detailedStats.length === 0) {
      return res.status(404).json({ error: 'No stats found for the given match type' });
    }

    res.json( {results,totalCount} );
  } catch (error) {
    console.error('Error fetching player stats:', error);
    res.status(500).json({ error: 'Failed to fetch player stats' });
  }
};

module.exports = {
  getAllPlayersDetailedStats
};
