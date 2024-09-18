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