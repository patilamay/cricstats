const client = require('../db');

// Get total wickets taken by each player, grouped by match_type
const getTotalWicketsByPlayer = async (req, res) => {
    try {
      const database = client.db('AllMatches');
      const collection = database.collection('Matches');
  
      const pipeline = [
        { $unwind: "$innings" },
        { $unwind: "$innings.overs" },
        { $unwind: "$innings.overs.deliveries" },
        { $group: {
            _id: { player: "$innings.overs.deliveries.bowler", match_type: "$info.match_type" },
            totalWickets: { $sum: "$innings.overs.deliveries.wickets" }
          }
        },
        { $sort: { totalWickets: -1 } }
      ];
  
      const result = await collection.aggregate(pipeline).toArray();
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
};

const getTopBowler = async (req, res) => {
    try {
        const database = client.db('AllMatches');
        const collection = database.collection('Matches');
    
        const pipeline = [
          { $unwind: "$innings" },
          { $unwind: "$innings.overs" },
          { $unwind: "$innings.overs.deliveries" },
          { $group: {
              _id: { player: "$innings.overs.deliveries.bowler", match_type: "$info.match_type" },
              totalWickets: { $sum: { $cond: [{ $ifNull: ["$innings.overs.deliveries.wickets", false] }, 1, 0] } }
            }
          },
          { $sort: { totalWickets: -1 } },
          { $group: {
              _id: "$_id.match_type",
              player: { $first: "$_id.player" },
              wickets: { $first: "$totalWickets" }
            }
          }
        ];
    
        const result = await collection.aggregate(pipeline).toArray();
        res.json(result);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    
}

module.exports = { 
    getTotalWicketsByPlayer,
    getTopBowler 
};
