const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { uploadFile, generateSignedUrl } = require('../utils/s3Helper');
const router = express.Router();
const upload = multer({ dest: 'uploads/' });


router.post('/upload', upload.single('file'), async(req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }
        
        const result = await uploadFile(req.file); 
        
        
        fs.unlinkSync(req.file.path); 

        res.status(200).json({
            message: 'File uploaded successfully!',
            fileName: req.file.originalname, 
            s3_url: result.Location 
        });
    } catch (error) {
        
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        console.error('Single File Upload Error:', error);
        res.status(500).json({ error: error.message });
    }
});


router.get('/share/:fileIdentifier', async(req, res) => {
    try {
        
        const s3Key = decodeURIComponent(req.params.fileIdentifier);
        const url = await generateSignedUrl(s3Key); 
        if (url) {
            res.status(200).json({ message: 'Signed URL generated successfully', url });
        } else {
            res.status(404).json({ error: 'Could not generate signed URL or file not found.' })
        }
    } catch (error) {
        console.error('Share Single File Error (generating signed URL):', error);
        
        if (error.code === 'NoSuchKey' || error.message.includes('NoSuchKey')) {
            res.status(404).json({ error: 'File not found.' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

module.exports = router;