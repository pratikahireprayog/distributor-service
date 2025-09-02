/**
 * Script to seed Porter endpoint configurations in the database
 * 
 * This script creates the necessary endpoint configurations for Porter's API endpoints
 * including the cancel order functionality.
 * 
 * Usage:
 * 1. Ensure MongoDB is running and accessible
 * 2. Update the connection string and database name as needed
 * 3. Run: node setup-endpoint-configs.js
 */

const { MongoClient } = require('mongodb');

// Configuration - Update these values as needed
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = process.env.DATABASE_NAME || 'distributor_service';
const COLLECTION_NAME = 'endpointconfigs';

// Porter endpoint configurations
const porterEndpointConfigs = [
  {
    name: "Porter Cancel Order API",
    method: "POST",
    partnerCode: "PORTER",
    url: "https://pfe-apigw-uat.porter.in/v1/orders/{order_id}/cancel",
    endpointId: "CANCEL_ORDER",
    contentType: "application/json",
    requiresAuth: true,
         urlParamMapping: [
       {
         paramName: "order_id",
         sourceField: "orderId"
       }
     ],
    headerMapping: [
      {
        headerName: "x-api-key",
        sourceField: "apiKey"
      }
    ],
    payloadMapperConfig: {
      fields: [
        {
          sources: "cancelReason",
          destination: "cancel_reason"
        }
      ]
    },
    responseMapping: {
      successPath: "status",
      statusCodePath: "status",
      messagePath: "message",
      dataPath: "data"
    },
    timeout: 30000,
    retryCount: 3,
    retryDelay: 1000,
    partnerId: "PORTER", // This field is required by the schema
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: "Porter Create Order API",
    method: "POST",
    partnerCode: "PORTER",
    url: "https://pfe-apigw-uat.porter.in/v1/orders",
    endpointId: "CREATE_ORDER",
    contentType: "application/json",
    requiresAuth: true,
    headerMapping: [
      {
        headerName: "x-api-key",
        sourceField: "apiKey"
      }
    ],
    payloadMapperConfig: {
      fields: [
        {
          sources: "orderId",
          destination: "order_id"
        },
        {
          sources: "referenceId",
          destination: "reference_id"
        },
        {
          sources: "parcelCategory",
          destination: "parcel_category"
        },
        {
          sources: "orderDate",
          destination: "order_date"
        },
        {
          sources: "expectedDeliveryDate",
          destination: "expected_delivery_date"
        }
      ]
    },
    responseMapping: {
      successPath: "status",
      statusCodePath: "status",
      messagePath: "message",
      dataPath: "data"
    },
    timeout: 30000,
    retryCount: 3,
    retryDelay: 1000,
    partnerId: "PORTER",
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

async function setupEndpointConfigs() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    console.log('Connected to MongoDB successfully');
    
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    console.log(`Setting up endpoint configurations for Porter in database: ${DATABASE_NAME}`);
    
    for (const config of porterEndpointConfigs) {
      const existingConfig = await collection.findOne({
        partnerCode: config.partnerCode,
        endpointId: config.endpointId
      });
      
      if (existingConfig) {
        console.log(`Updating existing endpoint config: ${config.partnerCode} - ${config.endpointId}`);
        await collection.updateOne(
          { _id: existingConfig._id },
          { $set: { ...config, updatedAt: new Date() } }
        );
      } else {
        console.log(`Creating new endpoint config: ${config.partnerCode} - ${config.endpointId}`);
        await collection.insertOne(config);
      }
    }
    
    console.log('✅ Porter endpoint configurations setup completed successfully!');
    
    // Verify the configurations
    const verifyConfigs = await collection.find({ partnerCode: "PORTER" }).toArray();
    console.log(`\n📋 Found ${verifyConfigs.length} endpoint configurations for Porter:`);
    verifyConfigs.forEach(config => {
      console.log(`  - ${config.endpointId}: ${config.name}`);
    });
    
  } catch (error) {
    console.error('❌ Error setting up endpoint configurations:', error);
    throw error;
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

// Run the setup if this script is executed directly
if (require.main === module) {
  setupEndpointConfigs()
    .then(() => {
      console.log('\n🎉 Setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupEndpointConfigs, porterEndpointConfigs };
