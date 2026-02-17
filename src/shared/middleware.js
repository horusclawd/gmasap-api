const { JWTService } = require('./jwt');
const { ErrorResponses } = require('./response');

// Authentication middleware
const authMiddleware = (handler) => {
  return async (event) => {
    try {
      // Handle OPTIONS requests (CORS preflight)
      if (event.httpMethod === 'OPTIONS') {
        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
          },
          body: ''
        };
      }

      const authHeader = event.headers.Authorization || event.headers.authorization;
      
      if (!authHeader) {
        return ErrorResponses.unauthorized('Missing authorization header');
      }

      const token = JWTService.extractTokenFromHeader(authHeader);
      
      if (!token) {
        return ErrorResponses.unauthorized('Invalid authorization header format');
      }

      const verification = JWTService.verifyToken(token);
      
      if (!verification.success) {
        if (verification.expired) {
          return ErrorResponses.unauthorized('Token expired');
        }
        return ErrorResponses.unauthorized('Invalid token');
      }

      // Add user info to event context
      event.requestContext = event.requestContext || {};
      event.requestContext.authorizer = {
        userId: verification.decoded.userId,
        email: verification.decoded.email,
        role: verification.decoded.role
      };

      return await handler(event);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return ErrorResponses.internalError('Authentication failed');
    }
  };
};

// Optional auth middleware (doesn't fail if no token provided)
const optionalAuthMiddleware = (handler) => {
  return async (event) => {
    try {
      // Handle OPTIONS requests
      if (event.httpMethod === 'OPTIONS') {
        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
          },
          body: ''
        };
      }

      const authHeader = event.headers.Authorization || event.headers.authorization;
      
      if (authHeader) {
        const token = JWTService.extractTokenFromHeader(authHeader);
        
        if (token) {
          const verification = JWTService.verifyToken(token);
          
          if (verification.success) {
            event.requestContext = event.requestContext || {};
            event.requestContext.authorizer = {
              userId: verification.decoded.userId,
              email: verification.decoded.email,
              role: verification.decoded.role
            };
          }
        }
      }

      return await handler(event);
    } catch (error) {
      console.error('Optional auth middleware error:', error);
      // Continue without auth if there's an error
      return await handler(event);
    }
  };
};

// Error handling wrapper
const errorHandler = (handler) => {
  return async (event) => {
    try {
      return await handler(event);
    } catch (error) {
      console.error('Unhandled error:', error);
      
      // Handle different types of errors
      if (error.name === 'ValidationError') {
        return ErrorResponses.validation(error.message, error.details);
      }
      
      if (error.name === 'ConditionalCheckFailedException') {
        return ErrorResponses.conflict('Resource conflict');
      }
      
      if (error.name === 'ResourceNotFoundException') {
        return ErrorResponses.notFound();
      }

      // Generic server error
      return ErrorResponses.internalError(
        process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      );
    }
  };
};

// Request validation middleware
const validateRequest = (schema) => {
  return (handler) => {
    return async (event) => {
      try {
        let body = {};
        
        if (event.body) {
          try {
            body = JSON.parse(event.body);
          } catch (parseError) {
            return ErrorResponses.validation('Invalid JSON in request body');
          }
        }

        // Simple validation - in production, use a library like Joi or Zod
        const errors = [];
        
        for (const [field, rules] of Object.entries(schema)) {
          const value = body[field];
          
          if (rules.required && (value === undefined || value === null || value === '')) {
            errors.push(`${field} is required`);
            continue;
          }
          
          if (value !== undefined && rules.type) {
            const actualType = Array.isArray(value) ? 'array' : typeof value;
            if (actualType !== rules.type) {
              errors.push(`${field} must be of type ${rules.type}`);
            }
          }
          
          if (rules.email && value && !isValidEmail(value)) {
            errors.push(`${field} must be a valid email address`);
          }
          
          if (rules.minLength && value && value.length < rules.minLength) {
            errors.push(`${field} must be at least ${rules.minLength} characters long`);
          }
          
          if (rules.maxLength && value && value.length > rules.maxLength) {
            errors.push(`${field} cannot exceed ${rules.maxLength} characters`);
          }
        }
        
        if (errors.length > 0) {
          return ErrorResponses.validation('Validation failed', errors);
        }
        
        // Add parsed body to event
        event.parsedBody = body;
        
        return await handler(event);
      } catch (error) {
        console.error('Validation middleware error:', error);
        return ErrorResponses.internalError('Validation failed');
      }
    };
  };
};

// Helper function for email validation
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Compose multiple middlewares
const compose = (...middlewares) => {
  return (handler) => {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
  };
};

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  errorHandler,
  validateRequest,
  compose
};