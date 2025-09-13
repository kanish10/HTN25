const Shopify = require('shopify-api-node');

class ShopifyService {
  constructor() {
    // Check if Shopify credentials are available
    if (!process.env.SHOPIFY_SHOP_NAME || !process.env.SHOPIFY_ACCESS_TOKEN) {
      console.warn('⚠️  Shopify credentials not configured. Shopify functionality will be disabled.');
      this.shopify = null;
      this.enabled = false;
      return;
    }

    try {
      this.shopify = new Shopify({
        shopName: process.env.SHOPIFY_SHOP_NAME,
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN
      });
      this.enabled = true;
      console.log('🛍️  ShopifyService initialized for shop:', process.env.SHOPIFY_SHOP_NAME);
    } catch (error) {
      console.error('❌ Failed to initialize Shopify service:', error.message);
      this.shopify = null;
      this.enabled = false;
    }
  }

  async publishProduct(analysisData) {
    if (!this.enabled || !this.shopify) {
      throw new Error('Shopify service is not configured. Please check your SHOPIFY_SHOP_NAME and SHOPIFY_ACCESS_TOKEN environment variables.');
    }

    try {
      const { extractedData, generatedContent, shippingData } = analysisData;

      // Step 1: Create collections if they don't exist
      const collectionIds = await this.createOrGetCollections(extractedData.shopifyCollections || []);
      
      // Prepare Shopify product data
      const productData = {
        title: generatedContent.title,
        body_html: this.formatProductDescription(extractedData, generatedContent),
        vendor: 'ShopBrain AI',
        product_type: extractedData.category,
        tags: generatedContent.seoTags.join(', '),
        status: 'draft', // Start as draft for review
        
        variants: [{
          price: extractedData.suggestedPrice.min.toString(),
          compare_at_price: extractedData.suggestedPrice.max.toString(),
          weight: Math.round(extractedData.estimatedWeight * 453.592), // Convert lbs to grams
          weight_unit: 'g',
          requires_shipping: true,
          taxable: true,
          inventory_management: 'shopify',
          inventory_quantity: 10, // Default stock
          fulfillment_service: 'manual'
        }],
        
        options: [{
          name: 'Title',
          values: ['Default Title']
        }],
        
        metafields: [
          {
            namespace: 'shopbrain',
            key: 'ai_analysis',
            value: JSON.stringify({
              product_type: extractedData.productType,
              material: extractedData.material,
              color: extractedData.color,
              dimensions: extractedData.dimensions,
              features: extractedData.features,
              target_audience: extractedData.targetAudience,
              shipping_recommendation: shippingData.singleItem,
              ai_cost: generatedContent.aiCosts.total,
              analysis_date: new Date().toISOString()
            }),
            type: 'json'
          },
          {
            namespace: 'shopbrain',
            key: 'shipping_optimization',
            value: JSON.stringify(shippingData),
            type: 'json'
          },
          {
            namespace: 'shopbrain',
            key: 'ab_variants',
            value: JSON.stringify(generatedContent.abVariants),
            type: 'json'
          }
        ]
      };
      
      // Create the product
      console.log('📦 Creating Shopify product:', productData.title);
      const product = await this.shopify.product.create(productData);

      console.log('✅ Product created successfully:', product.id);

      // Step 2: Upload product image if imageUrl is provided
      if (analysisData.imageUrl) {
        await this.addProductImage(product.id, analysisData.imageUrl);
      }

      // Step 3: Add product to collections
      if (collectionIds.length > 0) {
        await this.addProductToCollections(product.id, collectionIds);
      }
      
      return {
        success: true,
        productId: product.id,
        productUrl: `https://${process.env.SHOPIFY_SHOP_NAME}.myshopify.com/admin/products/${product.id}`,
        publicUrl: `https://${process.env.SHOPIFY_SHOP_NAME}.myshopify.com/products/${product.handle}`,
        product: product,
        collections: {
          requested: extractedData.shopifyCollections || [],
          created: collectionIds,
          count: collectionIds.length
        }
      };
      
    } catch (error) {
      console.error('❌ Shopify publishing error:', error);
      
      // Handle specific Shopify errors
      if (error.statusCode === 401) {
        throw new Error('Invalid Shopify credentials. Check your access token.');
      } else if (error.statusCode === 422) {
        throw new Error('Invalid product data: ' + (error.body?.errors ? JSON.stringify(error.body.errors) : error.message));
      } else if (error.statusCode === 429) {
        throw new Error('Shopify API rate limit exceeded. Please try again later.');
      } else {
        throw new Error(`Shopify API error: ${error.message}`);
      }
    }
  }

  formatProductDescription(extractedData, generatedContent) {
    return `
      <div class="shopbrain-product">
        <h2>Product Description</h2>
        <p>${generatedContent.description}</p>
        
        <h3>Key Features</h3>
        <ul>
          ${generatedContent.bulletPoints.map(point => `<li>${point}</li>`).join('')}
        </ul>
        
        <h3>Product Details</h3>
        <ul>
          <li><strong>Material:</strong> ${extractedData.material}</li>
          <li><strong>Color:</strong> ${extractedData.color}</li>
          <li><strong>Dimensions:</strong> ${extractedData.dimensions.length}" × ${extractedData.dimensions.width}" × ${extractedData.dimensions.height}"</li>
          <li><strong>Weight:</strong> ${extractedData.estimatedWeight} lbs</li>
        </ul>
        
        ${generatedContent.faq && generatedContent.faq.length > 0 ? `
        <h3>Frequently Asked Questions</h3>
        <div class="faq">
          ${generatedContent.faq.map(item => `
            <div class="faq-item">
              <strong>Q: ${item.question}</strong><br>
              <span>A: ${item.answer}</span>
            </div>
          `).join('')}
        </div>
        ` : ''}
        
        <div class="shopbrain-attribution" style="margin-top: 20px; padding: 10px; background: #f5f5f5; border-radius: 5px; font-size: 12px; color: #666;">
          <em>📦 Optimized shipping: ${extractedData.productType} fits perfectly in a ${generatedContent.shippingData?.singleItem?.recommendedBox || 'recommended box'}</em><br>
          <em>🤖 Product analysis powered by ShopBrain AI</em>
        </div>
      </div>
    `;
  }

  async updateProductStatus(productId, status = 'active') {
    if (!this.enabled || !this.shopify) {
      throw new Error('Shopify service is not configured.');
    }

    try {
      const updatedProduct = await this.shopify.product.update(productId, { status });
      console.log(`📢 Product ${productId} status updated to: ${status}`);
      return updatedProduct;
    } catch (error) {
      console.error('❌ Error updating product status:', error);
      throw error;
    }
  }

  async getProduct(productId) {
    if (!this.enabled || !this.shopify) {
      throw new Error('Shopify service is not configured.');
    }

    try {
      const product = await this.shopify.product.get(productId);
      return product;
    } catch (error) {
      console.error('❌ Error fetching product:', error);
      throw error;
    }
  }

  async deleteProduct(productId) {
    if (!this.enabled || !this.shopify) {
      throw new Error('Shopify service is not configured.');
    }

    try {
      await this.shopify.product.delete(productId);
      console.log(`🗑️  Product ${productId} deleted`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting product:', error);
      throw error;
    }
  }

  // Test connection to Shopify
  async testConnection() {
    if (!this.enabled || !this.shopify) {
      throw new Error('Shopify service is not configured. Please check your SHOPIFY_SHOP_NAME and SHOPIFY_ACCESS_TOKEN environment variables.');
    }

    try {
      const shop = await this.shopify.shop.get();
      console.log('✅ Shopify connection successful:', shop.name);
      return {
        success: true,
        shop: {
          name: shop.name,
          domain: shop.domain,
          email: shop.email,
          currency: shop.currency
        }
      };
    } catch (error) {
      console.error('❌ Shopify connection failed:', error);
      throw error;
    }
  }

  // Create collections if they don't exist, return collection IDs
  async createOrGetCollections(collectionNames) {
    if (!collectionNames || collectionNames.length === 0) {
      return [];
    }

    const collectionIds = [];

    for (const collectionName of collectionNames) {
      try {
        // First, try to find existing collection
        const existingCollections = await this.shopify.customCollection.list({
          title: collectionName,
          limit: 1
        });

        let collection;
        if (existingCollections.length > 0) {
          collection = existingCollections[0];
          console.log(`📂 Found existing collection: ${collectionName} (ID: ${collection.id})`);
        } else {
          // Create new collection
          collection = await this.shopify.customCollection.create({
            title: collectionName,
            body_html: `<p>AI-curated collection: ${collectionName}</p>`,
            handle: collectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            published: true,
            sort_order: 'best-selling',
            metafields: [
              {
                namespace: 'shopbrain',
                key: 'created_by_ai',
                value: 'true',
                type: 'boolean'
              },
              {
                namespace: 'shopbrain',
                key: 'creation_date',
                value: new Date().toISOString(),
                type: 'date_time'
              }
            ]
          });
          console.log(`✨ Created new collection: ${collectionName} (ID: ${collection.id})`);
        }

        collectionIds.push(collection.id);
      } catch (error) {
        console.error(`❌ Error creating/finding collection "${collectionName}":`, error.message);
        // Continue with other collections even if one fails
      }
    }

    return collectionIds;
  }

  // Add product image
  async addProductImage(productId, imageUrl) {
    if (!imageUrl) {
      console.log(`⚠️ No image URL provided for product ${productId}`);
      return;
    }

    try {
      // Validate image URL format
      if (!imageUrl.startsWith('http')) {
        console.error(`❌ Invalid image URL format for product ${productId}: ${imageUrl}`);
        return null;
      }

      console.log(`📸 Attempting to add image to product ${productId}: ${imageUrl}`);

      // Create product image from URL
      const image = await this.shopify.productImage.create(productId, {
        src: imageUrl,
        alt: 'Product image - AI selected best image',
        position: 1 // Make it the main image
      });

      console.log(`✅ Successfully added product image to Shopify product ${productId}: ${image.id}`);
      return image;
    } catch (error) {
      console.error(`❌ Error adding image to product ${productId}:`, {
        message: error.message,
        statusCode: error.statusCode,
        body: error.body,
        imageUrl: imageUrl
      });

      // Try a fallback approach - sometimes the issue is timing
      if (error.statusCode === 422) {
        console.log(`🔄 Retrying image upload for product ${productId} after delay...`);
        try {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          const retryImage = await this.shopify.productImage.create(productId, {
            src: imageUrl,
            alt: 'Product image',
            position: 1
          });
          console.log(`✅ Retry successful - added image to product ${productId}: ${retryImage.id}`);
          return retryImage;
        } catch (retryError) {
          console.error(`❌ Retry failed for product ${productId}:`, retryError.message);
        }
      }

      // Continue without failing the entire product creation
      return null;
    }
  }

  // Add product to collections
  async addProductToCollections(productId, collectionIds) {
    if (!collectionIds || collectionIds.length === 0) {
      return;
    }

    for (const collectionId of collectionIds) {
      try {
        await this.shopify.collect.create({
          product_id: productId,
          collection_id: collectionId
        });
        console.log(`🔗 Added product ${productId} to collection ${collectionId}`);
      } catch (error) {
        console.error(`❌ Error adding product ${productId} to collection ${collectionId}:`, error.message);
        // Continue with other collections even if one fails
      }
    }
  }
}

module.exports = ShopifyService;