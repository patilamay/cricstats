// testConnection.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    tls: true,
});

async function testConnection() {
    try {
        await client.connect();
        console.log('Successfully connected to MongoDB');
    } catch (error) {
        console.error('Connection failed:', error);
    } finally {
        await client.close();
    }
}

testConnection();
