const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB client
// NOTE: When running under `sam local`, Lambdas execute in Docker.
// `localhost` would point at the Lambda container itself, not your host machine.
// Use DYNAMODB_ENDPOINT (recommended) or fall back to host.docker.internal.
const isLocal = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'local';
const localEndpoint = process.env.DYNAMODB_ENDPOINT || 'http://host.docker.internal:8000';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(isLocal && {
    endpoint: localEndpoint,
    credentials: {
      accessKeyId: 'dummy',
      secretAccessKey: 'dummy'
    }
  })
});

const docClient = DynamoDBDocumentClient.from(client);

class DynamoDBService {
  constructor(tableName) {
    this.tableName = tableName;
  }

  async get(key) {
    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: key
      });
      
      const result = await docClient.send(command);
      return result.Item;
    } catch (error) {
      console.error('DynamoDB Get Error:', error);
      throw new Error(`Failed to get item: ${error.message}`);
    }
  }

  async put(item) {
    try {
      const command = new PutCommand({
        TableName: this.tableName,
        Item: {
          ...item,
          createdAt: item.createdAt || Date.now(),
          updatedAt: Date.now()
        }
      });
      
      await docClient.send(command);
      return item;
    } catch (error) {
      console.error('DynamoDB Put Error:', error);
      throw new Error(`Failed to put item: ${error.message}`);
    }
  }

  async update(key, updateExpression, expressionAttributeNames, expressionAttributeValues) {
    try {
      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: key,
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: {
          ...expressionAttributeValues,
          ':updatedAt': Date.now()
        },
        ReturnValues: 'ALL_NEW'
      });
      
      const result = await docClient.send(command);
      return result.Attributes;
    } catch (error) {
      console.error('DynamoDB Update Error:', error);
      throw new Error(`Failed to update item: ${error.message}`);
    }
  }

  async delete(key) {
    try {
      const command = new DeleteCommand({
        TableName: this.tableName,
        Key: key,
        ReturnValues: 'ALL_OLD'
      });
      
      const result = await docClient.send(command);
      return result.Attributes;
    } catch (error) {
      console.error('DynamoDB Delete Error:', error);
      throw new Error(`Failed to delete item: ${error.message}`);
    }
  }

  async query(keyConditionExpression, expressionAttributeNames, expressionAttributeValues, options = {}) {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ...options
      });
      
      const result = await docClient.send(command);
      return {
        items: result.Items || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count
      };
    } catch (error) {
      console.error('DynamoDB Query Error:', error);
      throw new Error(`Failed to query items: ${error.message}`);
    }
  }

  async scan(options = {}) {
    try {
      const command = new ScanCommand({
        TableName: this.tableName,
        ...options
      });
      
      const result = await docClient.send(command);
      return {
        items: result.Items || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count
      };
    } catch (error) {
      console.error('DynamoDB Scan Error:', error);
      throw new Error(`Failed to scan items: ${error.message}`);
    }
  }

  // Helper method for paginated queries
  async queryWithPagination(keyConditionExpression, expressionAttributeNames, expressionAttributeValues, limit = 20, lastKey = null) {
    const options = {
      Limit: limit,
      ScanIndexForward: false // Most recent first
    };

    if (lastKey) {
      options.ExclusiveStartKey = lastKey;
    }

    return await this.query(keyConditionExpression, expressionAttributeNames, expressionAttributeValues, options);
  }
}

module.exports = {
  DynamoDBService,
  docClient
};