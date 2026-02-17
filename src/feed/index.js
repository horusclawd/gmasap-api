const { DynamoDBService } = require('/opt/nodejs/shared/dynamodb');
const { ResponseFormatter, ErrorResponses } = require('/opt/nodejs/shared/response');
const { errorHandler, authMiddleware, optionalAuthMiddleware, compose } = require('/opt/nodejs/shared/middleware');
const { eventService } = require('/opt/nodejs/shared/events');

// Initialize DynamoDB service
const postsTable = new DynamoDBService(process.env.POSTS_TABLE);

// Route handlers (to be implemented in Sprint 1.3)
const routes = {
  'GET /feed/posts': compose(errorHandler, optionalAuthMiddleware)(getPosts),
  'POST /feed/posts': compose(errorHandler, authMiddleware)(createPost),
  'POST /feed/posts/{id}/like': compose(errorHandler, authMiddleware)(toggleLike),
  'DELETE /feed/posts/{id}': compose(errorHandler, authMiddleware)(deletePost)
};

// Placeholder implementations
async function getPosts(event) {
  return ErrorResponses.error('Feed endpoints will be implemented in Sprint 1.3', 501);
}

async function createPost(event) {
  return ErrorResponses.error('Feed endpoints will be implemented in Sprint 1.3', 501);
}

async function toggleLike(event) {
  return ErrorResponses.error('Feed endpoints will be implemented in Sprint 1.3', 501);
}

async function deletePost(event) {
  return ErrorResponses.error('Feed endpoints will be implemented in Sprint 1.3', 501);
}

// Main Lambda handler
exports.handler = async (event) => {
  console.log('Feed function called:', JSON.stringify(event, null, 2));

  // Handle CORS preflight
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

  // Parse the route
  const path = event.path || event.rawPath;
  const route = `${event.httpMethod} ${path}`;
  const handler = routes[route];

  if (!handler) {
    return ErrorResponses.notFound('Route not found');
  }

  try {
    return await handler(event);
  } catch (error) {
    console.error('Unhandled error in feed function:', error);
    return ErrorResponses.internalError('Internal server error');
  }
};