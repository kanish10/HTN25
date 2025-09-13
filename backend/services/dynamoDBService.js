const AWS = require('aws-sdk');

class DynamoDBService {
  constructor() {
    // Configure AWS SDK
    AWS.config.update({
      region: process.env.AWS_REGION,// || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    });

    this.dynamodb = new AWS.DynamoDB.DocumentClient();
    this.tableName = process.env.DYNAMODB_NAME// | 'shopBrainProducts';
  }

  /**
   * Upload a product entry to DynamoDB
   * @param {Object} productData - The formatted product data
   * @returns {Promise<Object>} - The result of the put operation
   */
  async uploadProduct(productData) {
    try {
      console.log(`Uploading product ${productData.productId} to DynamoDB table: ${this.tableName}`);
      
      const params = {
        TableName: this.tableName,
        Item: productData,
        // Prevent overwriting existing items with the same productId
        ConditionExpression: 'attribute_not_exists(productId)'
      };

      const result = await this.dynamodb.put(params).promise();
      
      console.log(`Successfully uploaded product ${productData.productId} to DynamoDB`);
      return {
        success: true,
        productId: productData.productId,
        message: 'Product uploaded successfully to DynamoDB'
      };

    } catch (error) {
      console.error('Error uploading to DynamoDB:', error);
      
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Product with ID ${productData.productId} already exists in DynamoDB`);
      }
      
      throw new Error(`Failed to upload to DynamoDB: ${error.message}`);
    }
  }

  /**
   * Get a product from DynamoDB by productId
   * @param {string} productId - The product ID to retrieve
   * @returns {Promise<Object>} - The product data
   */
  async getProduct(productId) {
    try {
      const params = {
        TableName: this.tableName,
        Key: {
          productId: productId
        }
      };

      const result = await this.dynamodb.get(params).promise();
      
      if (!result.Item) {
        throw new Error(`Product with ID ${productId} not found`);
      }

      return result.Item;

    } catch (error) {
      console.error('Error getting product from DynamoDB:', error);
      throw new Error(`Failed to get product from DynamoDB: ${error.message}`);
    }
  }

  /**
   * Update a product's status in DynamoDB
   * @param {string} productId - The product ID to update
   * @param {string} status - The new status
   * @returns {Promise<Object>} - The result of the update operation
   */
  async updateProductStatus(productId, status) {
    try {
      const params = {
        TableName: this.tableName,
        Key: {
          productId: productId
        },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': status,
          ':updatedAt': new Date().toISOString()
        },
        ReturnValues: 'UPDATED_NEW'
      };

      const result = await this.dynamodb.update(params).promise();
      
      console.log(`Updated product ${productId} status to ${status}`);
      return {
        success: true,
        productId: productId,
        updatedAttributes: result.Attributes
      };

    } catch (error) {
      console.error('Error updating product status in DynamoDB:', error);
      throw new Error(`Failed to update product status in DynamoDB: ${error.message}`);
    }
  }

  /**
   * List all products with optional status filter
   * @param {string} status - Optional status filter
   * @param {number} limit - Optional limit for results
   * @returns {Promise<Array>} - Array of products
   */
  async listProducts(status = null, limit = 50) {
    try {
      const params = {
        TableName: this.tableName,
        Limit: limit
      };

      if (status) {
        params.FilterExpression = '#status = :status';
        params.ExpressionAttributeNames = {
          '#status': 'status'
        };
        params.ExpressionAttributeValues = {
          ':status': status
        };
      }

      const result = await this.dynamodb.scan(params).promise();
      
      return {
        products: result.Items,
        count: result.Count,
        scannedCount: result.ScannedCount
      };

    } catch (error) {
      console.error('Error listing products from DynamoDB:', error);
      throw new Error(`Failed to list products from DynamoDB: ${error.message}`);
    }
  }

  /**
   * Delete a product from DynamoDB
   * @param {string} productId - The product ID to delete
   * @returns {Promise<Object>} - The result of the delete operation
   */
  async deleteProduct(productId) {
    try {
      const params = {
        TableName: this.tableName,
        Key: {
          productId: productId
        },
        ReturnValues: 'ALL_OLD'
      };

      const result = await this.dynamodb.delete(params).promise();
      
      if (!result.Attributes) {
        throw new Error(`Product with ID ${productId} not found`);
      }

      console.log(`Deleted product ${productId} from DynamoDB`);
      return {
        success: true,
        productId: productId,
        deletedItem: result.Attributes
      };

    } catch (error) {
      console.error('Error deleting product from DynamoDB:', error);
      throw new Error(`Failed to delete product from DynamoDB: ${error.message}`);
    }
  }
}

module.exports = DynamoDBService;
