// controllers/statsController.js
const client = require('../db');

const getPlayerStats = async (req, res) => {
    try {
        const database = client.db('AllMatches');
        const collection = database.collection('Matches');

        const playerName = req.params.playerName.trim();
        const matchType = req.params.matchType;
        //console.log(`Received player name: "${playerName}"`);
        // const db = await client();

        // Aggregation pipeline to calculate player stats
        const pipeline = [

            { $match: { 'info.match_type': matchType } },

            // Step 1: Unwind innings -> overs -> deliveries
            { $unwind: "$innings" },
            { $unwind: "$innings.overs" },
            { $unwind: "$innings.overs.deliveries" },

            // Step 2: Calculate batting stats (runs)
            {
                $facet: {
                    battingStats: [
                        { $match: { "innings.overs.deliveries.batter": { $regex: new RegExp(`^${playerName}$`, 'i') } } },
                        {
                            $group: {
                                _id: { matchId: '$_id', team: 'innings.team' },
                                totalRunsInInnings: { $sum: "$innings.overs.deliveries.runs.batter" },
                                fours: { $sum: { $cond: [{ $eq: ['$innings.overs.deliveries.runs.batter', 4] }, 1, 0] } },
                                sixes: { $sum: { $cond: [{ $eq: ['$innings.overs.deliveries.runs.batter', 6] }, 1, 0] } }
                            }
                        },
                        {
                            $group: {
                                _id: playerName,
                                totalRuns: { $sum: '$totalRunsInInnings' },
                                totalFifties: {
                                    $sum: {
                                        $cond: [
                                            { $and: [{ $gte: ['$totalRunsInInnings', 50] }, { $lt: ['$totalRunsInInnings', 100] }] },
                                            1,
                                            0
                                        ]
                                    }
                                },
                                totalHundreds: {
                                    $sum: {
                                        $cond: [{ $gte: ['$totalRunsInInnings', 100] }, 1, 0]
                                    }
                                },
                                totalFours: { $sum: '$fours' },
                                totalSixes: { $sum: '$sixes' }
                            }
                        }
                    ],
                    bowlingStats: [
                        { $match: { "innings.overs.deliveries.bowler": { $regex: new RegExp(`^${playerName}$`, 'i') } } },
                        {
                            $group: {
                                _id: playerName,
                                totalOvers: { $sum: { $divide: [1, 6] } }, // Convert balls to overs
                                totalWickets: { $sum: { $cond: [{ $ifNull: ["$innings.overs.deliveries.wickets", false] }, 1, 0] } }
                            }
                        }
                    ],

                    battingInningsPlayed: [
                        { $unwind: '$innings' },

                        // Match if player is either batter or non-striker
                        {
                            $match: {
                                $or: [
                                    { 'innings.overs.deliveries.batter': playerName },
                                    { 'innings.overs.deliveries.non_striker': playerName }
                                ]
                            }
                        },

                        // Group by document (_id: match) to count one batting innings per match
                        {
                            $group: {
                                _id: { matchId: '$_id', team: 'innings.team' },  // Group by match ID to count once per match
                                battingInningsCount: { $sum: '$_id' }
                            }
                        },

                        // Count total batting innings
                        {
                            $group: {
                                _id: playerName,
                                totalBattingInnings: { $sum: 1 }
                            }
                        }
                    ],

                    // Step 4: Bowling innings - count once per document for bowler
                    bowlingInningsPlayed: [
                        { $unwind: '$innings' },

                        // Match if player is a bowler
                        {
                            $match: {
                                'innings.overs.deliveries.bowler': playerName
                            }
                        },

                        // Group by document (_id: match) to count one bowling innings per match
                        {
                            $group: {
                                _id: { matchId: '$_id', team: 'innings.team' },  // Group by match ID to count once per match
                                bowlingInningsCount: { $sum: '$_id' }
                            }
                        },

                        // Count total bowling innings
                        {
                            $group: {
                                _id: playerName,
                                totalBowlingInnings: { $sum: 1 }
                            }
                        }
                    ],

                    // Count matches played if player is in the players array
                    matchesPlayed: [
                        { $match: { [`info.registry.people.${playerName}`]: { $exists: true } } },
                        {
                            $group: {
                                _id: '$_id',
                                matchesCount: { $sum: 1 }  // Count one match per document
                            }
                        },
                        {
                            $group: {
                                _id: playerName,
                                matchesPlayed: { $sum: 1 }
                            }
                        }
                    ]
                }
            }
        ];

        // Execute aggregation
        const results = await collection.aggregate(pipeline).toArray();
        //console.log('Aggregation results:', JSON.stringify(results, null, 2));

        const battingStats = results[0].battingStats[0] || { totalRuns: 0, totalFifties: 0, totalHundreds: 0, totalFours: 0, totalSixes: 0 };
        const bowlingStats = results[0].bowlingStats[0] || { totalOvers: 0, totalWickets: 0 };
        const totalBattingInnings = results[0].battingInningsPlayed[0]?.totalBattingInnings || 0;
        const totalBowlingInnings = results[0].bowlingInningsPlayed[0]?.totalBowlingInnings || 0;
        const matchesPlayed = results[0].matchesPlayed[0]?.matchesPlayed || 0;

        // Merge batting and bowling stats
        const playerStats = {
            playerName,
            matchType: matchType,
            totalBattingInnings,
            totalBowlingInnings,
            matchesPlayed: matchesPlayed.toLocaleString(),
            totalRuns: battingStats.totalRuns.toLocaleString(),
            totalFifties: battingStats.totalFifties.toLocaleString(),
            totalHundreds: battingStats.totalHundreds.toLocaleString(),
            totalFours: battingStats.totalFours.toLocaleString(),
            totalSixes: battingStats.totalSixes.toLocaleString(),
            totalOvers: parseFloat(bowlingStats.totalOvers.toFixed(2)).toLocaleString(),
            totalWickets: bowlingStats.totalWickets.toLocaleString()
        };

        res.json(playerStats);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred' });
    }
};

module.exports = { getPlayerStats };
