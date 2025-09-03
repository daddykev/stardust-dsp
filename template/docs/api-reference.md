# Stardust DSP API Reference

## Overview
Stardust DSP provides a comprehensive API for music streaming, catalog management, and analytics. The platform receives content from Stardust Distro and other distribution platforms via DDEX-compliant ERN messages.

## Authentication
All API endpoints require Firebase Authentication. Include the ID token in the Authorization header:
```
Authorization: Bearer <ID_TOKEN>
```

## Base URL
```
https://us-central1-<PROJECT_ID>.cloudfunctions.net/
```

## Catalog Management APIs

### Generate ERN Message
Creates a DDEX-compliant ERN message for distribution (typically used by Stardust Distro).

**Endpoint:** `POST /generateERN`

**Request Body:**
```json
{
  "releaseId": "string",
  "messageType": "NewReleaseMessage | UpdateMessage | TakedownMessage",
  "ernVersion": "ERN-4.3 | ERN-4.2 | ERN-4.1",
  "profile": "AudioAlbumMusicOnly | AudioSingleMusicOnly",
  "territory": "Worldwide | US | GB | etc.",
  "targetDSP": "optional_dsp_name"
}
```

**Response:**
```json
{
  "success": true,
  "ernXml": "string",
  "fileName": "string",
  "messageId": "string",
  "storageUrl": "string"
}
```

### Process Ingestion
Handles incoming ERN messages from Stardust Distro and other distributors.

**Endpoint:** `POST /processIngestion`

**Request Body:**
```json
{
  "deliveryId": "string",
  "source": "stardust_distro | other_distributor",
  "priority": "high | normal | low"
}
```

**Response:**
```json
{
  "success": true,
  "ingestionId": "string",
  "status": "processing | completed | failed",
  "releases": ["releaseId1", "releaseId2"],
  "tracks": ["trackId1", "trackId2"]
}
```

## Analytics & Reporting APIs

### Track Play
Records play events for analytics and royalty reporting.

**Endpoint:** `POST /trackPlay`

**Request Body:**
```json
{
  "trackId": "string",
  "releaseId": "string",
  "userId": "string",
  "duration": "number",
  "progress": "number",
  "completed": "boolean",
  "country": "string",
  "deviceType": "string"
}
```

**Response:**
```json
{
  "success": true,
  "playId": "string",
  "timestamp": "ISO8601"
}
```

### Generate DSR (Digital Sales Report)
Creates DDEX-compliant Digital Sales Reports to send back to distributors like Stardust Distro.

**Endpoint:** `POST /generateDSR`

**Request Body:**
```json
{
  "startDate": "ISO8601",
  "endDate": "ISO8601",
  "format": "DDEX | CSV | JSON | Excel",
  "territory": "string",
  "distributorId": "string"
}
```

**Response:**
```json
{
  "success": true,
  "reportId": "string",
  "downloadUrl": "string",
  "statistics": {
    "totalTracks": "number",
    "totalPlays": "number",
    "totalRevenue": "number"
  }
}
```

### Calculate Royalties
Calculates royalties to be reported back to distributors.

**Endpoint:** `POST /calculateRoyalties`

**Request Body:**
```json
{
  "period": {
    "startDate": "ISO8601",
    "endDate": "ISO8601"
  },
  "method": "pro-rata | user-centric | hybrid",
  "territory": "string"
}
```

**Response:**
```json
{
  "success": true,
  "totalRevenue": "number",
  "calculations": [{
    "rightsHolderId": "string",
    "amount": "number",
    "plays": "number",
    "tracks": ["trackId1", "trackId2"]
  }]
}
```

### Get Usage Report
Retrieves usage analytics for reporting to labels via Stardust Distro.

**Endpoint:** `POST /getUsageReport`

**Request Body:**
```json
{
  "reportType": "streaming | downloads | geographic | demographic | playlist | discovery",
  "period": {
    "startDate": "ISO8601",
    "endDate": "ISO8601"
  },
  "filters": {
    "territory": "string",
    "releaseId": "string",
    "trackId": "string"
  }
}
```

## Delivery Management APIs

### Queue Delivery
Queues content received from Stardust Distro for processing.

**Endpoint:** `POST /queueDelivery`

**Request Body:**
```json
{
  "releaseId": "string",
  "sourceDistributor": "stardust_distro | other",
  "messageType": "NewReleaseMessage | UpdateMessage | TakedownMessage",
  "priority": "high | normal | low",
  "scheduledAt": "ISO8601"
}
```

**Response:**
```json
{
  "success": true,
  "deliveryId": "string",
  "status": "queued",
  "estimatedProcessing": "ISO8601"
}
```

### Process Delivery
Processes queued deliveries from distributors (called by scheduler).

**Endpoint:** `POST /processDelivery`

**Internal Use Only - Called by Cloud Scheduler**

### Get Delivery Status
Retrieves the status of content delivery from Stardust Distro.

**Endpoint:** `GET /deliveryStatus/{deliveryId}`

**Response:**
```json
{
  "deliveryId": "string",
  "status": "queued | processing | completed | failed",
  "source": "stardust_distro",
  "logs": [{
    "timestamp": "ISO8601",
    "level": "info | warning | error | success",
    "message": "string"
  }],
  "receipt": {
    "processedAt": "ISO8601",
    "acknowledgmentId": "string"
  }
}
```

## Integration with Stardust Distro

### Receiving Content
Stardust DSP receives content from Stardust Distro via:
- DDEX ERN messages
- FTP/SFTP delivery
- S3 bucket sync
- Direct API calls

### Reporting Back
Stardust DSP sends reports to Stardust Distro:
- Digital Sales Reports (DSR)
- Usage analytics
- Royalty statements
- Play tracking data

## Rate Limiting
- Standard tier: 100 requests per minute
- Premium tier: 1000 requests per minute
- Enterprise tier: Unlimited
- Distributor tier: 500 requests per minute

## Error Codes
| Code | Description |
|------|-------------|
| 400  | Invalid request parameters |
| 401  | Authentication required |
| 403  | Insufficient permissions |
| 404  | Resource not found |
| 429  | Rate limit exceeded |
| 500  | Internal server error |

## Webhooks
Configure webhooks to receive real-time updates:

```json
{
  "event": "delivery.completed | ingestion.processed | report.generated",
  "data": {
    "resourceId": "string",
    "timestamp": "ISO8601",
    "details": {}
  }
}
```

## SDK Usage

### JavaScript/Node.js
```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const processIngestion = httpsCallable(functions, 'processIngestion');

const result = await processIngestion({
  deliveryId: 'delivery123',
  source: 'stardust_distro'
});
```

### REST API
```bash
curl -X POST \
  https://us-central1-<PROJECT_ID>.cloudfunctions.net/processIngestion \
  -H 'Authorization: Bearer <ID_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "deliveryId": "delivery123",
    "source": "stardust_distro"
  }'
```