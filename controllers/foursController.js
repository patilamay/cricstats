const client = require('../db'); 

const getTotalFours = async (req, res) => {
  try {
    const database = client.db('AllMatches');
    const collection = database.collection('Matches');
    
    const pipeline = [
      { $unwind: "$innings" },
      { $unwind: "$innings.overs" },
      { $unwind: "$innings.overs.deliveries" },
      { $match: { "innings.overs.deliveries.runs.batter": 4 } },
      { $group: { _id: "$innings.overs.deliveries.batter", totalFours: { $sum: 1 } } },
      { $sort: { totalFours: -1 } }
    ];

    const result = await collection.aggregate(pipeline).toArray();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

const getMostFours = async (req, res) => {
try {
    const database = client.db('AllMatches');
    const collection = database.collection('Matches');

    const pipeline = [
      { $unwind: "$innings" },
      { $unwind: "$innings.overs" },
      { $unwind: "$innings.overs.deliveries" },
      { $match: {
          "innings.overs.deliveries.runs.batter": 4 // Filter for deliveries where batter scored exactly 4 runs
        }
      },
      { $group: {
          _id: { player: "$innings.overs.deliveries.batter", match_type: "$info.match_type" },
          mostFours: { $sum: 1 } // Count each four
        }
      },
      { $sort: { mostFours: -1 } }, // Sort by total fours in descending order
      { $group: {
          _id: "$_id.match_type", // Group by match type
          player: { $first: "$_id.player" }, // Get the player with the most fours per match type
          fours: { $first: "$mostFours" } // Get the most fours of that player
        }
      }
    ];

    const result = await collection.aggregate(pipeline).toArray();
    res.json(result);

  } catch (error) {
    res.status(500).send('Error retrieving most fours');
  }
};

module.exports = { 
    getTotalFours,
    getMostFours 
};
