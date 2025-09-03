# DSP Operator Guide - Stardust DSP Integration

## Overview
This guide is for DSP operators who want to integrate with Stardust DSP or receive content from Stardust Distro. Stardust DSP is a full-featured streaming platform that receives content from distribution services like Stardust Distro.

## System Architecture

### The Ecosystem
- **Stardust Distro**: Distribution platform that sends content to DSPs
- **Stardust DSP**: Streaming platform (this system) that receives and plays content
- **Other DSPs**: Third-party streaming services that can also receive from Stardust Distro

## Quick Start for DSP Operators

### Step 1: Register as a DSP Partner
1. Contact our partner team at partners@stardust-dsp.com
2. Provide your DSP information:
   - Company name and contact details
   - Supported territories
   - Preferred delivery methods (FTP, SFTP, S3, API)
   - Technical contact information

### Step 2: Configure Delivery Endpoint
Provide your delivery endpoint configuration to receive content from Stardust Distro:

#### FTP/SFTP Configuration
```json
{
  "protocol": "FTP | SFTP",
  "host": "ftp.yourdsp.com",
  "port": 21,
  "username": "stardust_delivery",
  "password": "encrypted_password",
  "directory": "/incoming/stardust/"
}
```

#### S3 Configuration
```json
{
  "protocol": "S3",
  "bucket": "your-dsp-bucket",
  "region": "us-east-1",
  "accessKeyId": "AKIAIOSFODNN7EXAMPLE",
  "secretAccessKey": "encrypted_secret",
  "prefix": "stardust/deliveries/"
}
```

#### API Configuration
```json
{
  "protocol": "API",
  "endpoint": "https://api.yourdsp.com/v1/deliveries",
  "authType": "Bearer | Basic | OAuth2",
  "credentials": {
    "token": "your_api_token"
  }
}
```

### Step 3: Receive Test Deliveries
Before going live, Stardust Distro will send test deliveries to validate your integration:

1. **Test ERN Message**: Sample release with metadata
2. **Test Audio Files**: Sample tracks in various formats
3. **Test Artwork**: Cover art in multiple resolutions
4. **Test Update**: Update message for the test release
5. **Test Takedown**: Takedown notification

## Receiving Content from Stardust Distro

### ERN Message Format

#### Supported Versions
- ERN 4.3 (recommended)
- ERN 4.2
- ERN 4.1
- ERN 3.8.2 (legacy)

#### Message Types
- **NewReleaseMessage**: New release delivery
- **UpdateMessage**: Updates to existing releases
- **TakedownMessage**: Content removal requests

#### File Structure from Stardust Distro
```
delivery_package/
├── ERN/
│   └── [MessageId]_[DateTime].xml
├── audio/
│   ├── [ISRC]_[Quality].flac
│   └── [ISRC]_[Quality].mp3
├── images/
│   ├── [ReleaseId]_cover_3000.jpg
│   ├── [ReleaseId]_cover_1500.jpg
│   └── [ReleaseId]_cover_600.jpg
└── manifest.xml
```

### DDEX Compliance
All deliveries from Stardust Distro follow DDEX naming conventions:
- Audio files: `[ISRC]_[Quality].[format]`
- Images: `[ReleaseId]_[Type]_[Resolution].[format]`
- ERN: `[MessageId]_[DateTime].xml`

## Ingestion Workflow for Stardust DSP

### 1. Delivery Reception
```mermaid
graph LR
    A[Stardust Distro] -->|Delivery Package| B[Stardust DSP]
    B --> C[Validation]
    C --> D[Processing]
    D --> E[Catalog Update]
    E --> F[Available for Streaming]
    F -->|DSR Report| A
```

### 2. Validation Steps
1. **MD5 Verification**: Validate file integrity using checksums from Stardust Distro
2. **Schema Validation**: Verify ERN XML against DDEX schema
3. **Asset Validation**: Ensure all referenced files are present
4. **Metadata Validation**: Check required fields and formats

### 3. Processing
1. Parse ERN message from Stardust Distro
2. Extract release metadata
3. Process audio files
4. Store artwork assets
5. Update Stardust DSP catalog
6. Generate internal IDs

### 4. Acknowledgment
Send acknowledgment receipt back to Stardust Distro within 24 hours:
```xml
<DeliveryReceipt>
  <MessageId>MSG_123456</MessageId>
  <ReceivedAt>2025-01-15T10:30:00Z</ReceivedAt>
  <Status>Success</Status>
  <DSPReleaseId>STARDUST_DSP_REL_789</DSPReleaseId>
</DeliveryReceipt>
```

## API Integration with Stardust DSP

### Webhook Notifications
Register webhooks to receive real-time updates from Stardust DSP:

```http
POST https://api.stardust-dsp.com/v1/webhooks
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "url": "https://api.yoursystem.com/webhooks/stardust-dsp",
  "events": [
    "delivery.initiated",
    "delivery.completed",
    "release.updated",
    "release.takedown"
  ]
}
```

### Webhook Payload from Stardust DSP
```json
{
  "event": "delivery.completed",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "deliveryId": "DEL_123456",
    "releaseId": "REL_789",
    "messageType": "NewReleaseMessage",
    "source": "stardust_distro",
    "files": {
      "ern": "s3://bucket/ERN/MSG_123456.xml",
      "audio": ["s3://bucket/audio/ISRC1.flac"],
      "images": ["s3://bucket/images/cover.jpg"]
    }
  }
}
```

## Running Your Own Stardust DSP Instance

### Installation
```bash
# Clone the repository
git clone https://github.com/stardust-dsp/platform

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Set up Firebase
firebase init

# Deploy
npm run deploy
```

### Configuration
Configure your Stardust DSP instance to receive from Stardust Distro:

```javascript
// config/distributors.js
module.exports = {
  stardust_distro: {
    enabled: true,
    endpoint: 'https://api.stardust-distro.com',
    authentication: {
      type: 'oauth2',
      clientId: process.env.STARDUST_DISTRO_CLIENT_ID,
      clientSecret: process.env.STARDUST_DISTRO_SECRET
    },
    ingestion: {
      autoProcess: true,
      validateERN: true,
      requireMD5: true
    }
  }
};
```

## Testing & Validation

### Test Environment
- Stardust DSP Test: `https://test-api.stardust-dsp.com`
- Stardust Distro Test: `https://test-api.stardust-distro.com`
- Credentials: Provided separately

### Validation Tools
1. **ERN Validator**: `POST /v1/validate/ern`
2. **Delivery Simulator**: `POST /v1/test/delivery`
3. **Status Monitor**: `GET /v1/status/{deliveryId}`

### Integration Checklist
- [ ] Endpoint configuration completed
- [ ] Authentication with Stardust Distro verified
- [ ] Test delivery received successfully
- [ ] ERN parsing implemented
- [ ] Asset storage configured
- [ ] Acknowledgment system working
- [ ] DSR reporting back to Stardust Distro
- [ ] Webhook notifications active
- [ ] Update handling tested
- [ ] Takedown processing verified
- [ ] Production credentials received

## Best Practices

### Performance
- Process Stardust Distro deliveries asynchronously
- Implement retry logic with exponential backoff
- Cache frequently accessed metadata
- Use CDN for asset delivery

### Reliability
- Validate all incoming data from distributors
- Maintain delivery logs
- Implement error handling
- Set up monitoring and alerts

### Security
- Use encrypted connections (SFTP/HTTPS)
- Rotate Stardust Distro credentials regularly
- Implement IP whitelisting
- Audit access logs

## Support

### Technical Support
- Stardust DSP: dsp-support@stardust-dsp.com
- Stardust Distro: support@stardust-distro.com
- Slack: #dsp-integration
- Documentation: https://docs.stardust-dsp.com

### Emergency Contact
- 24/7 Hotline: +1-555-STARDUST
- Critical Issues: critical@stardust-dsp.com

### Resources
- [DDEX Knowledge Base](https://kb.ddex.net)
- [ERN Choreography](https://ddex.net/standards)
- [Sample ERN Messages](https://github.com/stardust-dsp/samples)
- [API Postman Collection](https://postman.stardust-dsp.com)