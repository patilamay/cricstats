// db.js
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

// Fetch the MongoDB URI from environment variables
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('Error: MONGODB_URI is not defined in .env');
  process.exit(1);
}

// Define MongoClient options
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  tls: true, // Ensure TLS is enabled
  // tlsAllowInvalidCertificates: false, // Uncomment if using valid certificates
  // tlsCAFile: '/path/to/ca.pem', // Uncomment and set path if using custom CA certificates
};

// Create a new MongoClient
const client = new MongoClient(uri, options);

// Function to connect to the database
async function connectToDatabase() {
  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1); // Exit the process with failure
  }
}

// Initiate the connection
connectToDatabase();

// Export the client for use in other modules
module.exports = client;
