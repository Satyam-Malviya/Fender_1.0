const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const fileRoutes = require('./routes/fileRoutes');

dotenv.config();
const app = express();


app.use(express.static(path.join(__dirname, 'public')));


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/share', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'share.html'));
});

app.get('/receive', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'receive.html'));
});


app.use('/api/files', fileRoutes);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));