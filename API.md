# VetriTrack API - Endpoints & Middleware Documentation

## Table of Contents
1. [Global Middleware & Filters](#global-middleware--filters)
2. [Authentication Endpoints](#authentication-endpoints)
3. [Inventory Endpoints](#inventory-endpoints)
4. [Suppliers Endpoints](#suppliers-endpoints)
5. [Purchase Orders Endpoints](#purchase-orders-endpoints)
6. [Transactions Endpoints](#transactions-endpoints)
7. [Approvals Endpoints](#approvals-endpoints)

---

## Global Middleware & Filters

### Exception Filter
**File**: [src/filters/exception-filter.ts](src/filters/exception-filter.ts)

Catches all unhandled exceptions and returns formatted error responses.

**Response Format:**
```json
{
  "statusCode": 400,
  "timestamp": "2026-01-15T10:30:00.000Z",
  "path": "/api/endpoint",
  "message": "Error description"
}
```

**Applied In**: [src/main.ts](src/main.ts)
```typescript
app.useGlobalFilters(new AllExceptionsFilter());
```

### CORS Configuration
**File**: [src/main.ts](src/main.ts)

Enables Cross-Origin Resource Sharing for frontend communication.

```typescript
app.enableCors();
```

---

## Authentication Endpoints

**Base URL**: `/auth`
**Module**: [src/auth/auth.module.ts](src/auth/auth.module.ts)
**Controller**: [src/auth/auth.controller.ts](src/auth/auth.controller.ts)
**Service**: [src/auth/auth.service.ts](src/auth/auth.service.ts)

### 1. Sign Up (Register New User)

**POST** `/auth/signup`

Creates a new user account with role-based access.

**Request Body:**
```json
{
  "fullName": "John Doe",
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "role": "staff"
}
```

**Query Parameters**: None

**Headers Required**: None

**Response (201 Created):**
```json
{
  "message": "User registered successfully"
}
```

**Validation Rules:**
- `fullName`: Required string
- `username`: Required string (unique)
- `email`: Required valid email (unique)
- `password`: Required, minimum 6 characters
- `role`: Required enum - `'staff'` or `'owner'`

**Error Responses:**
- `409 Conflict`: Username or email already exists
- `400 Bad Request`: Invalid data format

**Middleware**: None (public endpoint)

---

### 2. Login (User Authentication)

**POST** `/auth/login`

Authenticates user and returns JWT token.

**Request Body:**
```json
{
  "username": "johndoe",
  "password": "SecurePass123"
}
```

**Query Parameters**: None

**Headers Required**: None

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "username": "johndoe",
    "role": "staff"
  }
}
```

**Validation Rules:**
- `username`: Required string
- `password`: Required string

**Error Responses:**
- `401 Unauthorized`: Invalid credentials or account inactive
- `400 Bad Request`: Missing required fields

**Token Details:**
- **Expires In**: 1 day
- **Type**: Bearer
- **Usage**: Add to headers: `Authorization: Bearer <token>`

**Middleware**: None (public endpoint)

---

## Inventory Endpoints

**Base URL**: `/inventory`
**Module**: [src/inventory/inventory.module.ts](src/inventory/inventory.module.ts)
**Controller**: [src/inventory/inventory.controller.ts](src/inventory/inventory.controller.ts)
**Service**: [src/inventory/inventory.service.ts](src/inventory/inventory.service.ts)

**Global Guard**: `AuthGuard('jwt')` - All endpoints require authentication

### 1. Create Inventory Item

**POST** `/inventory/item`

Creates a new master product/item.

**Request Body:**
```json
{
  "itemName": "Amoxicillin 500mg",
  "category": "Antibiotics",
  "unitOfMeasure": "capsule",
  "minStockLevel": 10
}
```

**Query Parameters**: None

**Headers Required:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Response (201 Created):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "itemName": "Amoxicillin 500mg",
  "category": "Antibiotics",
  "unitOfMeasure": "capsule",
  "minStockLevel": 10,
  "createdAt": "2026-01-15T10:30:00.000Z",
  "updatedAt": "2026-01-15T10:30:00.000Z"
}
```

**Validation Rules:**
- `itemName`: Required string
- `category`: Required string
- `unitOfMeasure`: Required string
- `minStockLevel`: Required number ≥ 0

**Error Responses:**
- `401 Unauthorized`: Invalid or missing JWT token
- `400 Bad Request`: Invalid data

**Middleware**: `AuthGuard('jwt')`

---

### 2. Add Stock Batch

**POST** `/inventory/batch`

Adds a specific delivery batch to an inventory item.

**Request Body:**
```json
{
  "itemId": "507f1f77bcf86cd799439011",
  "batchCode": "BATCH-2026-001",
  "expiryDate": "2027-12-31",
  "quantityOnHand": 100,
  "supplier": "507f1f77bcf86cd799439012"
}
```

**Query Parameters**: None

**Headers Required:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Response (201 Created):**
```json
{
  "_id": "507f1f77bcf86cd799439013",
  "itemId": "507f1f77bcf86cd799439011",
  "batchCode": "BATCH-2026-001",
  "expiryDate": "2027-12-31T00:00:00.000Z",
  "quantityOnHand": 100,
  "supplier": "507f1f77bcf86cd799439012",
  "status": "good",
  "createdAt": "2026-01-15T10:30:00.000Z",
  "updatedAt": "2026-01-15T10:30:00.000Z"
}
```

**Validation Rules:**
- `itemId`: Required MongoDB ObjectId
- `batchCode`: Required string
- `expiryDate`: Required ISO date string
- `quantityOnHand`: Required number ≥ 1
- `supplier`: Required MongoDB ObjectId

**Status Virtual Field** (calculated):
- `'good'`: Expiry > 30 days from now
- `'warning'`: Expiry ≤ 30 days from now
- `'expired'`: Expiry date passed

**Error Responses:**
- `401 Unauthorized`: Invalid JWT
- `400 Bad Request`: Invalid item or supplier ID

**Middleware**: `AuthGuard('jwt')`

---

### 3. Get All Items

**GET** `/inventory/items`

Retrieves all master inventory items.

**Query Parameters**: None

**Headers Required:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "itemName": "Amoxicillin 500mg",
    "category": "Antibiotics",
    "unitOfMeasure": "capsule",
    "minStockLevel": 10,
    "createdAt": "2026-01-15T10:30:00.000Z",
    "updatedAt": "2026-01-15T10:30:00.000Z"
  }
]
```

**Middleware**: `AuthGuard('jwt')`

---

### 4. Get Expiry Report

**GET** `/inventory/expiry-report`

Generates a report of expiring and expired batches.

**Query Parameters**: None

**Headers Required:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "expiringSoon": [
    {
      "product": "Amoxicillin 500mg",
      "batchId": "BATCH-2026-001",
      "expiryDate": "2026-02-15T00:00:00.000Z",
      "quantity": 45,
      "supplier": "SupplierName",
      "value": 1125.50,
      "daysUntilExpiry": 15
    }
  ],
  "expired": [
    {
      "product": "Penicillin G",
      "batchId": "BATCH-2025-001",
      "expiryDate": "2025-12-31T00:00:00.000Z",
      "quantity": 10,
      "supplier": "SupplierName",
      "value": 250.00,
      "daysExpired": 15
    }
  ]
}
```

**Middleware**: `AuthGuard('jwt')`

---

### 5. Get Low Stock Alerts

**GET** `/inventory/alerts/low-stock`

Returns items below their minimum stock level.

**Query Parameters**: None

**Headers Required:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "itemName": "Amoxicillin 500mg",
    "totalStock": 5,
    "minLevel": 10,
    "isLow": true
  }
]
```

**Middleware**: `AuthGuard('jwt')`

---

### 6. Update Reorder Level

**PATCH** `/inventory/reorder-level/:itemId`

Updates the minimum stock threshold for an item.

**Path Parameters:**
- `itemId` (ObjectId): Item to update

**Request Body:**
```json
{
  "minLevel": 20
}
```

**Headers Required:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "itemName": "Amoxicillin 500mg",
  "category": "Antibiotics",
  "unitOfMeasure": "capsule",
  "minStockLevel": 20,
  "createdAt": "2026-01-15T10:30:00.000Z",
  "updatedAt": "2026-01-15T10:31:00.000Z"
}
```

**Error Responses:**
- `404 Not Found`: Item not found

**Middleware**: `AuthGuard('jwt')`

---

### 7. Get FEFO Batch Suggestion

**GET** `/inventory/suggest/:itemId`

Suggests the earliest expiring batch for FEFO (First Expiry, First Out) issuance.

**Path Parameters:**
- `itemId` (ObjectId): Item to check

**Headers Required:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "_id": "507f1f77bcf86cd799439013",
  "itemId": "507f1f77bcf86cd799439011",
  "batchCode": "BATCH-2026-001",
  "expiryDate": "2026-06-30T00:00:00.000Z",
  "quantityOnHand": 100,
  "supplier": "507f1f77bcf86cd799439012",
  "status": "good"
}
```

**Error Responses:**
- `404 Not Found`: No valid stock available

**Middleware**: `AuthGuard('jwt')`

---

### 8. Get Batches for Item

**GET** `/inventory/batches/:itemId`

Retrieves all stock batches for a specific item (sorted by expiry).

**Path Parameters:**
- `itemId` (ObjectId): Item to fetch batches for

**Headers Required:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439013",
    "itemId": "507f1f77bcf86cd799439011",
    "batchCode": "BATCH-2026-001",
    "expiryDate": "2026-06-30T00:00:00.000Z",
    "quantityOnHand": 100,
    "supplier": {
      "_id": "507f1f77bcf86cd799439012",
      "supplierName": "PharmaCorp Ltd"
    },
    "status": "good"
  }
]
```

**Middleware**: `AuthGuard('jwt')`

---

## Suppliers Endpoints

**Base URL**: `/suppliers`
**Module**: [src/suppliers/suppliers.module.ts](src/suppliers/suppliers.module.ts)
**Controller**: [src/suppliers/suppliers.controller.ts](src/suppliers/suppliers.controller.ts)
**Service**: [src/suppliers/suppliers.service.ts](src/suppliers/suppliers.service.ts)

**Global Guard**: `AuthGuard('jwt')` - All endpoints require authentication

### 1. Create Supplier

**POST** `/suppliers`

Adds a new supplier to the system.

**Request Body:**
```json
{
  "supplierName": "PharmaCorp Ltd",
  "status": "Active",
  "contactName": "John Smith",
  "email": "john@pharmacorp.com",
  "phone": "+1-555-0123",
  "address": "123 Pharmacy St, Medical City, MC 12345",
  "notes": "Reliable supplier",
  "leadTimeNotes": "Usually ships within 5 days"
}
```

**Headers Required:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Response (201 Created):**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "supplierName": "PharmaCorp Ltd",
  "status": "Active",
  "contactName": "John Smith",
  "email": "john@pharmacorp.com",
  "phone": "+1-555-0123",
  "address": "123 Pharmacy St, Medical City, MC 12345",
  "notes": "Reliable supplier",
  "leadTimeNotes": "Usually ships within 5 days",
  "createdAt": "2026-01-15T10:30:00.000Z",
  "updatedAt": "2026-01-15T10:30:00.000Z"
}
```

**Validation Rules:**
- `supplierName`: Required, unique string
- `status`: Enum - `'Active'` or `'Inactive'` (default: Active)
- `contactName`: Required string
- `email`: Required valid email
- `phone`: Required string
- `address`: Required string
- `notes`: Optional string
- `leadTimeNotes`: Optional string

**Error Responses:**
- `409 Conflict`: Supplier name already exists
- `400 Bad Request`: Invalid data

**Middleware**: `AuthGuard('jwt')`

---

### 2. Get All Suppliers

**GET** `/suppliers`

Retrieves all suppliers (sorted by name).

**Query Parameters**: None

**Headers Required:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439012",
    "supplierName": "PharmaCorp Ltd",
    "status": "Active",
    "contactName": "John Smith",
    "email": "john@pharmacorp.com",
    "phone": "+1-555-0123",
    "address": "123 Pharmacy St, Medical City, MC 12345",
    "createdAt": "2026-01-15T10:30:00.000Z",
    "updatedAt": "2026-01-15T10:30:00.000Z"
  }
]
```

**Middleware**: `AuthGuard('jwt')`

---

### 3. Get Single Supplier

**GET** `/suppliers/:id`

Retrieves details for a specific supplier.

**Path Parameters:**
- `id` (ObjectId): Supplier ID

**Headers Required:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "supplierName": "PharmaCorp Ltd",
  "status": "Active",
  "contactName": "John Smith",
  "email": "john@pharmacorp.com",
  "phone": "+1-555-0123",
  "address": "123 Pharmacy St, Medical City, MC 12345",
  "notes": "Reliable supplier",
  "leadTimeNotes": "Usually ships within 5 days",
  "createdAt": "2026-01-15T10:30:00.000Z",
  "updatedAt": "2026-01-15T10:30:00.000Z"
}
```

**Error Responses:**
- `404 Not Found`: Supplier not found

**Middleware**: `AuthGuard('jwt')`

---

### 4. Update Supplier

**PATCH** `/suppliers/:id`

Updates supplier information.

**Path Parameters:**
- `id` (ObjectId): Supplier ID

**Request Body:** (All fields optional)
```json
{
  "contactName": "Jane Doe",
  "email": "jane@pharmacorp.com",
  "phone": "+1-555-0456",
  "address": "456 New St, Medical City, MC 12346"
}
```

**Headers Required:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "supplierName": "PharmaCorp Ltd",
  "status": "Active",
  "contactName": "Jane Doe",
  "email": "jane@pharmacorp.com",
  "phone": "+1-555-0456",
  "address": "456 New St, Medical City, MC 12346",
  "createdAt": "2026-01-15T10:30:00.000Z",
  "updatedAt": "2026-01-15T10:31:00.000Z"
}
```

**Error Responses:**
- `404 Not Found`: Supplier not found

**Middleware**: `AuthGuard('jwt')`

---

### 5. Update Supplier Status

**PATCH** `/suppliers/:id/status`

Changes supplier active/inactive status.

**Path Parameters:**
- `id` (ObjectId): Supplier ID

**Request Body:**
```json
{
  "status": "Inactive"
}
```

**Headers Required:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "supplierName": "PharmaCorp Ltd",
  "status": "Inactive",
  "contactName": "John Smith",
  "email": "john@pharmacorp.com",
  "phone": "+1-555-0123",
  "address": "123 Pharmacy St, Medical City, MC 12345"
}
```

**Validation Rules:**
- `status`: Enum - `'Active'` or `'Inactive'`

**Middleware**: `AuthGuard('jwt')`

---

### 6. Delete Supplier

**DELETE** `/suppliers/:id`

Removes a supplier from the system.

**Path Parameters:**
- `id` (ObjectId): Supplier ID

**Headers Required:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "deleted": true
}
```

**Error Responses:**
- `404 Not Found`: Supplier not found

**Middleware**: `AuthGuard('jwt')`

---

### 7. Import Suppliers from File

**POST** `/suppliers/upload`

Bulk imports suppliers from Excel (.xlsx) or CSV file.

**Query Parameters**: None

**Headers Required:**
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**
- `file`: File input (Excel .xlsx or .csv)

**Expected File Headers:**
```
Name | Contact | Email | Phone | LeadTime
```

**Response (201 Created):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439012",
    "supplierName": "PharmaCorp Ltd",
    "contactPerson": "John Smith",
    "email": "john@pharmacorp.com",
    "phone": "+1-555-0123",
    "leadTime": 3,
    "status": "Active"
  }
]
```

**Validation:**
- File type must be `.csv` or `.xlsx`
- All required columns must be present

**Error Responses:**
- `400 Bad Request`: No file uploaded or invalid file type
- `400 Bad Request`: Failed to parse file

**Middleware**: `AuthGuard('jwt')`, `RolesGuard`, `@Roles('owner', 'staff')`

**Role-Based Access**: `owner`, `staff`

---

## Purchase Orders Endpoints

**Base URL**: `/purchase-orders`
**Module**: [src/purchase-orders/purchase-orders.module.ts](src/purchase-orders/purchase-orders.module.ts)
**Controller**: [src/purchase-orders/purchase-orders.controller.ts](src/purchase-orders/purchase-orders.controller.ts)
**Service**: [src/purchase-orders/purchase-orders.service.ts](src/purchase-orders/purchase-orders.service.ts)

**Global Guard**: `AuthGuard('jwt')` - All endpoints require authentication

### 1. Create Draft Purchase Order

**POST** `/purchase-orders/draft`

Creates a new draft purchase order for a supplier.

**Request Body:**
```json
{
  "supplierId": "507f1f77bcf86cd799439012",
  "notes": "Urgent restock needed"
}
```

**Headers Required:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Response (201 Created):**
```json
{
  "_id": "507f1f77bcf86cd799439020",
  "poNumber": "PO-2026-001",
  "supplierId": "507f1f77bcf86cd799439012",
  "items": [],
  "status": "Draft",
  "totalValue": 0,
  "notes": "Urgent restock needed",
  "createdAt": "2026-01-15T10:30:00.000Z",
  "updatedAt": "2026-01-15T10:30:00.000Z"
}
```

**Validation Rules:**
- `supplierId`: Required MongoDB ObjectId
- `notes`: Optional string

**Auto-Generated:**
- `poNumber`: Format `PO-YYYY-###` (auto-incremented)
- `status`: Automatically set to `'Draft'`

**Error Responses:**
- `400 Bad Request`: Invalid supplier ID

**Middleware**: `AuthGuard('jwt')`

---

### 2. Add Item to Draft PO

**PATCH** `/purchase-orders/draft/:id/add-item`

Adds or updates items in a draft purchase order.

**Path Parameters:**
- `id` (ObjectId): Draft PO ID

**Request Body:**
```json
{
  "itemId": "507f1f77bcf86cd799439011",
  "quantity": 50,
  "unitPrice": 22.50
}
```

**Headers Required:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "_id": "507f1f77bcf86cd799439020",
  "poNumber": "PO-2026-001",
  "supplierId": "507f1f77bcf86cd799439012",
  "items": [
    {
      "itemId": "507f1f77bcf86cd799439011",
      "quantityRequested": 50,
      "quantityReceived": 0,
      "unitPrice": 22.50
    }
  ],
  "status": "Draft",
  "totalValue": 1125.00,
  "createdAt": "2026-01-15T10:30:00.000Z",
  "updatedAt": "2026-01-15T10:31:00.000Z"
}
```

**Validation Rules:**
- `itemId`: Required MongoDB ObjectId
- `quantity`: Required number ≥ 1
- `unitPrice`: Required number

**Auto-Calculated:**
- `totalValue`: Updated with `quantity × unitPrice`

**Error Responses:**
- `404 Not Found`: PO not found
- `400 Bad Request`: Cannot add items to non-draft PO

**Middleware**: `AuthGuard('jwt')`

---

### 3. Get All Draft POs

**GET** `/purchase-orders/drafts`

Retrieves all draft purchase orders (grouped by supplier).

**Query Parameters**: None

**Headers Required:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439020",
    "poNumber": "PO-2026-001",
    "supplierId": {
      "_id": "507f1f77bcf86cd799439012",
      "supplierName": "PharmaCorp Ltd"
    },
    "items": [
      {
        "itemId": {
          "_id": "507f1f77bcf86cd799439011",
          "itemName": "Amoxicillin 500mg"
        },
        "quantityRequested": 50,
        "quantityReceived": 0,
        "unitPrice": 22.50
      }
    ],
    "status": "Draft",
    "totalValue": 1125.00,
    "createdAt": "2026-01-15T10:30:00.000Z",
    "updatedAt": "2026-01-15T10:31:00.000Z"
  }
]
```

**Middleware**: `AuthGuard('jwt')`

---

### 4. Get All Purchase Orders

**GET** `/purchase-orders`

Retrieves purchase orders with optional status filtering.

**Query Parameters:**
- `status` (optional): Filter by status (`'Draft'`, `'Sent'`, `'Partial'`, `'Received'`, `'Cancelled'`)

**Example**: `/purchase-orders?status=Sent`

**Headers Required:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439020",
    "poNumber": "PO-2026-001",
    "supplierId": {
      "_id": "507f1f77bcf86cd799439012",
      "supplierName": "PharmaCorp Ltd"
    },
    "items": [
      {
        "itemId": "507f1f77bcf86cd799439011",
        "quantityRequested": 50,
        "quantityReceived": 25,
        "unitPrice": 22.50
      }
    ],
    "status": "Partial",
    "totalValue": 1125.00,
    "createdAt": "2026-01-15T10:30:00.000Z",
    "updatedAt": "2026-01-15T10:35:00.000Z"
  }
]
```

**Middleware**: `AuthGuard('jwt')`

---

### 5. Update PO Status

**PATCH** `/purchase-orders/:id/status`

Changes purchase order status (e.g., Draft → Sent).

**Path Parameters:**
- `id` (ObjectId): PO ID

**Request Body:**
```json
{
  "status": "Sent"
}
```

**Headers Required:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "_id": "507f1f77bcf86cd799439020",
  "poNumber": "PO-2026-001",
  "supplierId": "507f1f77bcf86cd799439012",
  "items": [...],
  "status": "Sent",
  "totalValue": 1125.00,
  "updatedAt": "2026-01-15T10:35:00.000Z"
}
```

**Valid Status Values:**
- `'Draft'` - Initial state
- `'Sent'` - Sent to supplier
- `'Partial'` - Partial receipt
- `'Received'` - Fully received
- `'Cancelled'` - Cancelled order

**Error Responses:**
- `404 Not Found`: PO not found

**Middleware**: `AuthGuard('jwt')`

---

### 6. Receive Items

**PATCH** `/purchase-orders/:id/receive`

Records receipt of items and updates PO status automatically.

**Path Parameters:**
- `id` (ObjectId): PO ID

**Request Body:**
```json
{
  "itemId": "507f1f77bcf86cd799439011",
  "quantity": 25
}
```

**Headers Required:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "_id": "507f1f77bcf86cd799439020",
  "poNumber": "PO-2026-001",
  "supplierId": "507f1f77bcf86cd799439012",
  "items": [
    {
      "itemId": "507f1f77bcf86cd799439011",
      "quantityRequested": 50,
      "quantityReceived": 25,
      "unitPrice": 22.50
    }
  ],
  "status": "Partial",
  "totalValue": 1125.00,
  "updatedAt": "2026-01-15T10:36:00.000Z"
}
```

**Auto-Status Update Logic:**
- If `quantityReceived >= quantityRequested` for ALL items → Status: `'Received'`
- Else if ANY item has `quantityReceived > 0` → Status: `'Partial'`
- Else → Status: `'Sent'`

**Error Responses:**
- `404 Not Found`: PO or item not found

**Middleware**: `AuthGuard('jwt')`

---

## Transactions Endpoints

**Base URL**: `/transactions`
**Module**: [src/transactions/transactions.module.ts](src/transactions/transactions.module.ts)
**Controller**: [src/transactions/transactions.controller.ts](src/transactions/transactions.controller.ts)
**Service**: [src/transactions/transactions.service.ts](src/transactions/transactions.service.ts)

**Global Guard**: `AuthGuard('jwt')` - All endpoints require authentication

### 1. Create Transaction (Stock Movement)

**POST** `/transactions`

Records stock movement with automatic FEFO batch selection for issues.

**Request Body:**
```json
{
  "itemId": "507f1f77bcf86cd799439011",
  "batchId": "507f1f77bcf86cd799439013",
  "type": "ISSUE",
  "quantity": 10,
  "reason": "Sale to customer"
}
```

**Headers Required:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Response (201 Created):**
```json
{
  "_id": "507f1f77bcf86cd799439030",
  "itemId": "507f1f77bcf86cd799439011",
  "batchId": "507f1f77bcf86cd799439013",
  "type": "ISSUE",
  "quantity": 10,
  "reason": "Sale to customer",
  "performedBy": "507f1f77bcf86cd799439001",
  "createdAt": "2026-01-15T10:40:00.000Z",
  "updatedAt": "2026-01-15T10:40:00.000Z"
}
```

**Validation Rules:**
- `itemId`: Required MongoDB ObjectId
- `batchId`: Optional (auto-selected by FEFO if omitted for ISSUE)
- `type`: Required enum - `'RECEIVE'`, `'ISSUE'`, `'ADJUSTMENT'`
- `quantity`: Required number ≥ 1
- `reason`: Optional string (required for ADJUSTMENT type)

**Transaction Types:**

| Type | Description | Effect on Stock | Requires Batch |
|------|-------------|-----------------|----------------|
| `RECEIVE` | Stock arrival | + quantity | Optional |
| `ISSUE` | Stock removal (FEFO) | - quantity | Optional (auto-select) |
| `ADJUSTMENT` | Stock correction | ± quantity | Optional |

**FEFO Logic:**
- For `ISSUE` without `batchId`: Automatically selects batch with earliest expiry
- Throws error if insufficient stock in selected batch

**Error Responses:**
- `400 Bad Request`: No suitable batch found
- `400 Bad Request`: Insufficient stock
- `400 Bad Request`: Reason required for adjustments

**Auto-Populated:**
- `performedBy`: Set to authenticated user ID

**Middleware**: `AuthGuard('jwt')`

---

### 2. Get All Transactions

**GET** `/transactions`

Retrieves transaction history (audit log).

**Query Parameters**: None

**Headers Required:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439030",
    "itemId": {
      "_id": "507f1f77bcf86cd799439011",
      "itemName": "Amoxicillin 500mg"
    },
    "batchId": "507f1f77bcf86cd799439013",
    "type": "ISSUE",
    "quantity": 10,
    "reason": "Sale to customer",
    "performedBy": "Staff User",
    "createdAt": "2026-01-15T10:40:00.000Z",
    "updatedAt": "2026-01-15T10:40:00.000Z"
  }
]
```

**Sorting**: Newest transactions first (`createdAt: -1`)

**Middleware**: `AuthGuard('jwt')`

---

## Approvals Endpoints

**Base URL**: `/approvals`
**Module**: [src/approvals/approvals.module.ts](src/approvals/approvals.module.ts)
**Controller**: [src/approvals/approvals.controller.ts](src/approvals/approvals.controller.ts)
**Service**: [src/approvals/approvals.service.ts](src/approvals/approvals.service.ts)

**Global Guard**: `AuthGuard('jwt')` - All endpoints require authentication

### 1. Create Approval Request

**POST** `/approvals`

Creates a purchase request awaiting owner approval.

**Request Body:**
```json
{
  "itemId": "507f1f77bcf86cd799439011",
  "product": "Amoxicillin 500mg",
  "quantity": 100,
  "supplierId": "507f1f77bcf86cd799439012",
  "unitPrice": 22.50,
  "urgency": "high",
  "reason": "Low stock alert - urgent restock"
}
```

**Headers Required:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Response (201 Created):**
```json
{
  "_id": "507f1f77bcf86cd799439040",
  "requestedBy": "507f1f77bcf86cd799439001",
  "itemId": "507f1f77bcf86cd799439011",
  "product": "Amoxicillin 500mg",
  "quantity": 100,
  "supplierId": "507f1f77bcf86cd799439012",
  "unitPrice": 22.50,
  "totalAmount": 2250.00,
  "urgency": "high",
  "reason": "Low stock alert - urgent restock",
  "status": "pending",
  "createdAt": "2026-01-15T10:45:00.000Z",
  "updatedAt": "2026-01-15T10:45:00.000Z"
}
```

**Validation Rules:**
- `itemId`: Required MongoDB ObjectId
- `product`: Required string
- `quantity`: Required number ≥ 1
- `supplierId`: Required MongoDB ObjectId
- `unitPrice`: Required number ≥ 0
- `urgency`: Required enum - `'high'`, `'medium'`, `'low'`
- `reason`: Required string

**Auto-Calculated:**
- `totalAmount`: `quantity × unitPrice`
- `status`: Set to `'pending'`
- `requestedBy`: Set to authenticated user ID

**Middleware**: `AuthGuard('jwt')`

---

### 2. Get Pending Approval Requests

**GET** `/approvals/pending`

Retrieves all pending approval requests (for owner review).

**Query Parameters**: None

**Headers Required:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439040",
    "requestedBy": {
      "_id": "507f1f77bcf86cd799439001",
      "fullName": "John Staff"
    },
    "itemId": {
      "_id": "507f1f77bcf86cd799439011",
      "itemName": "Amoxicillin 500mg"
    },
    "product": "Amoxicillin 500mg",
    "quantity": 100,
    "supplierId": {
      "_id": "507f1f77bcf86cd799439012",
      "supplierName": "PharmaCorp Ltd"
    },
    "unitPrice": 22.50,
    "totalAmount": 2250.00,
    "urgency": "high",
    "reason": "Low stock alert - urgent restock",
    "status": "pending",
    "createdAt": "2026-01-15T10:45:00.000Z",
    "updatedAt": "2026-01-15T10:45:00.000Z"
  }
]
```

**Sorting**: Newest requests first

**Middleware**: `AuthGuard('jwt')`

---

### 3. Approve/Reject Request

**PATCH** `/approvals/:id/status`

Changes request status and auto-generates PO if approved.

**Path Parameters:**
- `id` (ObjectId): Request ID

**Request Body:**
```json
{
  "status": "approved"
}
```

**Headers Required:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "_id": "507f1f77bcf86cd799439040",
  "requestedBy": "507f1f77bcf86cd799439001",
  "itemId": "507f1f77bcf86cd799439011",
  "product": "Amoxicillin 500mg",
  "quantity": 100,
  "supplierId": "507f1f77bcf86cd799439012",
  "unitPrice": 22.50,
  "totalAmount": 2250.00,
  "urgency": "high",
  "reason": "Low stock alert - urgent restock",
  "status": "approved",
  "reviewedBy": "507f1f77bcf86cd799439002",
  "createdAt": "2026-01-15T10:45:00.000Z",
  "updatedAt": "2026-01-15T10:50:00.000Z"
}
```

**Valid Status Values:**
- `'approved'` - Approves request and auto-creates draft PO
- `'rejected'` - Rejects request

**Auto-Actions on Approval:**
1. Creates a new draft Purchase Order
2. Adds the requested item with quantity and price
3. Sets `notes` to: `"Automatically generated from approved request: {reason}"`

**Error Responses:**
- `404 Not Found`: Request not found
- `400 Bad Request`: Request already processed (status not pending)

**Auto-Populated:**
- `reviewedBy`: Set to authenticated user ID (owner)

**Middleware**: `AuthGuard('jwt')`

---

## Middleware & Guards Summary

### Global Middleware

| Middleware | Location | Purpose |
|-----------|----------|---------|
| `AllExceptionsFilter` | [src/filters/exception-filter.ts](src/filters/exception-filter.ts) | Catches all exceptions and formats error responses |
| `CORS` | [src/main.ts](src/main.ts) | Enables cross-origin requests |

### Authentication & Authorization

| Guard | Location | Usage | Purpose |
|-------|----------|-------|---------|
| `AuthGuard('jwt')` | [src/auth/jwt.strategy.ts](src/auth/jwt.strategy.ts) | Applied to protected routes | Validates JWT tokens |
| `RolesGuard` | [src/auth/guards/roles.guard.ts](src/auth/guards/roles.guard.ts) | With `@Roles()` decorator | Enforces role-based access |

### Decorator Usage

```typescript
// Role-based access control
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('owner', 'staff')
@Post('upload')
uploadSuppliers() { }
```

### Protected Routes by Default

All endpoints in the following controllers require `AuthGuard('jwt')`:
- ✅ `/inventory/*`
- ✅ `/suppliers/*`
- ✅ `/purchase-orders/*`
- ✅ `/transactions/*`
- ✅ `/approvals/*`

### Public Routes

- 🔓 `POST /auth/signup`
- 🔓 `POST /auth/login`

---

## Error Handling

### Standard Error Response Format
```json
{
  "statusCode": 400,
  "timestamp": "2026-01-15T10:30:00.000Z",
  "path": "/api/endpoint",
  "message": "Error description"
}
```

### Common HTTP Status Codes
| Code | Meaning |
|------|---------|
| `200` | OK - Request successful |
| `201` | Created - Resource created |
| `400` | Bad Request - Invalid data |
| `401` | Unauthorized - Missing/invalid JWT |
| `403` | Forbidden - Insufficient permissions |
| `404` | Not Found - Resource not found |
| `409` | Conflict - Duplicate resource |
| `500` | Server Error - Unhandled exception |

---

## Authentication Flow

1. **Register**: `POST /auth/signup` → Create account
2. **Login**: `POST /auth/login` → Receive JWT token
3. **Use Token**: Include in all protected endpoints:
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
4. **Token Expiry**: 1 day

---

## Workflow Examples

### Complete Purchase Workflow

1. **Staff requests stock**:
   ```
   POST /approvals
   ```

2. **Owner approves** (auto-creates PO):
   ```
   PATCH /approvals/:id/status {"status":"approved"}
   ```

3. **Owner sends PO**:
   ```
   PATCH /purchase-orders/:id/status {"status":"Sent"}
   ```

4. **Owner receives stock**:
   ```
   PATCH /purchase-orders/:id/receive {"itemId":"...","quantity":50}
   ```

---

## Testing Endpoints

### Using cURL

```bash
# Register
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName":"John Doe",
    "username":"johndoe",
    "email":"john@example.com",
    "password":"SecurePass123",
    "role":"staff"
  }'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username":"johndoe",
    "password":"SecurePass123"
  }'

# Protected endpoint (with token)
curl -X GET http://localhost:3000/inventory/items \
  -H "Authorization: Bearer <your_jwt_token>"
```

### Using Postman
1. Set `{{BASE_URL}}` to `http://localhost:3000`
2. Create environment variable `{{TOKEN}}` from login response
3. Use in headers: `Authorization: Bearer {{TOKEN}}`

---

## Related Documentation

- [Setup & Installation Guide](./SETUP.md)
- [Database Schemas](./src)
- [NestJS Documentation](https://docs.nestjs.com)