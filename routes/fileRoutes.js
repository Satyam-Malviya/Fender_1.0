const express = require('express');
const multer = require('multer');
const { uploadFile, generateSignedUrl } = require('../utils/s3Helper');
const router = express.Router();
const upload = multer();

router.post('/upload', upload.single('file'), async(req, res) => {
    try {
        console.log('Request file:', req.file);


        const result = await uploadFile(req.file);
        console.log('Upload result:', result);


        res.status(200).json({
            message: 'File uploaded successfully!',
            fileName: req.file.originalname,
            url: result.Location
        });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

router.get('/share/:fileName', async(req, res) => {
    try {
        const url = await generateSignedUrl(req.params.fileName);
        res.status(200).json({ message: 'Signed URL generated successfully', url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;