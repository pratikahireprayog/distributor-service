
#INDIA_POST_INTERNATIONAL CONFIGURATION
INDIA_POST_CREATE_ORDER_URL=https://test.cept.gov.in/becommailbooking/v1/international-bookings
INDIA_POST_LOGIN_URL=https://test.cept.gov.in/beitrolemgmt/rolemanagement/v1/auth/CommonLogin
INDIA_POST_USERNAME=1727068778
INDIA_POST_PASSWORD=Dop@1234
INDIA_POST_REALM=customer-portal




curl -X POST http://localhost:3039/distributor/create-order-v2 \
  -H "Content-Type: application/json" \
  -d '{
    "partnerCode": "INDIA_POST_INTERNATIONAL",
    "order": {
      "orderId": "1256",
      "referenceId": "CFYGUYIHO",
      "expectedDeliveryDate": "2024-05-20T08:30:30Z",
      "serviceType": "value-plus",
      "orderStatus": "DRAFT",
      "metadata": {
        "source": "WEB_APP",
        "createdBy": "user123"
      },
      "addresses": [
        {
          "type": "PICKUP",
          "zip": "411028",
          "name": "Rohan Sharma",
          "phone": "6313131313",
          "email": "rohan@yopmail.com",
          "street": "32, pocket D, sector 8, Near City Center",
          "landmark": "Near Metro Station",
          "city": "Mumbai",
          "state": "Maharashtra",
          "country": "India",
          "addressName": "WAREHOUSE"
        },
        {
          "type": "DELIVERY",
          "zip": "10001",
          "name": "Jane Smith",
          "phone": "2125557890",
          "email": "jane@example.com",
          "street": "123 Madison Avenue",
          "landmark": "Near Penn Station",
          "city": "New York",
          "state": "NY",
          "country": "United States",
          "countryCode": "US",
          "addressName": "TechCorp"
        }
      ],
      "parentShipment": {
        "awbNumber": "1234",
        "cAwbNumber": "24800236006",
        "smileAwbNumber": "24800236006",
        "dimensions": {
          "length": 30,
          "width": 20,
          "height": 10
        },
        "physicalWeight": 300,
        "volumetricWeight": 400,
        "note": "Handle with care",
        "items": [
          {
            "name": "Smartphone",
            "quantity": 1,
            "weight": 200,
            "unitPrice": 25000,
            "sku": "SKU001",
            "hsnCode": "85171200",
            "description": "Latest smartphone model"
          }
        ]
      },
      "childShipments": [
        {
          "awbNumber": "1234",
          "dimensions": {
            "length": 30,
            "width": 20,
            "height": 10
          },
          "physicalWeight": 300,
          "volumetricWeight": 400,
          "items": [
            {
              "name": "Smartphone",
              "quantity": 1,
              "weight": 200,
              "unitPrice": 25000,
              "sku": "SKU001",
              "hsnCode": "85171200"
            }
          ]
        }
      ],
      "slots": [
        {
          "slotType": "PICKUP",
          "startTime": "2024-05-18T10:00:00Z",
          "endTime": "2024-05-18T12:00:00Z"
        }
      ],
      "payment": {
        "finalAmount": 29500,
        "type": "PREPAID",
        "breakdown": {
          "subTotal": 25000,
          "taxes": [
            {
              "name": "Gst",
              "chargedAmount": 4500
            }
          ],
          "otherCharges": [
            {
              "name": "Shipping Charges",
              "chargedAmount": 1250
            }
          ]
        }
      }
    }
  }'
```

