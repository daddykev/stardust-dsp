# Digital Sales Reporting (DSR) Guide - Stardust DSP

## Overview
Stardust DSP provides comprehensive Digital Sales Reporting (DSR) capabilities that are fully DDEX-compliant. These reports are sent back to distributors like Stardust Distro to report usage and calculate royalties.

## DSR Flow

### The Reporting Chain
1. **Content Flow**: Stardust Distro → Stardust DSP → Consumers
2. **Report Flow**: Consumers → Stardust DSP → DSR → Stardust Distro → Labels/Artists

## DDEX DSR Standard

### What is DSR?
Digital Sales Report (DSR) is a DDEX standard for reporting usage and sales of digital music. Stardust DSP uses DSR to report back to Stardust Distro and other distributors.

### Supported Versions
- DSR 4.0 (current)
- DSR 3.0 (legacy support)
- Flat File DSR (simplified format)

## Report Types

### 1. Basic Sales Report
Standard DSR sent to Stardust Distro containing:
- Usage summary by track
- Territory breakdown
- Revenue calculations
- Period totals

### 2. Detailed Sales Report
Extended DSR for comprehensive reporting:
- Hourly usage patterns
- Playlist performance
- User demographics
- Discovery metrics

### 3. Flat File Report
Simplified CSV/Excel format for smaller distributors:
- Track-level usage
- Basic revenue data
- Territory summary

## Generating Reports for Distributors

### Via Stardust DSP Dashboard

1. Navigate to **Analytics > Reports**
2. Click **Generate DSR**
3. Select distributor (e.g., Stardust Distro)
4. Configure report parameters:
   - Date range
   - Territory (or Worldwide)
   - Format (DDEX XML, CSV, JSON, Excel)
   - Report type
5. Click **Generate**
6. Schedule delivery to distributor

### Via API

```javascript
const generateDSRForDistributor = async () => {
  const response = await fetch('/api/generateDSR', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      format: 'DDEX',
      territory: 'US',
      distributorId: 'stardust_distro'
    })
  });
  
  const report = await response.json();
  console.log('Report sent to Stardust Distro:', report.deliveryId);
};
```

### Scheduled Reports to Stardust Distro

Configure automatic report generation:

```json
{
  "distributor": "stardust_distro",
  "schedule": "monthly",
  "dayOfMonth": 5,
  "format": "DDEX",
  "delivery": {
    "method": "sftp",
    "credentials": "encrypted_stardust_distro_creds"
  }
}
```

## DSR XML Structure for Stardust Distro

### Standard DSR Message
```xml
<?xml version="1.0" encoding="UTF-8"?>
<SalesReportMessage 
  xmlns="http://ddex.net/xml/dsr/40"
  MessageSchemaVersionId="dsr/40">
  
  <MessageHeader>
    <MessageId>DSR_STARDUST_DSP_20250131_123456</MessageId>
    <MessageCreatedDateTime>2025-01-31T23:59:59Z</MessageCreatedDateTime>
    <MessageSender>
      <PartyName>Stardust DSP</PartyName>
      <PartyId>PADPIDA2025STARDUSTDSP</PartyId>
    </MessageSender>
    <MessageRecipient>
      <PartyName>Stardust Distro</PartyName>
      <PartyId>PADPIDA2025STARDUSTDISTRO</PartyId>
    </MessageRecipient>
  </MessageHeader>
  
  <SalesReportMessage>
    <SalesReportId>SR_202501_US</SalesReportId>
    <SalesReportPeriod>
      <StartDate>2025-01-01</StartDate>
      <EndDate>2025-01-31</EndDate>
    </SalesReportPeriod>
    
    <SalesReport>
      <ReleaseReference>REL_123456</ReleaseReference>
      <ReleaseSalesReport>
        <ISRC>USRC12345678</ISRC>
        <NumberOfStreams>150000</NumberOfStreams>
        <NumberOfDownloads>500</NumberOfDownloads>
        <GrossRevenue CurrencyCode="USD">450.00</GrossRevenue>
        <Territory>US</Territory>
      </ReleaseSalesReport>
    </SalesReport>
  </SalesReportMessage>
</SalesReportMessage>
```

## Report Fields for Distributors

### Required Fields
- **ReportId**: Unique identifier
- **Period**: Start and end dates
- **Territory**: ISO country code or "Worldwide"
- **Usage**: Streams/downloads per track
- **Revenue**: Gross amount and currency
- **Distributor**: Source distributor (e.g., "stardust_distro")

### Optional Fields
- **Demographics**: Age, gender distribution
- **Device**: Platform breakdown
- **Playlist**: Playlist performance
- **Discovery**: Traffic sources
- **Geography**: City-level data

## Revenue Calculation for Stardust Distro

### Streaming Revenue
```
Revenue = Number of Streams × Per-Stream Rate × Territory Multiplier
```

### Download Revenue
```
Revenue = Number of Downloads × Download Price × (1 - Platform Fee)
```

### Royalty Distribution
Three calculation methods reported to Stardust Distro:
1. **Pro-rata**: Based on total market share
2. **User-centric**: Based on individual user listening
3. **Hybrid**: Combination of both methods

## Delivery Options to Distributors

### 1. SFTP Delivery to Stardust Distro
Automated upload to Stardust Distro's servers:
```json
{
  "protocol": "SFTP",
  "host": "reports.stardust-distro.com",
  "directory": "/incoming/dsr/stardust_dsp/",
  "credentials": "encrypted"
}
```

### 2. API Delivery
Direct API call to Stardust Distro:
```javascript
const deliverDSR = async (report) => {
  const response = await fetch('https://api.stardust-distro.com/v1/dsr/receive', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STARDUST_DISTRO_TOKEN}`,
      'Content-Type': 'application/xml'
    },
    body: report
  });
  
  return response.json();
};
```

### 3. Cloud Storage
Direct delivery to Stardust Distro's cloud storage:
- Amazon S3 buckets
- Google Cloud Storage
- Azure Blob Storage

### 4. Webhook Notification
Real-time notification to Stardust Distro:
```json
{
  "event": "dsr.generated",
  "dsp": "stardust_dsp",
  "reportId": "DSR_20250131_123456",
  "downloadUrl": "https://storage.stardust-dsp.com/reports/...",
  "expiresAt": "2025-02-07T23:59:59Z"
}
```

## Report Analytics in Stardust DSP

### Key Metrics Reported
- **Total Streams**: Aggregate play count
- **Unique Listeners**: Distinct users
- **Revenue per User**: ARPU calculation
- **Top Tracks**: Performance ranking
- **Growth Rate**: Period-over-period change

### Visualization for Distributor Reports
- Line charts for trends
- Heat maps for geographic data
- Pie charts for distribution
- Tables for detailed breakdowns

## Compliance & Validation

### DDEX Validation
All DSR messages to Stardust Distro are validated against:
- DDEX DSR XSD schema
- Business rule validation
- Data consistency checks

### Audit Trail
Complete audit logging for distributor reports:
- Report generation timestamp
- User who generated report
- Parameters used
- Delivery confirmation to Stardust Distro

## Troubleshooting DSR Generation

### Common Issues

**Missing Data for Stardust Distro Content**
- Ensure tracking is properly configured
- Check date range includes data
- Verify content was delivered from Stardust Distro

**Validation Errors**
- Review required fields for DDEX compliance
- Check date format (YYYY-MM-DD)
- Validate territory codes

**Delivery Failures to Stardust Distro**
- Verify Stardust Distro credentials
- Check network connectivity
- Confirm SFTP permissions

### Error Codes
| Code | Description | Solution |
|------|-------------|----------|
| DSR_001 | Invalid date range | Check start date is before end date |
| DSR_002 | No data found | Verify usage exists for period |
| DSR_003 | Format not supported | Use DDEX, CSV, JSON, or Excel |
| DSR_004 | Delivery to Stardust Distro failed | Check distributor configuration |

## Best Practices

### Reporting Schedule to Stardust Distro
- Generate monthly reports by 5th of following month
- Keep historical reports for 24 months
- Archive older reports to cold storage
- Send notifications when reports are ready

### Data Accuracy
- Reconcile daily aggregations
- Validate against source data
- Maintain revision history
- Support report corrections

### Performance
- Generate reports during off-peak hours
- Use pagination for large datasets
- Cache frequently accessed reports
- Optimize queries for large catalogs

## API Reference for DSR

### Generate DSR for Stardust Distro
```http
POST /api/v1/reports/dsr
Authorization: Bearer TOKEN

{
  "startDate": "2025-01-01",
  "endDate": "2025-01-31",
  "format": "DDEX",
  "territory": "US",
  "distributorId": "stardust_distro",
  "includeDetails": true
}
```

### Get Report Status
```http
GET /api/v1/reports/{reportId}/status
```

### Download Report
```http
GET /api/v1/reports/{reportId}/download
```

### Schedule Report for Stardust Distro
```http
POST /api/v1/reports/schedule

{
  "type": "DSR",
  "frequency": "monthly",
  "format": "DDEX",
  "distributor": "stardust_distro",
  "delivery": {
    "method": "sftp",
    "host": "reports.stardust-distro.com"
  }
}
```

## Support
- Stardust DSP Support: dsr-support@stardust-dsp.com
- Stardust Distro Integration: integration@stardust-distro.com
- DDEX Resources: https://ddex.net/standards/dsr