#!/usr/bin/env node

/**
 * Register ShopBrain 3D Optimized Shipping as a Carrier Service in Shopify
 * This script creates/updates the carrier service that will show up in your Shopify checkout
 */

const dotenv = require('dotenv');
dotenv.config();

const ShopifyService = require('../services/shopifyService');

async function registerCarrierService() {
  console.log('🚀 Registering ShopBrain 3D Optimized Shipping Carrier Service...');

  try {
    const shopifyService = new ShopifyService();

    // Carrier service configuration
    const carrierServiceData = {
      name: 'ShopBrain 3D Optimized Shipping',
      callback_url: `${process.env.CARRIER_SERVICE_CALLBACK_URL || 'https://your-domain.ngrok.io'}/api/shopify/shipping-rates`,
      service_discovery: true,
      carrier_service_type: 'api',
      format: 'json'
    };

    console.log('📋 Carrier service configuration:');
    console.log(JSON.stringify(carrierServiceData, null, 2));

    // Check if carrier service already exists
    console.log('\n🔍 Checking for existing carrier services...');
    const existingServices = await shopifyService.makeRequest('GET', 'carrier_services.json');

    const existingService = existingServices.find(
      service => service.name === carrierServiceData.name
    );

    let result;
    if (existingService) {
      console.log(`📦 Found existing carrier service (ID: ${existingService.id}). Updating...`);

      // Update existing service
      result = await shopifyService.makeRequest(
        'PUT',
        `carrier_services/${existingService.id}.json`,
        carrierServiceData
      );

      console.log('✅ Carrier service updated successfully!');
    } else {
      console.log('🆕 Creating new carrier service...');

      // Create new service
      result = await shopifyService.makeRequest(
        'POST',
        'carrier_services.json',
        carrierServiceData
      );

      console.log('✅ Carrier service created successfully!');
    }

    const service = result;
    console.log('\n📦 Carrier Service Details:');
    console.log(`   ID: ${service.id}`);
    console.log(`   Name: ${service.name}`);
    console.log(`   Callback URL: ${service.callback_url}`);
    console.log(`   Active: ${service.active}`);
    console.log(`   Service Discovery: ${service.service_discovery}`);

    console.log('\n🎉 Setup Complete!');
    console.log('\n📝 Next Steps:');
    console.log('1. Make sure your callback URL is publicly accessible (use ngrok for local development)');
    console.log('2. Test the integration by adding items to your Shopify cart');
    console.log('3. During checkout, you should see "ShopBrain 3D Optimized Shipping" options');
    console.log('\n🔧 Your callback URL should be:');
    console.log(`   ${service.callback_url}`);
    console.log('\n💡 For local development, run:');
    console.log('   ngrok http 3003');
    console.log('   Then update CARRIER_SERVICE_CALLBACK_URL in your .env file');

    // Test the callback URL
    console.log('\n🧪 Testing callback URL accessibility...');
    try {
      const response = await fetch(service.callback_url.replace('/api/shopify/shipping-rates', '/health'));
      if (response.ok) {
        console.log('✅ Callback URL is accessible');
      } else {
        console.log('⚠️ Callback URL returned non-200 status');
      }
    } catch (error) {
      console.log('❌ Callback URL is not accessible:', error.message);
      console.log('   Make sure your server is running and publicly accessible');
    }

  } catch (error) {
    console.error('❌ Failed to register carrier service:', error);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  registerCarrierService().catch(console.error);
}

module.exports = { registerCarrierService };