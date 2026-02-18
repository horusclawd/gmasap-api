#!/usr/bin/env node

/**
 * DynamoDB Local init script
 * - Creates the dev tables used by SAM local (idempotent)
 * - Matches template.yaml (tables + GSIs)
 *
 * Usage:
 *   node scripts/dynamodb-local-init.js
 *
 * Env:
 *   DYNAMODB_LOCAL_ENDPOINT (default http://localhost:8000)
 *   USERS_TABLE / POSTS_TABLE / ATHLETES_TABLE (defaults match env.json)
 */

const {
  DynamoDBClient,
  DescribeTableCommand,
  CreateTableCommand,
  UpdateTableCommand,
} = require("@aws-sdk/client-dynamodb");

const endpoint = process.env.DYNAMODB_LOCAL_ENDPOINT || "http://localhost:8000";

const usersTable = process.env.USERS_TABLE || "gmasap-dev-users";
const postsTable = process.env.POSTS_TABLE || "gmasap-dev-posts";
const athletesTable = process.env.ATHLETES_TABLE || "gmasap-dev-athletes";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  endpoint,
  credentials: {
    accessKeyId: "dummy",
    secretAccessKey: "dummy",
  },
});

async function tableExists(TableName) {
  try {
    await client.send(new DescribeTableCommand({ TableName }));
    return true;
  } catch (err) {
    if (err && (err.name === "ResourceNotFoundException" || err.__type?.includes("ResourceNotFoundException"))) {
      return false;
    }
    throw err;
  }
}

async function createTable(def) {
  const exists = await tableExists(def.TableName);
  if (exists) {
    console.log(`✅ ${def.TableName} already exists`);
    return;
  }

  console.log(`🛠️  creating table ${def.TableName}...`);
  await client.send(new CreateTableCommand(def));
  console.log(`✅ created ${def.TableName}`);
}

function usersTableDef(TableName) {
  return {
    TableName,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
      { AttributeName: "email", AttributeType: "S" },
      { AttributeName: "provider", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "email-index",
        KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
      {
        IndexName: "provider-index",
        KeySchema: [
          { AttributeName: "provider", KeyType: "HASH" },
          { AttributeName: "email", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  };
}

function postsTableDef(TableName) {
  return {
    TableName,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
      { AttributeName: "timestamp", AttributeType: "N" },
      { AttributeName: "author", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "timestamp-index",
        KeySchema: [{ AttributeName: "timestamp", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
      {
        IndexName: "author-index",
        KeySchema: [
          { AttributeName: "author", KeyType: "HASH" },
          { AttributeName: "timestamp", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  };
}

function athletesTableDef(TableName) {
  return {
    TableName,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
      { AttributeName: "sport", AttributeType: "S" },
      { AttributeName: "position", AttributeType: "S" },
      { AttributeName: "graduationYear", AttributeType: "N" },
      { AttributeName: "state", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "sport-position-index",
        KeySchema: [
          { AttributeName: "sport", KeyType: "HASH" },
          { AttributeName: "position", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
      {
        IndexName: "sport-graduation-index",
        KeySchema: [
          { AttributeName: "sport", KeyType: "HASH" },
          { AttributeName: "graduationYear", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
      {
        IndexName: "state-sport-index",
        KeySchema: [
          { AttributeName: "state", KeyType: "HASH" },
          { AttributeName: "sport", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  };
}

async function main() {
  console.log(`DynamoDB Local endpoint: ${endpoint}`);
  await createTable(usersTableDef(usersTable));
  await createTable(postsTableDef(postsTable));
  await createTable(athletesTableDef(athletesTable));
  console.log("\nAll set.");
}

main().catch((err) => {
  console.error("Init failed:", err);
  process.exit(1);
});
