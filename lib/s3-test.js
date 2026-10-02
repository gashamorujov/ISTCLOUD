import { S3Client, ListBucketsCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";

const S3_ACCESS_KEY_ID = "2A0TWO8MY45HX1Z19K8V";
const S3_SECRET_ACCESS_KEY = "oHcSKeLC7xW9EaF2+PGmZ4QW9liyiBKpws6yzCVK";

// Try virtual-hosted style
const endpoints = [
  { endpoint: "https://s3.us-east-1.filonecontent.com", region: "us-east-1", forcePathStyle: false },
  { endpoint: "https://s3.us-east-1.filonecontent.com", region: "us-east-1", forcePathStyle: true },
  { endpoint: "https://s3.eu-west-1.filonecontent.com", region: "eu-west-1", forcePathStyle: false },
  { endpoint: "https://s3.eu-west-1.filonecontent.com", region: "eu-west-1", forcePathStyle: true },
];

const S3_BUCKET = "istcloud";

async function testEndpoint(endpointConfig) {
  console.log(`\n=== Testing ${endpointConfig.endpoint} (${endpointConfig.region}) forcePathStyle=${endpointConfig.forcePathStyle} ===`);
  
  const client = new S3Client({
    endpoint: endpointConfig.endpoint,
    region: endpointConfig.region,
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: endpointConfig.forcePathStyle,
  });

  // Test 1: List buckets
  try {
    console.log("Listing buckets...");
    const listCmd = new ListBucketsCommand({});
    const response = await client.send(listCmd);
    console.log("Buckets:", response.Buckets?.map(b => b.Name));
  } catch (err) {
    console.error("List buckets error:", err.message);
    if (err.$response?.body && err.$response.body.transformToString) {
      const body = await err.$response.body.transformToString();
      console.log("Body:", body);
    }
  }

  // Test 2: List objects
  try {
    console.log("Listing objects...");
    const listCmd = new ListObjectsV2Command({ Bucket: S3_BUCKET });
    const response = await client.send(listCmd);
    console.log("Objects:", response.Contents?.map(o => o.Key) || "empty");
  } catch (err) {
    console.error("List objects error:", err.message);
    if (err.$response?.body && err.$response.body.transformToString) {
      const body = await err.$response.body.transformToString();
      console.log("Body:", body);
    }
  }

  // Test 3: Put object
  try {
    console.log("Putting object...");
    const putCmd = new PutObjectCommand({ 
      Bucket: S3_BUCKET, 
      Key: "test.txt",
      Body: "Hello World",
      ContentType: "text/plain"
    });
    await client.send(putCmd);
    console.log("Object put successfully!");
  } catch (err) {
    console.error("Put object error:", err.message);
    if (err.$response?.body && err.$response.body.transformToString) {
      const body = await err.$response.body.transformToString();
      console.log("Body:", body);
    }
  }
}

async function main() {
  for (const ep of endpoints) {
    await testEndpoint(ep);
  }
}

main();
