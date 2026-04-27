'use strict';

const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs   = require('fs');
const path = require('path');

const ACCOUNT_ID  = process.env.R2_ACCOUNT_ID;
const BUCKET      = process.env.R2_BUCKET_NAME;
const ACCESS_KEY  = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY  = process.env.R2_SECRET_ACCESS_KEY;

let client = null;

if (ACCOUNT_ID && BUCKET && ACCESS_KEY && SECRET_KEY) {
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
    },
  });
}

function isConfigured() {
  return !!client;
}

async function uploadPDF(localPath, key) {
  if (!client) throw new Error('R2 is not configured');
  const body = fs.readFileSync(localPath);
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: 'application/pdf',
  }));
  return key;
}

async function getPresignedUrl(key, expiresIn = 3600) {
  if (!client) throw new Error('R2 is not configured');
  const filename = path.basename(key);
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
  });
  return getSignedUrl(client, command, { expiresIn });
}

module.exports = { isConfigured, uploadPDF, getPresignedUrl };
