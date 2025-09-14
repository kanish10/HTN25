const { MongoClient, ObjectId } = require('mongodb');

class MongoDBService {
  constructor() {
    this.client = null;
    this.db = null;
    this.collection = null;
    this.connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    this.databaseName = process.env.MONGODB_DATABASE || 'shopbrain';
    this.collectionName = process.env.MONGODB_COLLECTION || 'products';
  }

  /**
   * Connect to MongoDB
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.client && this.client.topology && this.client.topology.isConnected()) {
      return;
    }

    try {
      this.client = new MongoClient(this.connectionString);
      await this.client.connect();
      this.db = this.client.db(this.databaseName);
      this.collection = this.db.collection(this.collectionName);
      
      // Create indexes for better performance
      await this.collection.createIndex({ productId: 1 }, { unique: true });
      await this.collection.createIndex({ userId: 1 });
      await this.collection.createIndex({ userId: 1, productId: 1 });
      
      console.log(`Connected to MongoDB database: ${this.databaseName}`);
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
      throw new Error(`Failed to connect to MongoDB: ${error.message}`);
    }
  }

  /**
   * Disconnect from MongoDB
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.collection = null;
      console.log('Disconnected from MongoDB');
    }
  }

  /**
   * Upload a product entry to MongoDB
   * @param {Object} productData - The formatted product data
   * @returns {Promise<Object>} - The result of the insert operation
   */
  async uploadProduct(productData) {
    try {
      await this.connect();
      
      console.log(`Uploading product ${productData.productId} to MongoDB collection: ${this.collectionName}`);
      
      // Add MongoDB-specific fields
      const documentData = {
        ...productData,
        _id: new ObjectId(),
        createdAt: productData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Check if product already exists
      const existingProduct = await this.collection.findOne({ productId: productData.productId });
      if (existingProduct) {
        throw new Error(`Product with ID ${productData.productId} already exists in MongoDB`);
      }

      const result = await this.collection.insertOne(documentData);
      
      console.log(`Successfully uploaded product ${productData.productId} to MongoDB`);
      return {
        success: true,
        productId: productData.productId,
        mongoId: result.insertedId,
        message: 'Product uploaded successfully to MongoDB'
      };

    } catch (error) {
      console.error('Error uploading to MongoDB:', error);
      
      if (error.message.includes('already exists')) {
        throw error;
      }
      
      throw new Error(`Failed to upload to MongoDB: ${error.message}`);
    }
  }

  /**
   * Get a product from MongoDB by productId
   * @param {string} productId - The product ID to retrieve
   * @returns {Promise<Object>} - The product data
   */
  async getProduct(productId) {
    try {
      await this.connect();
      
      const product = await this.collection.findOne({ productId: productId });
      
      if (!product) {
        throw new Error(`Product with ID ${productId} not found`);
      }

      // Remove MongoDB-specific _id field from response
      const { _id, ...productData } = product;
      return productData;

    } catch (error) {
      console.error('Error getting product from MongoDB:', error);
      throw new Error(`Failed to get product from MongoDB: ${error.message}`);
    }
  }

  /**
   * Update a product's status in MongoDB
   * @param {string} productId - The product ID to update
   * @param {string} status - The new status
   * @returns {Promise<Object>} - The result of the update operation
   */
  async updateProductStatus(productId, status) {
    try {
      await this.connect();
      
      const updateData = {
        $set: {
          status: status,
          updatedAt: new Date().toISOString()
        }
      };

      const result = await this.collection.updateOne(
        { productId: productId },
        updateData
      );
      
      if (result.matchedCount === 0) {
        throw new Error(`Product with ID ${productId} not found`);
      }

      console.log(`Updated product ${productId} status to ${status}`);
      return {
        success: true,
        productId: productId,
        modifiedCount: result.modifiedCount,
        updatedAttributes: { status, updatedAt: updateData.$set.updatedAt }
      };

    } catch (error) {
      console.error('Error updating product status in MongoDB:', error);
      throw new Error(`Failed to update product status in MongoDB: ${error.message}`);
    }
  }

  /**
   * List all products with optional status filter
   * @param {string} status - Optional status filter
   * @param {number} limit - Optional limit for results
   * @returns {Promise<Object>} - Object containing products array and count
   */
  async listProducts(status = null, limit = 50) {
    try {
      await this.connect();
      
      const query = status ? { status: status } : {};
      
      const products = await this.collection
        .find(query)
        .limit(limit)
        .sort({ createdAt: -1 })
        .toArray();
      
      // Remove MongoDB-specific _id fields from response
      const cleanProducts = products.map(({ _id, ...product }) => product);
      
      const totalCount = await this.collection.countDocuments(query);
      
      return {
        products: cleanProducts,
        count: cleanProducts.length,
        totalCount: totalCount
      };

    } catch (error) {
      console.error('Error listing products from MongoDB:', error);
      throw new Error(`Failed to list products from MongoDB: ${error.message}`);
    }
  }

  /**
   * Delete a product from MongoDB
   * @param {string} productId - The product ID to delete
   * @returns {Promise<Object>} - The result of the delete operation
   */
  async deleteProduct(productId) {
    try {
      await this.connect();
      
      const productToDelete = await this.collection.findOne({ productId: productId });
      
      if (!productToDelete) {
        throw new Error(`Product with ID ${productId} not found`);
      }

      const result = await this.collection.deleteOne({ productId: productId });
      
      if (result.deletedCount === 0) {
        throw new Error(`Product with ID ${productId} not found`);
      }

      console.log(`Deleted product ${productId} from MongoDB`);
      
      // Remove MongoDB-specific _id field from response
      const { _id, ...deletedItem } = productToDelete;
      
      return {
        success: true,
        productId: productId,
        deletedCount: result.deletedCount,
        deletedItem: deletedItem
      };

    } catch (error) {
      console.error('Error deleting product from MongoDB:', error);
      throw new Error(`Failed to delete product from MongoDB: ${error.message}`);
    }
  }

  /**
   * Update an entire product document
   * @param {string} productId - The product ID to update
   * @param {Object} updateData - The data to update
   * @returns {Promise<Object>} - The result of the update operation
   */
  async updateProduct(productId, updateData) {
    try {
      await this.connect();
      
      const updateDocument = {
        $set: {
          ...updateData,
          updatedAt: new Date().toISOString()
        }
      };

      const result = await this.collection.updateOne(
        { productId: productId },
        updateDocument
      );
      
      if (result.matchedCount === 0) {
        throw new Error(`Product with ID ${productId} not found`);
      }

      console.log(`Updated product ${productId} in MongoDB`);
      return {
        success: true,
        productId: productId,
        modifiedCount: result.modifiedCount
      };

    } catch (error) {
      console.error('Error updating product in MongoDB:', error);
      throw new Error(`Failed to update product in MongoDB: ${error.message}`);
    }
  }

  /**
   * Search products by text query
   * @param {string} searchQuery - Text to search for
   * @param {number} limit - Optional limit for results
   * @returns {Promise<Object>} - Object containing matching products
   */
  async searchProducts(searchQuery, limit = 50) {
    try {
      await this.connect();
      
      // Create text search query
      const query = {
        $or: [
          { 'extractedData.title': { $regex: searchQuery, $options: 'i' } },
          { 'extractedData.description': { $regex: searchQuery, $options: 'i' } },
          { 'extractedData.category': { $regex: searchQuery, $options: 'i' } },
          { 'extractedData.brand': { $regex: searchQuery, $options: 'i' } },
          { 'generatedContent.seoTitle': { $regex: searchQuery, $options: 'i' } },
          { 'generatedContent.seoDescription': { $regex: searchQuery, $options: 'i' } }
        ]
      };
      
      const products = await this.collection
        .find(query)
        .limit(limit)
        .sort({ createdAt: -1 })
        .toArray();
      
      // Remove MongoDB-specific _id fields from response
      const cleanProducts = products.map(({ _id, ...product }) => product);
      
      return {
        products: cleanProducts,
        count: cleanProducts.length,
        searchQuery: searchQuery
      };

    } catch (error) {
      console.error('Error searching products in MongoDB:', error);
      throw new Error(`Failed to search products in MongoDB: ${error.message}`);
    }
  }

  // ========= USER-SPECIFIC METHODS =========

  /**
   * Get a product from MongoDB by productId and userId
   * @param {string} userId - The user ID
   * @param {string} productId - The product ID to retrieve
   * @returns {Promise<Object>} - The product data
   */
  async getProductByUser(userId, productId) {
    try {
      await this.connect();
      
      const product = await this.collection.findOne({ 
        userId: userId, 
        productId: productId 
      });
      
      if (!product) {
        throw new Error(`Product with ID ${productId} not found for user ${userId}`);
      }

      // Remove MongoDB-specific _id field from response
      const { _id, ...productData } = product;
      return productData;

    } catch (error) {
      console.error('Error getting product from MongoDB:', error);
      throw new Error(`Failed to get product from MongoDB: ${error.message}`);
    }
  }

  /**
   * List products for a specific user with optional status filter
   * @param {string} userId - The user ID
   * @param {string} status - Optional status filter
   * @param {number} limit - Optional limit for results
   * @returns {Promise<Object>} - Object containing products array and count
   */
  async listProductsByUser(userId, status = null, limit = 50) {
    try {
      await this.connect();
      
      const query = { userId: userId };
      if (status) {
        query.status = status;
      }
      
      const products = await this.collection
        .find(query)
        .limit(limit)
        .sort({ createdAt: -1 })
        .toArray();
      
      // Remove MongoDB-specific _id fields from response
      const cleanProducts = products.map(({ _id, ...product }) => product);
      
      const totalCount = await this.collection.countDocuments(query);
      
      return {
        products: cleanProducts,
        count: cleanProducts.length,
        totalCount: totalCount
      };

    } catch (error) {
      console.error('Error listing products from MongoDB:', error);
      throw new Error(`Failed to list products from MongoDB: ${error.message}`);
    }
  }

  /**
   * Search products by text query for a specific user
   * @param {string} userId - The user ID
   * @param {string} searchQuery - Text to search for
   * @param {number} limit - Optional limit for results
   * @returns {Promise<Object>} - Object containing matching products
   */
  async searchProductsByUser(userId, searchQuery, limit = 50) {
    try {
      await this.connect();
      
      // Create text search query with user filter
      const query = {
        userId: userId,
        $or: [
          { 'extractedData.title': { $regex: searchQuery, $options: 'i' } },
          { 'extractedData.description': { $regex: searchQuery, $options: 'i' } },
          { 'extractedData.category': { $regex: searchQuery, $options: 'i' } },
          { 'extractedData.brand': { $regex: searchQuery, $options: 'i' } },
          { 'generatedContent.seoTitle': { $regex: searchQuery, $options: 'i' } },
          { 'generatedContent.seoDescription': { $regex: searchQuery, $options: 'i' } }
        ]
      };
      
      const products = await this.collection
        .find(query)
        .limit(limit)
        .sort({ createdAt: -1 })
        .toArray();
      
      // Remove MongoDB-specific _id fields from response
      const cleanProducts = products.map(({ _id, ...product }) => product);
      
      return {
        products: cleanProducts,
        count: cleanProducts.length,
        searchQuery: searchQuery,
        userId: userId
      };

    } catch (error) {
      console.error('Error searching products in MongoDB:', error);
      throw new Error(`Failed to search products in MongoDB: ${error.message}`);
    }
  }

  /**
   * Update a product's status in MongoDB for a specific user
   * @param {string} userId - The user ID
   * @param {string} productId - The product ID to update
   * @param {string} status - The new status
   * @returns {Promise<Object>} - The result of the update operation
   */
  async updateProductStatusByUser(userId, productId, status) {
    try {
      await this.connect();
      
      const updateData = {
        $set: {
          status: status,
          updatedAt: new Date().toISOString()
        }
      };

      const result = await this.collection.updateOne(
        { userId: userId, productId: productId },
        updateData
      );
      
      if (result.matchedCount === 0) {
        throw new Error(`Product with ID ${productId} not found for user ${userId}`);
      }

      console.log(`Updated product ${productId} status to ${status} for user ${userId}`);
      return {
        success: true,
        productId: productId,
        userId: userId,
        modifiedCount: result.modifiedCount,
        updatedAttributes: { status, updatedAt: updateData.$set.updatedAt }
      };

    } catch (error) {
      console.error('Error updating product status in MongoDB:', error);
      throw new Error(`Failed to update product status in MongoDB: ${error.message}`);
    }
  }

  /**
   * Update an entire product document for a specific user
   * @param {string} userId - The user ID
   * @param {string} productId - The product ID to update
   * @param {Object} updateData - The data to update
   * @returns {Promise<Object>} - The result of the update operation
   */
  async updateProductByUser(userId, productId, updateData) {
    try {
      await this.connect();
      
      const updateDocument = {
        $set: {
          ...updateData,
          updatedAt: new Date().toISOString()
        }
      };

      const result = await this.collection.updateOne(
        { userId: userId, productId: productId },
        updateDocument
      );
      
      if (result.matchedCount === 0) {
        throw new Error(`Product with ID ${productId} not found for user ${userId}`);
      }

      console.log(`Updated product ${productId} for user ${userId} in MongoDB`);
      return {
        success: true,
        productId: productId,
        userId: userId,
        modifiedCount: result.modifiedCount
      };

    } catch (error) {
      console.error('Error updating product in MongoDB:', error);
      throw new Error(`Failed to update product in MongoDB: ${error.message}`);
    }
  }

  /**
   * Delete a product from MongoDB for a specific user
   * @param {string} userId - The user ID
   * @param {string} productId - The product ID to delete
   * @returns {Promise<Object>} - The result of the delete operation
   */
  async deleteProductByUser(userId, productId) {
    try {
      await this.connect();
      
      const productToDelete = await this.collection.findOne({ 
        userId: userId, 
        productId: productId 
      });
      
      if (!productToDelete) {
        throw new Error(`Product with ID ${productId} not found for user ${userId}`);
      }

      const result = await this.collection.deleteOne({ 
        userId: userId, 
        productId: productId 
      });
      
      if (result.deletedCount === 0) {
        throw new Error(`Product with ID ${productId} not found for user ${userId}`);
      }

      console.log(`Deleted product ${productId} for user ${userId} from MongoDB`);
      
      // Remove MongoDB-specific _id field from response
      const { _id, ...deletedItem } = productToDelete;
      
      return {
        success: true,
        productId: productId,
        userId: userId,
        deletedCount: result.deletedCount,
        deletedItem: deletedItem
      };

    } catch (error) {
      console.error('Error deleting product from MongoDB:', error);
      throw new Error(`Failed to delete product from MongoDB: ${error.message}`);
    }
  }
}

module.exports = MongoDBService;
