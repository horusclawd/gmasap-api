const { DynamoDBService } = require('shared/dynamodb');
const { ResponseFormatter, ErrorResponses } = require('shared/response');
const { errorHandler, authMiddleware, compose } = require('shared/middleware');
const { eventService } = require('shared/events');

// Initialize DynamoDB service
const athletesTable = new DynamoDBService(process.env.ATHLETES_TABLE);

// Route handlers (to be implemented in Phase 2)
const routes = {
  'GET /athletes/{userId}/profile': compose(errorHandler)(getProfile),
  'PATCH /athletes/{userId}/profile': compose(errorHandler, authMiddleware)(updateProfile),
  'GET /athletes/{userId}/videos': compose(errorHandler)(getVideos),
  'POST /athletes/{userId}/videos/upload/presigned': compose(errorHandler, authMiddleware)(getUploadUrl),
  'POST /athletes/{userId}/videos': compose(errorHandler, authMiddleware)(addVideo),
  'DELETE /athletes/{userId}/videos/{videoId}': compose(errorHandler, authMiddleware)(deleteVideo)
};

// Placeholder implementations
async function getProfile(event) {
  return ErrorResponses.error('Athletes profile endpoints will be implemented in Phase 2', 501);
}

async function updateProfile(event) {
  return ErrorResponses.error('Athletes profile endpoints will be implemented in Phase 2', 501);
}

async function getVideos(event) {
  return ErrorResponses.error('Athletes video endpoints will be implemented in Phase 2', 501);
}

async function getUploadUrl(event) {
  return ErrorResponses.error('Athletes video endpoints will be implemented in Phase 2', 501);
}

async function addVideo(event) {
  return ErrorResponses.error('Athletes video endpoints will be implemented in Phase 2', 501);
}

async function deleteVideo(event) {
  return ErrorResponses.error('Athletes video endpoints will be implemented in Phase 2', 501);
}

// Main Lambda handler
exports.handler = async (event) => {
  console.log('Athletes function called:', JSON.stringify(event, null, 2));

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
  const route = `${event.httpMethod} ${event.resource}`;
  const handler = routes[route];

  if (!handler) {
    return ErrorResponses.notFound('Route not found');
  }

  try {
    return await handler(event);
  } catch (error) {
    console.error('Unhandled error in athletes function:', error);
    return ErrorResponses.internalError('Internal server error');
  }
};