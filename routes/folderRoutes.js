const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { uploadFileToFolder, listFilesFromFolder, getZippedFolderStream, generateSignedUrl } = require('../utils/s3Helper');
const router = express.Router();
const upload = multer({ dest: 'uploads/' });


router.post('/upload-file', upload.single('file'), async(req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }
        const { folderShareId, relativePath } = req.body;
        if (!folderShareId || !relativePath) {
            fs.unlinkSync(req.file.path); 
            return res.status(400).json({ error: 'folderShareId and relativePath are required.' });
        }

        const s3Key = `${folderShareId}/${relativePath}`;
        const result = await uploadFileToFolder(req.file, s3Key); 
        
        
        fs.unlinkSync(req.file.path); 

        res.status(200).json({
            message: `File ${relativePath} uploaded successfully`,
            s3_url: result.Location
        });
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        console.error('Folder File Upload Error:', error);
        res.status(500).json({ error: error.message });
    }
});


router.get('/list/:folderShareId', async(req, res) => {
    try {
        const { folderShareId } = req.params;
        if (!folderShareId) {
            return res.status(400).json({ error: 'folderShareId is required.' });
        }
        const files = await listFilesFromFolder(folderShareId); 
        res.status(200).json({ files }); 
    } catch (error) {
        console.error('List Folder Contents Error:', error);
        res.status(500).json({ error: error.message });
    }
});


router.get('/file-link/:folderShareId/:filePath(*)', async(req, res) => {
    try {
        const { folderShareId, filePath } = req.params;
        if (!folderShareId || !filePath) {
            return res.status(400).json({ message: 'Folder ID and file path are required.' });
        }
        
        const s3Key = `${folderShareId}/${filePath}`;
        const url = await generateSignedUrl(s3Key); 

        const fileNameForDownload = filePath.split('/').pop(); 

        res.status(200).json({ url, fileName: fileNameForDownload });
    } catch (error) {
        console.error('Error generating specific file link from folder:', error);
        if (error.code === 'NoSuchKey' || error.message.includes('NoSuchKey')) {
            res.status(404).json({ error: 'File not found within the specified folder.' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});



router.get('/download-zip/:folderShareId', async(req, res) => {
    try {
        const { folderShareId } = req.params;
        if (!folderShareId) {
            return res.status(400).json({ error: 'folderShareId is required.' });
        }

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${folderShareId}.zip"`);

        const zipStream = await getZippedFolderStream(folderShareId); // This comes from s3Helper

        zipStream.on('error', (err) => {
            console.error('Error during zipping or streaming to client:', err);
            if (!res.headersSent) {
                
                res.status(500).json({ error: 'Error generating ZIP file. ' + err.message });
            } else {
                
                res.end();
            }
        });
        zipStream.pipe(res);

    } catch (error) { 
        console.error('Error preparing ZIP download route:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to initiate ZIP download. ' + error.message });
        }
    }
});

module.exports = router;