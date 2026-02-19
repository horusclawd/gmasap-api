const { DynamoDBService } = require('/opt/nodejs/shared/dynamodb');
const { ResponseFormatter, ErrorResponses } = require('/opt/nodejs/shared/response');
const { errorHandler, authMiddleware, optionalAuthMiddleware, compose } = require('/opt/nodejs/shared/middleware');
const { eventService } = require('/opt/nodejs/shared/events');

// Initialize DynamoDB service
const postsTable = new DynamoDBService(process.env.POSTS_TABLE);

const routes = {
  'GET /feed/posts': compose(errorHandler, optionalAuthMiddleware)(getPosts),
  'POST /feed/posts': compose(errorHandler, authMiddleware)(createPost),
  'POST /feed/posts/{id}/like': compose(errorHandler, authMiddleware)(toggleLike),
  'DELETE /feed/posts/{id}': compose(errorHandler, authMiddleware)(deletePost)
};

// Get paginated feed posts (newest first)
async function getPosts(event) {
  const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 20;
  const lastKey = event.queryStringParameters?.lastKey 
    ? JSON.parse(Buffer.from(event.queryStringParameters.lastKey, 'base64').toString())
    : null;

  // Scan posts and sort by timestamp descending
  const scanOptions = {
    Limit: limit
  };

  if (lastKey) {
    scanOptions.ExclusiveStartKey = lastKey;
  }

  const scanResult = await postsTable.scan(scanOptions);

  // Sort by timestamp descending (newest first)
  const sortedItems = (scanResult.items || [])
    .filter(item => item.SK && item.SK.startsWith('METADATA'))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, limit);

  const nextKey = sortedItems.length === limit && scanResult.lastEvaluatedKey
    ? Buffer.from(JSON.stringify(scanResult.lastEvaluatedKey)).toString('base64')
    : null;

  return ResponseFormatter.success({
    posts: sortedItems.map(post => ({
      id: post.postId,
      authorId: post.author,
      authorFirstName: post.authorFirstName,
      authorLastName: post.authorLastName,
      content: post.content,
      mediaUrl: post.mediaUrl,
      likesCount: post.likesCount || 0,
      commentsCount: post.commentsCount || 0,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt
    })),
    nextKey
  }, 'Posts retrieved successfully');
}

// Create a new post
async function createPost(event) {
  const { userId } = event.requestContext.authorizer;
  const { content, mediaUrl } = event.parsedBody;

  if (!content && !mediaUrl) {
    return ErrorResponses.validation('Post must have content or media');
  }

  if (content && content.length > 5000) {
    return ErrorResponses.validation('Content must be less than 5000 characters');
  }

  // Generate post ID
  const postId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Get user info from profile for author display name
  const usersTable = new DynamoDBService(process.env.USERS_TABLE);
  let authorFirstName = 'Unknown';
  let authorLastName = '';

  try {
    const user = await usersTable.get({
      PK: `USER#${userId}`,
      SK: 'PROFILE'
    });
    if (user) {
      authorFirstName = user.firstName || 'Unknown';
      authorLastName = user.lastName || '';
    }
  } catch (error) {
    console.error('Error fetching author name:', error);
  }

  const timestamp = Date.now();
  const post = {
    PK: `POST#${postId}`,
    SK: 'METADATA',
    postId,
    author: userId,
    authorFirstName,
    authorLastName,
    content: content || '',
    mediaUrl: mediaUrl || null,
    likesCount: 0,
    commentsCount: 0,
    timestamp,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await postsTable.put(post);

  // Publish event
  await eventService.publishPostCreated(postId, userId, content);

  return ResponseFormatter.success({
    post: {
      id: post.postId,
      authorId: post.author,
      authorFirstName: post.authorFirstName,
      authorLastName: post.authorLastName,
      content: post.content,
      mediaUrl: post.mediaUrl,
      likesCount: 0,
      commentsCount: 0,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt
    }
  }, 'Post created successfully', 201);
}

// Toggle like on a post
async function toggleLike(event) {
  const { userId } = event.requestContext.authorizer;
  const postId = event.pathParameters?.id;

  if (!postId) {
    return ErrorResponses.validation('Post ID is required');
  }

  // Get the post
  const post = await postsTable.get({
    PK: `POST#${postId}`,
    SK: 'METADATA'
  });

  if (!post) {
    return ErrorResponses.notFound('Post not found');
  }

  // Check if user already liked
  const existingLike = await postsTable.get({
    PK: `POST#${postId}`,
    SK: `LIKE#${userId}`
  });

  let isLiked;
  let newLikesCount = post.likesCount || 0;

  if (existingLike) {
    // Unlike - remove the like
    await postsTable.delete({
      PK: `POST#${postId}`,
      SK: `LIKE#${userId}`
    });
    newLikesCount = Math.max(0, newLikesCount - 1);
    isLiked = false;
  } else {
    // Like - add the like
    await postsTable.put({
      PK: `POST#${postId}`,
      SK: `LIKE#${userId}`,
      userId,
      postId,
      createdAt: Date.now()
    });
    newLikesCount = (newLikesCount || 0) + 1;
    isLiked = true;
  }

  // Update likes count on post
  await postsTable.update(
    { PK: `POST#${postId}`, SK: 'METADATA' },
    'SET #likesCount = :likesCount, #updatedAt = :updatedAt',
    { '#likesCount': 'likesCount', '#updatedAt': 'updatedAt' },
    { ':likesCount': newLikesCount }
  );

  return ResponseFormatter.success({
    postId,
    isLiked,
    likesCount: newLikesCount
  }, isLiked ? 'Post liked' : 'Post unliked');
}

// Delete a post
async function deletePost(event) {
  const { userId } = event.requestContext.authorizer;
  const postId = event.pathParameters?.id;

  if (!postId) {
    return ErrorResponses.validation('Post ID is required');
  }

  // Get the post
  const post = await postsTable.get({
    PK: `POST#${postId}`,
    SK: 'METADATA'
  });

  if (!post) {
    return ErrorResponses.notFound('Post not found');
  }

  // Check ownership
  if (post.author !== userId) {
    return ErrorResponses.forbidden('You can only delete your own posts');
  }

  // Delete the post
  await postsTable.delete({
    PK: `POST#${postId}`,
    SK: 'METADATA'
  });

  return ResponseFormatter.success(null, 'Post deleted successfully');
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
