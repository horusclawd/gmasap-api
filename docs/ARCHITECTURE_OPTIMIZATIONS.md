# GMASAP Architecture Optimizations

## Key Insights Incorporated

### 💰 Cost Optimization Priorities

**1. Defer OpenSearch Serverless ($35/mo → $0)**
- **Problem**: OpenSearch is our biggest fixed cost in Phase 1
- **Solution**: Use DynamoDB GSIs for basic search/filtering initially
- **Timeline**: Move OpenSearch to Phase 3 when search complexity justifies the cost

**2. Question AppSync Real-Time Necessity**
- **Problem**: AppSync adds architectural complexity
- **Solution**: Start with HTTP polling, upgrade to real-time only when proven necessary
- **Timeline**: Evaluate in Sprint 2.3 based on user feedback

### 🏗️ DynamoDB Access Pattern Planning

**Single-Table Design Considerations:**

```javascript
// Current multi-table approach (Phase 1)
UsersTable: USER#{userId}#PROFILE
PostsTable: POST#{postId}#METADATA  
AthletesTable: ATHLETE#{userId}#PROFILE

// Future single-table optimization (Phase 2+)
MainTable: {
  PK: USER#{userId} | POST#{postId} | ATHLETE#{userId}
  SK: PROFILE | VIDEO#{id} | STAT#{category} | LIKE#{userId}
  GSI1PK: EMAIL#{email} | SPORT#{sport} | TIMESTAMP#{timestamp}
  GSI1SK: USER | ATHLETE | POST
}
```

### 📊 DynamoDB + Aurora Hybrid Strategy

**99% Hot Path → DynamoDB (Fast & Cheap)**
- User profiles, posts, likes
- Real-time feed queries
- Authentication data
- Basic athlete filters

**1% Analytics → Aurora Serverless v2**
- Complex scout analytics
- Reporting dashboards  
- Cross-sport comparisons
- Graduation year trends

## Revised Implementation Plan

### Phase 1 Optimizations (Current)

**Remove from Sprint 1.1:**
- ~~OpenSearch Serverless~~ → Use DynamoDB GSIs
- ~~Custom domain SSL~~ → Use API Gateway default endpoint

**Add to Sprint 1.3:**
- DynamoDB GSI queries for basic search
- Simple text filtering on athlete profiles

```javascript
// Basic search using DynamoDB GSIs instead of OpenSearch
const searchAthletes = async (sport, position, graduationYear) => {
  return await athletesTable.query(
    '#sport = :sport AND begins_with(#sk, :position)',
    { '#sport': 'sport', '#sk': 'SK' },
    { ':sport': sport, ':position': `PROFILE#${position}` },
    { 
      IndexName: 'sport-position-index',
      FilterExpression: '#gradYear = :gradYear',
      ExpressionAttributeNames: { '#gradYear': 'graduationYear' },
      ExpressionAttributeValues: { ':gradYear': graduationYear }
    }
  );
};
```

### Phase 2 Decision Points

**Week 5: Real-Time Evaluation**
- Measure user engagement with HTTP polling
- Decide: AppSync real-time vs continue polling
- Criteria: >50% users active >5min sessions

**Week 6: Search Complexity Assessment** 
- Evaluate DynamoDB GSI limitations
- Decide: OpenSearch vs enhanced DynamoDB patterns
- Criteria: Search queries requiring >2 GSIs

### Phase 3 Scaling Strategy

**When to Add OpenSearch:**
- Full-text search requirements
- Faceted search with multiple filters
- Autocomplete and suggestions
- Search result ranking/ML

**When to Add AppSync:**
- Proven real-time engagement
- Multi-user collaboration features
- Live notifications critical to UX

## Updated Cost Projections

### Phase 1 (Optimized)
| Service | Original | Optimized | Savings |
|---------|----------|-----------|---------|
| Lambda | $20 | $20 | $0 |
| DynamoDB | $0 | $0 | $0 |
| API Gateway | $7 | $7 | $0 |
| S3 | $2 | $2 | $0 |
| ~~OpenSearch~~ | ~~$35~~ | $0 | **$35** |
| ~~SSL Certificate~~ | ~~$0.50~~ | $0 | **$0.50** |
| **Total** | **$64.50** | **$29** | **$35.50** |

### Scale (100K Users - Optimized)
- DynamoDB will handle 99% of queries efficiently
- Aurora Serverless v2 only for complex analytics
- OpenSearch only if search complexity demands it
- **Estimated**: $800-1000/month vs original $1,235

## Implementation Changes

### 1. Remove OpenSearch from template.yaml
```yaml
# DELETE: OpenSearch Serverless resources
# ADD: Enhanced DynamoDB GSIs for search
```

### 2. Enhanced DynamoDB Schema
```javascript
// Add search-optimized GSIs
GlobalSecondaryIndexes:
  - IndexName: sport-graduation-index
    KeySchema:
      - AttributeName: sport
        KeyType: HASH
      - AttributeName: graduationYear  
        KeyType: RANGE
```

### 3. Simplified Real-Time Strategy
```javascript
// Phase 1: HTTP polling every 30s
// Phase 2: Evaluate based on usage
// Phase 3: AppSync if justified
```

## Success Metrics for Optimization

**Phase 1 Exit Criteria:**
- ✅ <$30/month AWS costs (vs $65 original)
- ✅ <200ms query response times with DynamoDB GSIs
- ✅ Basic search working without OpenSearch
- ✅ No user complaints about polling delays

**Phase 2 Decision Metrics:**
- Real-time engagement: % users active >5min
- Search complexity: % queries requiring multiple filters
- Cost efficiency: DynamoDB vs OpenSearch query costs

This optimization saves us $35.50/month in Phase 1 while maintaining full functionality. The architecture remains scalable — we add complexity only when usage patterns justify the cost.