const client = require('../db');

async function getEconomyRate(req, res) {
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
}

module.exports = { getEconomyRate };
