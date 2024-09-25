const client = require('../db');

const getEconomyRate = async (req, res) => {
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
      { $group: {
         _id: groupId,
         totalRunsConceded: { $sum: "$innings.overs.deliveries.runs.total" },
         totalDeliveries: { $sum: 1 }
      }
      },
      { $project: {
          totalRunsConceded: 1,
          totalDeliveries: 1,
          economyRate: { $divide: ["$totalRunsConceded", { $divide: ["$totalDeliveries", 6] }] }
      }},
      { $sort: { economyRate: 1 } }
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
    console.error('Error in getEconomyRate:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getEconomyRate };

/*async function getEconomyRate(req, res) {
  try {
    const database = client.db('AllMatches');
    const collection = database.collection('Matches');

    const pipeline = [
      { $unwind: "$innings" },
      { $unwind: "$innings.overs" },
      { $unwind: "$innings.overs.deliveries" },
      { $group: {
          _id: "$innings.overs.deliveries.bowler",
          totalRunsConceded: { $sum: "$innings.overs.deliveries.runs.total" },
          totalDeliveries: { $sum: 1 }
        }
      },
      { $project: {
          totalRunsConceded: 1,
          totalDeliveries: 1,
          economyRate: { $divide: ["$totalRunsConceded", { $divide: ["$totalDeliveries", 6] }] }
        }
      },
      { $sort: { economyRate: 1 } }
    ];

    const result = await collection.aggregate(pipeline).toArray();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}*/


