import React, { useEffect, useState } from 'react';
import './DetailedStatistics.css';
import { getAllPlayersDetailedStats } from './api'; // Your API function to fetch player stats

const DetailedStatistics = () => {
  const [playersStats, setPlayersStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [matchType, setMatchType] = useState('ODI');  // Default match type
  const [page, setPage] = useState(1);  // Pagination
  const [limit, setLimit] = useState(10);  // Items per page
  const [totalPlayers, setTotalPlayers] = useState(0); // Total number of players
  const [sortColumn, setSortColumn] = useState('playerName');  // Column to sort by
  const [sortOrder, setSortOrder] = useState('asc');  // Sort order

  useEffect(() => {
    const fetchAllPlayerStats = async () => {
      try {
        setLoading(true);  // Start loading
        const data = await getAllPlayersDetailedStats(matchType, page, limit, sortColumn, sortOrder);  // Fetch data from API
        setPlayersStats(data.results);  
        setTotalPlayers(data.totalCount);
        setLoading(false);  // Stop loading
      } catch (error) {
        console.error('Error fetching player stats:', error);
        setLoading(false);  // Stop loading
      }
    };

    fetchAllPlayerStats();  // Fetch data when dependencies change
  }, [matchType, page, limit, sortColumn, sortOrder]);

  const totalPages = Math.ceil(totalPlayers / limit); 

  const handleSort = (column) => {
    const order = sortColumn === column && sortOrder === 'asc' ? 'desc' : 'asc';  // Toggle sort order
    setSortColumn(column);
    setSortOrder(order);
  };

  const handleLimitChange = (event) => {
    setLimit(parseInt(event.target.value));  // Update limit
    setPage(1);  // Reset to the first page when limit changes
  };

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const handleTabChange = (type) => {
    setMatchType(type);  // Update the match type
    setPage(1);  // Reset to the first page when match type changes
  };

  const getPaginationButtons = () => {
    const buttons = [];
    const maxPagesToShow = 5;  // Show 5 pages max in the pagination bar
    let startPage = Math.max(1, page - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={page === i ? 'active' : ''}
        >
          {i}
        </button>
      );
    }
    return buttons;
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="detailed-statistics">
      {/* Tabs for Match Types */}
      <div className="tabs">
        {['Test', 'ODI', 'T20'].map((type) => (
          <button 
            key={type} 
            onClick={() => handleTabChange(type)} 
            className={`tab ${matchType === type ? 'active' : ''}`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Pagination Limit Selection */}
      <div className="pagination-controls">
        <label>Show: </label>
        <select value={limit} onChange={handleLimitChange}>
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
        <span> players per page</span>
      </div>

      {/* Table with Sorting */}
      {playersStats && playersStats.length > 0 ? (
      <table>
        <thead>
          <tr>
            <th onClick={() => handleSort('playerName')}>
              Player {sortColumn === 'playerName' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th>Country</th>
            <th onClick={() => handleSort('matchesPlayed')}>
              Matches {sortColumn === 'matchesPlayed' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('inningsPlayed')}>
              Innings (Bat) {sortColumn === 'inningsPlayed' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('totalRuns')}>
              Runs Scored {sortColumn === 'totalRuns' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('battingAverage')}>
              Average {sortColumn === 'battingAverage' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('strikeRate')}>
              Strike Rate {sortColumn === 'strikeRate' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('totalHundreds')}>
              Hundreds {sortColumn === 'totalHundreds' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('totalFifties')}>
              Fifties {sortColumn === 'totalFifties' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('totalWickets')}>
              Wickets {sortColumn === 'totalWickets' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('bowlingAverage')}>
              Bowling Average {sortColumn === 'bowlingAverage' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th>Best Bowling</th>
            <th onClick={() => handleSort('economyRate')}>
              Economy {sortColumn === 'economyRate' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('fiveWicketHauls')}>
              5-wicket Hauls {sortColumn === 'fiveWicketHauls' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
          </tr>
        </thead>
        <tbody>
          {playersStats.map((stat) => (
            stat.detailedStats.map((player) => (
            <tr key={player.playerName}>
              <td>{player.playerName}</td>
              <td>{/* Country logic here */}</td>
              <td>{player.matchesPlayed}</td>
              <td>{player.inningsPlayed}</td>
              <td>{player.totalRuns}</td>
              <td>{player.battingAverage}</td>
              <td>{player.strikeRate}</td>
              <td>{player.totalHundreds}</td>
              <td>{player.totalFifties}</td>
              <td>{player.totalWickets}</td>
              <td>{player.bowlingAverage}</td>
              <td>{player.bestBowling}</td>
              <td>{player.economyRate}</td>
              <td>{player.fiveWicketHauls}</td>
            </tr>
            ))
          ))}
        </tbody>
      </table>
      ) : (
        <p>No data available for the selected match type.</p>
      )}

      {/* Pagination Controls */}
      <div className="pagination">
        <button onClick={() => handlePageChange(page - 1)} disabled={page === 1}>
          Previous
        </button>
        {getPaginationButtons()}
        <button onClick={() => handlePageChange(page + 1)} disabled={page === totalPages}>
          Next
        </button>
      </div>
    </div>
  );
};

export default DetailedStatistics;
