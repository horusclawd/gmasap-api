// Standard API response formatting
class ResponseFormatter {
  static success(data, message = 'Success', statusCode = 200) {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        message,
        data,
        timestamp: new Date().toISOString()
      })
    };
  }

  static error(message, statusCode = 400, errorCode = null, details = null) {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        success: false,
        message,
        errorCode,
        details,
        timestamp: new Date().toISOString()
      })
    };
  }

  static paginated(items, pagination, message = 'Success') {
    return this.success({
      items,
      pagination: {
        hasMore: !!pagination.lastKey,
        lastKey: pagination.lastKey,
        count: pagination.count || items.length
      }
    }, message);
  }

  static noContent() {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
      },
      body: ''
    };
  }
}

// Pre-defined error responses
class ErrorResponses {
  static unauthorized(message = 'Unauthorized access') {
    return ResponseFormatter.error(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Forbidden access') {
    return ResponseFormatter.error(message, 403, 'FORBIDDEN');
  }

  static notFound(resource = 'Resource') {
    return ResponseFormatter.error(`${resource} not found`, 404, 'NOT_FOUND');
  }

  static validation(message, details = null) {
    return ResponseFormatter.error(message, 422, 'VALIDATION_ERROR', details);
  }

  static conflict(message) {
    return ResponseFormatter.error(message, 409, 'CONFLICT');
  }

  static tooManyRequests(message = 'Too many requests') {
    return ResponseFormatter.error(message, 429, 'RATE_LIMIT_EXCEEDED');
  }

  static internalError(message = 'Internal server error', details = null) {
    return ResponseFormatter.error(message, 500, 'INTERNAL_ERROR', details);
  }
}

module.exports = {
  ResponseFormatter,
  ErrorResponses
};