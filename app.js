const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const fileRoutes = require('./routes/fileRoutes');
const folderRoutes = require('./routes/folderRoutes'); // NEW

dotenv.config(); // Load .env file variables
const app = express();

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Routes for HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/share', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'share.html'));
});

app.get('/receive', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'receive.html'));
});

// NEW HTML page routes for folders
app.get('/share-folder', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'share-folder.html'));
});

app.get('/receive-folder', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'receive-folder.html'));
});


// API routes
app.use('/api/files', fileRoutes); // For single files
app.use('/api/folder', folderRoutes); // NEW - For folders

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}. Ensure AWS credentials and bucket name are set in .env or environment.`));