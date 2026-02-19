const { DynamoDBService } = require('/opt/nodejs/shared/dynamodb');
const { ResponseFormatter, ErrorResponses } = require('/opt/nodejs/shared/response');
const { errorHandler, authMiddleware, optionalAuthMiddleware, compose } = require('/opt/nodejs/shared/middleware');
const { eventService } = require('/opt/nodejs/shared/events');

// Initialize DynamoDB service
const athletesTable = new DynamoDBService(process.env.ATHLETES_TABLE);

const routes = {
  'GET /athletes/{userId}/profile': compose(errorHandler, optionalAuthMiddleware)(getProfile),
  'PATCH /athletes/{userId}/profile': compose(errorHandler, authMiddleware)(updateProfile),
  'GET /athletes/{userId}/videos': compose(errorHandler, optionalAuthMiddleware)(getVideos),
  'POST /athletes/{userId}/videos/upload/presigned': compose(errorHandler, authMiddleware)(getUploadUrl),
  'POST /athletes/{userId}/videos': compose(errorHandler, authMiddleware)(addVideo),
  'DELETE /athletes/{userId}/videos/{videoId}': compose(errorHandler, authMiddleware)(deleteVideo)
};

// Get athlete profile
async function getProfile(event) {
  const userId = event.pathParameters?.userId;

  if (!userId) {
    return ErrorResponses.validation('User ID is required');
  }

  try {
    const profile = await athletesTable.get({
      PK: `ATHLETE#${userId}`,
      SK: 'PROFILE'
    });

    if (!profile) {
      // Return empty profile structure for non-existent athletes
      return ResponseFormatter.success({
        userId,
        sport: null,
        position: null,
        graduationYear: null,
        school: null,
        height: null,
        weight: null,
        bio: null,
        location: null,
        stats: {}
      }, 'Profile retrieved successfully');
    }

    return ResponseFormatter.success({
      userId: profile.userId,
      sport: profile.sport || null,
      position: profile.position || null,
      graduationYear: profile.graduationYear || null,
      school: profile.school || null,
      height: profile.height || null,
      weight: profile.weight || null,
      bio: profile.bio || null,
      location: profile.location || null,
      stats: profile.stats || {},
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt
    }, 'Profile retrieved successfully');
  } catch (error) {
    console.error('Get profile error:', error);
    throw error;
  }
}

// Update athlete profile (owner only)
async function updateProfile(event) {
  const { userId: authUserId } = event.requestContext.authorizer;
  const targetUserId = event.pathParameters?.userId;
  const updates = event.parsedBody;

  if (!targetUserId) {
    return ErrorResponses.validation('User ID is required');
  }

  // Check ownership
  if (authUserId !== targetUserId) {
    return ErrorResponses.forbidden('You can only update your own profile');
  }

  // Validate allowed fields
  const allowedFields = ['sport', 'position', 'graduationYear', 'school', 'height', 'weight', 'bio', 'location'];
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  for (const [field, value] of Object.entries(updates)) {
    if (allowedFields.includes(field) && value !== undefined) {
      updateExpressions.push(`#${field} = :${field}`);
      expressionAttributeNames[`#${field}`] = field;
      expressionAttributeValues[`:${field}`] = value;
    }
  }

  if (updateExpressions.length === 0) {
    return ErrorResponses.validation('No valid fields to update');
  }

  // Add updatedAt timestamp
  updateExpressions.push('#updatedAt = :updatedAt');
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = Date.now();

  try {
    // Check if profile exists
    const existingProfile = await athletesTable.get({
      PK: `ATHLETE#${targetUserId}`,
      SK: 'PROFILE'
    });

    if (!existingProfile) {
      // Create new profile
      const newProfile = {
        PK: `ATHLETE#${targetUserId}`,
        SK: 'PROFILE',
        userId: targetUserId,
        ...updates,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await athletesTable.put(newProfile);

      // Publish event
      await eventService.publishAthleteProfileUpdated(targetUserId, updates);

      return ResponseFormatter.success({
        userId: targetUserId,
        ...updates
      }, 'Profile created successfully', 201);
    }

    // Update existing profile
    const updatedProfile = await athletesTable.update(
      { PK: `ATHLETE#${targetUserId}`, SK: 'PROFILE' },
      `SET ${updateExpressions.join(', ')}`,
      expressionAttributeNames,
      expressionAttributeValues
    );

    // Publish event
    await eventService.publishAthleteProfileUpdated(targetUserId, updates);

    return ResponseFormatter.success({
      userId: updatedProfile.userId,
      sport: updatedProfile.sport,
      position: updatedProfile.position,
      graduationYear: updatedProfile.graduationYear,
      school: updatedProfile.school,
      height: updatedProfile.height,
      weight: updatedProfile.weight,
      bio: updatedProfile.bio,
      location: updatedProfile.location,
      updatedAt: updatedProfile.updatedAt
    }, 'Profile updated successfully');
  } catch (error) {
    console.error('Update profile error:', error);
    throw error;
  }
}

// Get athlete videos
async function getVideos(event) {
  const userId = event.pathParameters?.userId;

  if (!userId) {
    return ErrorResponses.validation('User ID is required');
  }

  try {
    // Scan for videos with this userId
    const result = await athletesTable.query(
      'begins_with(PK, :pk) AND begins_with(SK, :sk)',
      { '#pk': 'PK', '#sk': 'SK' },
      { ':pk': `ATHLETE#${userId}`, ':sk': 'VIDEO#' }
    );

    const videos = result.items
      .filter(item => item.SK && item.SK.startsWith('VIDEO#'))
      .map(video => ({
        id: video.videoId,
        title: video.title,
        description: video.description,
        url: video.url,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
        views: video.views || 0,
        createdAt: video.createdAt,
        updatedAt: video.updatedAt
      }));

    return ResponseFormatter.success({
      videos,
      count: videos.length
    }, 'Videos retrieved successfully');
  } catch (error) {
    console.error('Get videos error:', error);
    return ResponseFormatter.success({
      videos: [],
      count: 0
    }, 'Videos retrieved successfully');
  }
}

// Get presigned upload URL
async function getUploadUrl(event) {
  const { userId: authUserId } = event.requestContext.authorizer;
  const targetUserId = event.pathParameters?.userId;
  const { fileName, contentType } = event.parsedBody || {};

  if (!targetUserId) {
    return ErrorResponses.validation('User ID is required');
  }

  // Check ownership
  if (authUserId !== targetUserId) {
    return ErrorResponses.forbidden('You can only upload videos to your own profile');
  }

  if (!fileName || !contentType) {
    return ErrorResponses.validation('fileName and contentType are required');
  }

  // For now, return a placeholder - S3 integration would go here
  return ResponseFormatter.success({
    uploadUrl: `https://${process.env.MEDIA_BUCKET || 'gmasap-dev-media'}.s3.amazonaws.com/videos/${authUserId}/${fileName}?presigned-placeholder`,
    videoId: `video_${Date.now()}`,
    expiresIn: 3600
  }, 'Upload URL generated');
}

// Add video metadata
async function addVideo(event) {
  const { userId: authUserId } = event.requestContext.authorizer;
  const targetUserId = event.pathParameters?.userId;
  const { videoId, title, description, url, thumbnailUrl, duration } = event.parsedBody;

  if (!targetUserId) {
    return ErrorResponses.validation('User ID is required');
  }

  // Check ownership
  if (authUserId !== targetUserId) {
    return ErrorResponses.forbidden('You can only add videos to your own profile');
  }

  if (!videoId || !url) {
    return ErrorResponses.validation('videoId and url are required');
  }

  const video = {
    PK: `ATHLETE#${targetUserId}`,
    SK: `VIDEO#${videoId}`,
    userId: targetUserId,
    videoId,
    title: title || '',
    description: description || '',
    url,
    thumbnailUrl: thumbnailUrl || null,
    duration: duration || null,
    views: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await athletesTable.put(video);

  return ResponseFormatter.success({
    id: video.videoId,
    title: video.title,
    description: video.description,
    url: video.url,
    thumbnailUrl: video.thumbnailUrl,
    duration: video.duration,
    createdAt: video.createdAt
  }, 'Video added successfully', 201);
}

// Delete video
async function deleteVideo(event) {
  const { userId: authUserId } = event.requestContext.authorizer;
  const targetUserId = event.pathParameters?.userId;
  const videoId = event.pathParameters?.videoId;

  if (!targetUserId || !videoId) {
    return ErrorResponses.validation('User ID and Video ID are required');
  }

  // Check ownership
  if (authUserId !== targetUserId) {
    return ErrorResponses.forbidden('You can only delete your own videos');
  }

  // Check if video exists
  const video = await athletesTable.get({
    PK: `ATHLETE#${targetUserId}`,
    SK: `VIDEO#${videoId}`
  });

  if (!video) {
    return ErrorResponses.notFound('Video not found');
  }

  await athletesTable.delete({
    PK: `ATHLETE#${targetUserId}`,
    SK: `VIDEO#${videoId}`
  });

  return ResponseFormatter.success(null, 'Video deleted successfully');
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
  const path = event.path || event.rawPath;
  const route = `${event.httpMethod} ${path}`;
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
