const Shopify = require('shopify-api-node');

class ShopifyService {
  constructor() {
    this.shopify = new Shopify({
      shopName: process.env.SHOPIFY_SHOP_NAME,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN
    });
    
    console.log('🛍️  ShopifyService initialized for shop:', process.env.SHOPIFY_SHOP_NAME);
  }

  async publishProduct(analysisData) {
    try {
      const { extractedData, generatedContent, shippingData } = analysisData;
      
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
      
      return {
        success: true,
        productId: product.id,
        productUrl: `https://${process.env.SHOPIFY_SHOP_NAME}.myshopify.com/admin/products/${product.id}`,
        publicUrl: `https://${process.env.SHOPIFY_SHOP_NAME}.myshopify.com/products/${product.handle}`,
        product: product
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
    try {
      const product = await this.shopify.product.get(productId);
      return product;
    } catch (error) {
      console.error('❌ Error fetching product:', error);
      throw error;
    }
  }

  async deleteProduct(productId) {
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
}

module.exports = ShopifyService;