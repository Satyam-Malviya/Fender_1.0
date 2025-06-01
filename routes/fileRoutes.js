const express = require('express');
const multer = require('multer');
// Assuming s3Helper.js exports uploadFile and generateSignedUrl
const { uploadFile, generateSignedUrl } = require('../utils/s3Helper');
const router = express.Router();
const upload = multer(); // Uses memory storage by default

// POST /api/files/upload - For single file upload
router.post('/upload', upload.single('file'), async(req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }
        // Pass the entire file object from multer to s3Helper
        const result = await uploadFile(req.file); // s3Helper.uploadFile will use file.originalname as key
        res.status(200).json({
            message: 'File uploaded successfully!',
            fileName: req.file.originalname, // This is what the older share.html expects
            s3_url: result.Location // The direct S3 URL (usually not shared)
        });
    } catch (error) {
        console.error('Single File Upload Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/files/share/:fileIdentifier - Generates signed URL for single file
// :fileIdentifier can be an original filename or a direct S3 key if passed by receive-folder.html
router.get('/share/:fileIdentifier', async(req, res) => {
    try {
        // The fileIdentifier might be URL encoded if it contains slashes (like a full S3 key)
        const s3Key = decodeURIComponent(req.params.fileIdentifier);
        const url = await generateSignedUrl(s3Key); // s3Helper.generateSignedUrl expects an S3 Key
        if (url) {
            res.status(200).json({ message: 'Signed URL generated successfully', url });
        } else {
            res.status(404).json({ error: 'Could not generate signed URL or file not found.' })
        }
    } catch (error) {
        console.error('Share Single File Error (generating signed URL):', error);
        // Check if the error is because the key doesn't exist. AWS SDK might throw NoSuchKey.
        if (error.code === 'NoSuchKey' || error.message.includes('NoSuchKey')) {
            res.status(404).json({ error: 'File not found.' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

module.exports = router;