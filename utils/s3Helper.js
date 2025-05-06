const AWS = require('aws-sdk');

const s3 = new AWS.S3({
    accessKeyId: "AKIAZDSDULQLESYD23XP",
    secretAccessKey: "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",
    region: "ap-south-1",
});


const uploadFile = async(file) => {
    const params = {
        Bucket: "fender-bkt",
        Key: file.originalname,
        Body: file.buffer,
        ContentType: file.mimetype,
    };
    try {
        const result = await s3.upload(params).promise();
        return result;
    } catch (error) {
        throw new Error(error.message);
    }
};


const generateSignedUrl = async(fileName) => {
    const params = {
        Bucket: "fender-bkt",
        Key: fileName,
        Expires: 60 * 5,
    };
    try {
        const url = await s3.getSignedUrlPromise('getObject', params);
        return url;
    } catch (error) {
        throw new Error(error.message);
    }
};

module.exports = { uploadFile, generateSignedUrl };