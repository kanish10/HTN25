const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

class DynamoDBService {
  constructor(opts = {}) {
    const region = process.env.AWS_REGION || opts.awsRegion || 'us-east-1';
    const client = new DynamoDBClient({ region });
    this.ddb = DynamoDBDocumentClient.from(client);
    this.tableName = process.env.SHOPBRAIN_DDB_TABLE || opts.tableName || 'ShopBrainProducts';
  }

  async uploadProduct(item) {
    if (!item || !item.productId) {
      throw new Error('uploadProduct requires an object with productId');
    }
    const put = new PutCommand({ TableName: this.tableName, Item: item });
    await this.ddb.send(put);
    return { success: true, productId: item.productId };
  }

  async getProduct(productId) {
    const res = await this.ddb.send(new GetCommand({ TableName: this.tableName, Key: { productId } }));
    return res.Item || null;
  }

  async listProducts(limit = 50) {
    const res = await this.ddb.send(new ScanCommand({ TableName: this.tableName, Limit: limit }));
    return res.Items || [];
  }

  async deleteProduct(productId) {
    await this.ddb.send(new DeleteCommand({ TableName: this.tableName, Key: { productId } }));
    return { success: true };
  }

  async updateProductStatus(productId, status) {
    const res = await this.ddb.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { productId },
      UpdateExpression: 'SET #s = :s',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':s': status },
      ReturnValues: 'ALL_NEW'
    }));
    return res.Attributes;
  }
}

module.exports = DynamoDBService;
