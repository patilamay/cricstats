const client = require('../db');

// Get total wickets taken by each player, grouped by match_type
const getTotalWicketsByPlayer = async (req, res) => {
  try {
    const database = client.db('AllMatches');
    const collection = database.collection('Matches');

    // Extract filters and limit from query parameters
    const { match_type, gender, venue, limit, page } = req.query;

    // Build the match object dynamically based on the filters provided
    const matchStage = {};
    if (match_type) {
      const matchTypes = match_type.split(','); // Split the comma-separated values
      matchStage["info.match_type"] = { $in: matchTypes }; // Use $in to match any of the types
    }

    // Handle multiple values for gender if needed
    if (gender) {
      const genders = gender.split(',');
      matchStage["info.gender"] = { $in: genders };
    }

    // Handle multiple values for venue if needed
    if (venue) {
      const venue = gender.split(',');
      matchStage["info.venue"] = { $in: venue };
    }

    // Define the grouping key dynamically
    const groupId = { player: "$innings.overs.deliveries.bowler" };
    if (match_type) groupId.match_type = "$info.match_type";
    if (gender) groupId.gender = "$info.gender";
    if (venue) groupId.venue = "$info.venue";

    // Define the aggregation pipeline
    const pipeline = [
      // Early filtering to reduce dataset
      { $match: matchStage },

      // Unwind nested arrays to access individual deliveries
      { $unwind: "$innings" },
      { $unwind: "$innings.overs" },
      { $unwind: "$innings.overs.deliveries" },

      // Group by dynamic key and calculate total runs
      {
        $group: {
          _id: groupId,
          totalWickets: { 
            $sum: { 
              $cond: [{ $ifNull: ["$innings.overs.deliveries.wickets", false] }, 1, 0] 
            } // Sum the wickets if present
          }
        }
      },

      // Sort by total wickets in descending order
      { $sort: { totalWickets: -1 } }
    ];

    // Handle pagination
    const pageNumber = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 10;
    const skip = (pageNumber - 1) * pageSize;

    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: pageSize });

    // Execute the aggregation with allowDiskUse set to true
    const result = await collection.aggregate(pipeline, { allowDiskUse: true }).toArray();
    res.json(result);
  } catch (error) {
    console.error('Error in getTotalWicketsByPlayer:', error);
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
