// controllers/batsmanController.js
const client = require('../db');

// Get total runs scored by each player, with dynamic grouping based on query parameters, and optional limit
const getTotalRunsByPlayer = async (req, res) => {
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
      matchStage["info.venue"] = {$in: venue};
    }
    
    // Define the grouping key dynamically
    const groupId = { player: "$innings.overs.deliveries.batter" };
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
      { $group: {
          _id: groupId,
          totalRuns: { $sum: "$innings.overs.deliveries.runs.batter" }
        }
      },
      
      // Sort by total runs in descending order
      { $sort: { totalRuns: -1 } }
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
    console.error('Error in getTotalRunsByPlayer:', error);
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

    const result = await collection.aggregate(pipeline, { allowDiskUse: true }).toArray();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getTotalRunsByPlayer,
  getTopBatsman
};
