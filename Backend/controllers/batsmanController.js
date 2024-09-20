const client = require('../db');

// Get total runs scored by each player, grouped by match_type
const getTotalRunsByPlayer = async (req, res) => {
  try {
    const database = client.db('AllMatches');
    const collection = database.collection('Matches');

    const pipeline = [
      { $unwind: "$innings" },
      { $unwind: "$innings.overs" },
      { $unwind: "$innings.overs.deliveries" },
      { $group: {
          _id: { player: "$innings.overs.deliveries.batter", match_type: "$info.match_type" },
          totalRuns: { $sum: "$innings.overs.deliveries.runs.batter" }
        }
      },
      { $sort: { totalRuns: -1 } }
    ];

    const result = await collection.aggregate(pipeline).toArray();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get the top batsman by total runs
const getTopBatsman = async (req, res) => {
  try {
    const database = client.db('AllMatches');
    const collection = database.collection('Matches');

    const pipeline = [
      { $unwind: "$innings" },
      { $unwind: "$innings.overs" },
      { $unwind: "$innings.overs.deliveries" },
      { $group: {
          _id: { player: "$innings.overs.deliveries.batter", match_type: "$info.match_type" },
          totalRuns: { $sum: "$innings.overs.deliveries.runs.batter" }
        }
      },
      { $sort: { totalRuns: -1 } },
      { $group: {
        _id: "$_id.match_type",
        player: { $first: "$_id.player" },
        runs: { $first: "$totalRuns" }
      }
    }
];

    const result = await collection.aggregate(pipeline).toArray();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getTotalRunsByPlayer,
  getTopBatsman
};
