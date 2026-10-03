import { S3Client, DeleteObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  endpoint: "https://s3.eu-west-1.filonecontent.com",
  region: "eu-west-1",
  credentials: {
    accessKeyId: "2A0TWO8MY45HX1Z19K8V",
    secretAccessKey: "oHcSKeLC7xW9EaF2+PGmZ4QW9liyiBKpws6yzCVK",
  },
  forcePathStyle: true,
});

async function test() {
  // Test delete
  console.log("Testing delete...");
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: "ist", Key: "test/" }));
    console.log("Delete successful");
  } catch (err) {
    console.log("Delete failed:", err.message);
    if (err.$response?.body?.transformToString) {
      const body = await err.$response.body.transformToString();
      console.log("Response:", body);
    }
  }
  
  // Test copy (rename)
  console.log("\nTesting copy (rename)...");
  try {
    await s3.send(new CopyObjectCommand({
      Bucket: "ist",
      CopySource: "ist/credentials.csv",
      Key: "renamed.csv",
    }));
    console.log("Copy successful");
  } catch (err) {
    console.log("Copy failed:", err.message);
    if (err.$response?.body?.transformToString) {
      const body = await err.$response.body.transformToString();
      console.log("Response:", body);
    }
  }
  
  // Test delete old file
  console.log("\nTesting delete old file...");
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: "ist", Key: "credentials.csv" }));
    console.log("Delete old file successful");
  } catch (err) {
    console.log("Delete old file failed:", err.message);
    if (err.$response?.body?.transformToString) {
      const body = await err.$response.body.transformToString();
      console.log("Response:", body);
    }
  }
}

test();
