const client = require('../db');

const getTotalSixes = async (req, res) => {
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
    const groupId = { player: "$innings.overs.deliveries.batter" };
    if (match_type) groupId.match_type = "$info.match_type";
    if (gender) groupId.gender = "$info.gender";
    if (venue) groupId.venue = "$info.venue";

    const pipeline = [
      // Early filtering to reduce dataset
      { $match: matchStage },

      // Unwind nested arrays to access individual deliveries
      { $unwind: "$innings" },
      { $unwind: "$innings.overs" },
      { $unwind: "$innings.overs.deliveries" },
      { $match: { "innings.overs.deliveries.runs.batter": 6 } },

      {
        $group: {
          _id: groupId,
          totalSixes: { $sum: 1 }
        }
      },
      { $sort: { totalSixes: -1 } }
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
    console.error('Error in getTotalSixesByPlayer:', error);
    res.status(500).json({ message: error.message });
  }
};

const getMostSixes = async (req, res) => {
  try {
    const database = client.db('AllMatches');
    const collection = database.collection('Matches');

    const pipeline = [
      { $unwind: "$innings" },
      { $unwind: "$innings.overs" },
      { $unwind: "$innings.overs.deliveries" },
      {
        $match: {
          "innings.overs.deliveries.runs.batter": 6 // Filter for deliveries where batter scored exactly 6 runs
        }
      },
      {
        $group: {
          _id: { player: "$innings.overs.deliveries.batter", match_type: "$info.match_type" },
          mostSixes: { $sum: 1 } // Count each six
        }
      },
      { $sort: { mostSixes: -1 } }, // Sort by total sixes in descending order
      {
        $group: {
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
