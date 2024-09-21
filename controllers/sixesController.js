const client = require('../db');

const getTotalSixes = async (req, res) => {    
  try {
    const database = client.db('AllMatches');
    const collection = database.collection('Matches');
    
    const pipeline = [
      { $unwind: "$innings" },
      { $unwind: "$innings.overs" },
      { $unwind: "$innings.overs.deliveries" },
      { $match: { "innings.overs.deliveries.runs.batter": 6 } },
      { $group: { _id: "$innings.overs.deliveries.batter", totalSixes: { $sum: 1 } } },
      { $sort: { totalSixes: -1 } }
    ];

    const result = await collection.aggregate(pipeline).toArray();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

const getMostSixes = async (req, res) => {
    try {
        const database = client.db('AllMatches');
        const collection = database.collection('Matches');
    
        const pipeline = [
          { $unwind: "$innings" },
          { $unwind: "$innings.overs" },
          { $unwind: "$innings.overs.deliveries" },
          { $match: {
              "innings.overs.deliveries.runs.batter": 6 // Filter for deliveries where batter scored exactly 6 runs
            }
          },
          { $group: {
              _id: { player: "$innings.overs.deliveries.batter", match_type: "$info.match_type" },
              mostSixes: { $sum: 1 } // Count each six
            }
          },
          { $sort: { mostSixes: -1 } }, // Sort by total sixes in descending order
          { $group: {
              _id: "$_id.match_type", // Group by match type
              player: { $first: "$_id.player" }, // Get the player with the most sixes per match type
              sixes: { $first: "$mostSixes" } // Get the most sixes of that player
            }
          }
        ];
    
        const result = await collection.aggregate(pipeline).toArray();
        res.json(result);
    
      } catch (error) {
        res.status(500).send('Error retrieving most sixes');
      }
};
    
module.exports = { 
    getTotalSixes,
    getMostSixes 
};
    