const { DynamoDBService } = require('./dynamodb');

// Search service using DynamoDB GSIs instead of OpenSearch for Phase 1 cost optimization
class SearchService {
  constructor(athletesTableName) {
    this.athletesTable = new DynamoDBService(athletesTableName);
  }

  // Basic athlete search using DynamoDB GSIs
  async searchAthletes(filters = {}, pagination = {}) {
    const { 
      sport, 
      position, 
      graduationYear, 
      state, 
      gpaMin,
      heightMin,
      limit = 20,
      lastKey = null 
    } = { ...filters, ...pagination };

    try {
      let queryParams = {
        Limit: limit
      };

      if (lastKey) {
        queryParams.ExclusiveStartKey = lastKey;
      }

      // Strategy 1: Sport + Position filter (most common)
      if (sport && position) {
        return await this.athletesTable.query(
          '#sport = :sport AND begins_with(#position, :position)',
          { '#sport': 'sport', '#position': 'position' },
          { ':sport': sport, ':position': position },
          {
            ...queryParams,
            IndexName: 'sport-position-index',
            ...(this.buildFilterExpression({ graduationYear, state, gpaMin, heightMin }))
          }
        );
      }

      // Strategy 2: Sport + Graduation Year
      if (sport && graduationYear) {
        return await this.athletesTable.query(
          '#sport = :sport AND #gradYear = :gradYear',
          { '#sport': 'sport', '#gradYear': 'graduationYear' },
          { ':sport': sport, ':gradYear': graduationYear },
          {
            ...queryParams,
            IndexName: 'sport-graduation-index',
            ...(this.buildFilterExpression({ position, state, gpaMin, heightMin }))
          }
        );
      }

      // Strategy 3: State + Sport
      if (state && sport) {
        return await this.athletesTable.query(
          '#state = :state AND #sport = :sport',
          { '#state': 'state', '#sport': 'sport' },
          { ':state': state, ':sport': sport },
          {
            ...queryParams,
            IndexName: 'state-sport-index',
            ...(this.buildFilterExpression({ position, graduationYear, gpaMin, heightMin }))
          }
        );
      }

      // Strategy 4: Single attribute queries
      if (sport) {
        return await this.athletesTable.query(
          '#sport = :sport',
          { '#sport': 'sport' },
          { ':sport': sport },
          {
            ...queryParams,
            IndexName: 'sport-position-index',
            ...(this.buildFilterExpression({ position, graduationYear, state, gpaMin, heightMin }))
          }
        );
      }

      // Fallback: Scan with filters (expensive, but works)
      console.warn('Using DynamoDB scan - consider adding more GSIs for this query pattern');
      return await this.athletesTable.scan({
        ...queryParams,
        ...(this.buildFilterExpression({ sport, position, graduationYear, state, gpaMin, heightMin }))
      });

    } catch (error) {
      console.error('Search error:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  // Build filter expressions for additional criteria
  buildFilterExpression(filters) {
    const filterExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    if (filters.position && !filters.position.startsWith(':')) {
      filterExpressions.push('contains(#position, :position)');
      expressionAttributeNames['#position'] = 'position';
      expressionAttributeValues[':position'] = filters.position;
    }

    if (filters.graduationYear) {
      filterExpressions.push('#gradYear = :gradYear');
      expressionAttributeNames['#gradYear'] = 'graduationYear';
      expressionAttributeValues[':gradYear'] = filters.graduationYear;
    }

    if (filters.state) {
      filterExpressions.push('#state = :state');
      expressionAttributeNames['#state'] = 'state';
      expressionAttributeValues[':state'] = filters.state;
    }

    if (filters.gpaMin) {
      filterExpressions.push('#gpa >= :gpaMin');
      expressionAttributeNames['#gpa'] = 'gpa';
      expressionAttributeValues[':gpaMin'] = filters.gpaMin;
    }

    if (filters.heightMin) {
      filterExpressions.push('#height >= :heightMin');
      expressionAttributeNames['#height'] = 'height';
      expressionAttributeValues[':heightMin'] = filters.heightMin;
    }

    if (filterExpressions.length === 0) {
      return {};
    }

    return {
      FilterExpression: filterExpressions.join(' AND '),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    };
  }

  // Get available filter options (for dropdown menus)
  async getFilterOptions() {
    try {
      // This would typically be cached or pre-computed
      const sports = ['Football', 'Basketball', 'Baseball', 'Soccer', 'Track', 'Wrestling'];
      const positions = {
        'Football': ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P'],
        'Basketball': ['PG', 'SG', 'SF', 'PF', 'C'],
        'Baseball': ['P', 'C', '1B', '2B', '3B', 'SS', 'OF'],
        'Soccer': ['GK', 'D', 'M', 'F'],
        'Track': ['Sprint', 'Distance', 'Hurdles', 'Jump', 'Throw'],
        'Wrestling': ['106', '113', '120', '126', '132', '138', '145', '152', '160', '170', '182', '195', '220', '285']
      };
      const graduationYears = [2024, 2025, 2026, 2027];
      const states = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];

      return {
        sports,
        positions,
        graduationYears,
        states
      };
    } catch (error) {
      console.error('Error getting filter options:', error);
      throw new Error('Failed to get filter options');
    }
  }

  // Text search using DynamoDB (limited, but functional for Phase 1)
  async textSearch(query, limit = 10) {
    try {
      // Simple text matching on name, school, bio fields
      // This is less sophisticated than OpenSearch but works for basic needs
      const results = await this.athletesTable.scan({
        FilterExpression: 'contains(#firstName, :query) OR contains(#lastName, :query) OR contains(#school, :query) OR contains(#bio, :query)',
        ExpressionAttributeNames: {
          '#firstName': 'firstName',
          '#lastName': 'lastName', 
          '#school': 'school',
          '#bio': 'bio'
        },
        ExpressionAttributeValues: {
          ':query': query
        },
        Limit: limit
      });

      return results;
    } catch (error) {
      console.error('Text search error:', error);
      throw new Error(`Text search failed: ${error.message}`);
    }
  }
}

module.exports = {
  SearchService
};