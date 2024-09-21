import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export const getTopBatsman = async () => {
  try {
    const response = await axios.get(`${API_URL}/top-batsman`);
    return response.data;
  } catch (error) {
    console.error('Error fetching top batsman:', error);
    throw error;
  }
};

export const getTopBowler = async () => {
  try {
    const response = await axios.get(`${API_URL}/top-bowler`);
    return response.data;
  } catch (error) {
    console.error('Error fetching top bowler:', error);
    throw error;
  }
};

export const getMostFours = async () => {
  try {
    const response = await axios.get(`${API_URL}/most-fours`);
    return response.data;
  } catch (error) {
    console.error('Error fetching most fours:', error);
    throw error;
  }
};

export const getMostSixes = async () => {
  try {
    const response = await axios.get(`${API_URL}/most-sixes`);
    return response.data;
  } catch (error) {
    console.error('Error fetching most sixes:', error);
    throw error;
  }
};

export const getTotalRuns = async (matchType, limit = 1) => {
  try {
    const response = await axios.get(`${API_URL}/batsman/total-runs`, {
      params: {
          match_type: matchType,
          limit: limit
      }
  });
    return response.data;
  } catch (error) {
    console.error('Error fetching total runs:', error);
    throw error;
  }
};

export const getTotalWickets = async (matchType, limit = 1) => {
  try {
    const response = await axios.get(`${API_URL}/bowler/total-wickets`, {
      params: {
          match_type: matchType,
          limit: limit
      }
  });
    return response.data;
  } catch (error) {
    console.error('Error fetching total wickets:', error);
    throw error;
  }
};