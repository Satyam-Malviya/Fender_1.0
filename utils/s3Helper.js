const AWS = require('aws-sdk');
const archiver = require('archiver');
const fs = require('fs');

// Ab hum strictly .env file par depend karenge
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

// ... baaki niche ka tumhara saara code waisa hi rahega (uploadFile, generateSignedUrl etc.)

// For single file uploads (original functionality)
// Single file upload
const uploadFile = async(fileObject) => { 
    const fileStream = fs.createReadStream(fileObject.path); // <--- STREAM BANAO
    
    const params = {
        Bucket: S3_BUCKET_NAME,
        Key: fileObject.originalname, 
        Body: fileStream, // <--- BUFFER KI JAGAH STREAM BHEJO
        ContentType: fileObject.mimetype,
    };
    try {
        return await s3.upload(params).promise();
    } catch (error) {
        console.error("S3 Single File Upload Error:", error);
        throw new Error(`S3 Upload Error: ${error.message}`);
    }
};

// Folder wali upload
const uploadFileToFolder = async(fileObject, s3Key) => {
    const fileStream = fs.createReadStream(fileObject.path); // <--- STREAM BANAO

    const params = {
        Bucket: S3_BUCKET_NAME,
        Key: s3Key, 
        Body: fileStream, // <--- BUFFER KI JAGAH STREAM BHEJO
        ContentType: fileObject.mimetype,
        Metadata: { 
            'original-filename': fileObject.originalname
        }
    };
    try {
        return await s3.upload(params).promise();
    } catch (error) {
        console.error("S3 Upload to Folder Error:", error);
        throw new Error(`S3 Folder Upload Error: ${error.message}`);
    }
};

// Generates a pre-signed URL for downloading an object (single file or file within a folder)
const generateSignedUrl = async(s3ObjectKey) => {
    const params = {
        Bucket: S3_BUCKET_NAME,
        Key: s3ObjectKey,
        Expires: 60 * 15, // 15 minutes expiry for the link
    };
    // To ensure the file downloads with a nice name rather than just the key (if key is UUID etc.)
    // params.ResponseContentDisposition = `attachment; filename="${s3ObjectKey.split('/').pop()}"`;

    try {
        const url = await s3.getSignedUrlPromise('getObject', params);
        return url;
    } catch (error) {
        console.error("S3 Signed URL Generation Error for key:", s3ObjectKey, error);
        // Let the caller handle specific error types like NoSuchKey
        throw error; // Re-throw the error to be caught by the route handler
    }
};

// Lists files within a "folder" (S3 prefix)
const listFilesFromFolder = async(folderShareId) => {
    const params = {
        Bucket: S3_BUCKET_NAME,
        Prefix: `${folderShareId}/`
    };
    try {
        const data = await s3.listObjectsV2(params).promise();
        if (!data.Contents) {
            return [];
        }
        return data.Contents.map(item => {
            // Remove the folderShareId/ prefix to get the name relative to the shared folder root
            let relativeName = item.Key.substring(folderShareId.length + 1);
            // Don't list "folders" themselves if they are empty S3 objects ending with /
            if (item.Size === 0 && relativeName.endsWith('/')) {
                return null;
            }
            return {
                key: item.Key, // Full S3 key
                name: relativeName, // Relative path inside the shared folder
                size: item.Size,
                lastModified: item.LastModified
            };
        }).filter(item => item !== null); // Filter out nulls (empty S3 folder objects)
    } catch (error) {
        console.error("S3 List Files from Folder Error:", error);
        throw new Error(`S3 List Files Error: ${error.message}`);
    }
};

// Streams a folder from S3 as a ZIP file
const getZippedFolderStream = async(folderShareId) => {
    const archive = archiver('zip', { zlib: { level: 6 } }); // level 6 is a good balance

    archive.on('warning', (err) => {
        if (err.code === 'ENOENT') { console.warn('Archiver ENOENT warning: ', err); } else { console.error('Archiver warning: ', err);
            archive.emit('error', err); } // Propagate other warnings as errors
    });
    // Error event on archiver is critical
    archive.on('error', (err) => {
        console.error('Archiver stream has errored:', err);
        // The stream piping to response in the route will handle this.
    });

    // Fetch file list first
    let s3Files;
    try {
        s3Files = await listFilesFromFolder(folderShareId);
    } catch (error) {
        console.error(`Failed to list files for ZIP for folder ${folderShareId}:`, error);
        archive.emit('error', new Error(`Could not list files for zipping: ${error.message}`));
        archive.finalize(); // Finalize even on error to close the archive stream properly
        return archive;
    }

    if (!s3Files || s3Files.length === 0) {
        console.log(`No files found for folderShareId: ${folderShareId}. ZIP will be empty or contain only structure.`);
        // It's important to finalize even if there are no files.
        archive.finalize();
        return archive;
    }

    // Append files to the archive
    for (const file of s3Files) {
        if (file.size > 0) { // Only add actual files, not S3 "folder" markers
            const s3Stream = s3.getObject({ Bucket: S3_BUCKET_NAME, Key: file.key }).createReadStream();
            s3Stream.on('error', (streamError) => {
                console.error(`Error streaming S3 object ${file.key} for ZIP:`, streamError);
                // archive.emit('error', streamError); // This tells archiver to stop & report error
                // For robustness, might choose to skip problematic file & log, or abort.
                // Emitting error is usually correct.
                if (!archive.destroyed) {
                    archive.emit('error', new Error(`Failed to stream ${file.name} from S3.`));
                }
            });
            archive.append(s3Stream, { name: file.name }); // file.name is the relative path within zip
        }
    }

    archive.finalize(); // Finalize the archive, no more files will be appended.
    return archive; // Return the stream to be piped in the route.
};

module.exports = {
    uploadFile,
    generateSignedUrl,
    uploadFileToFolder,
    listFilesFromFolder,
    getZippedFolderStream
};