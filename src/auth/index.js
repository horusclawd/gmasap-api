const bcrypt = require('bcryptjs');
const { DynamoDBService } = require('/opt/nodejs/shared/dynamodb');
const { JWTService } = require('/opt/nodejs/shared/jwt');
const { ResponseFormatter, ErrorResponses } = require('/opt/nodejs/shared/response');
const { errorHandler, validateRequest, authMiddleware, compose } = require('/opt/nodejs/shared/middleware');
const { eventService } = require('/opt/nodejs/shared/events');

// Initialize DynamoDB service
const usersTable = new DynamoDBService(process.env.USERS_TABLE);

// Route handlers
const routes = {
  'POST /auth/register': compose(
    errorHandler,
    validateRequest({
      email: { required: true, type: 'string', email: true },
      password: { required: true, type: 'string', minLength: 8 },
      firstName: { required: true, type: 'string', minLength: 1 },
      lastName: { required: true, type: 'string', minLength: 1 },
      role: { required: true, type: 'string' }
    })
  )(register),

  'POST /auth/login': compose(
    errorHandler,
    validateRequest({
      email: { required: true, type: 'string', email: true },
      password: { required: true, type: 'string' }
    })
  )(login),

  'POST /auth/refresh': compose(
    errorHandler,
    validateRequest({
      refreshToken: { required: true, type: 'string' }
    })
  )(refreshToken),

  'POST /auth/logout': compose(errorHandler)(logout),

  'GET /auth/profile': compose(errorHandler, authMiddleware)(getProfile),
  
  'PATCH /auth/profile': compose(
    errorHandler,
    authMiddleware,
    validateRequest({
      firstName: { type: 'string', minLength: 1 },
      lastName: { type: 'string', minLength: 1 },
      bio: { type: 'string', maxLength: 500 }
    })
  )(updateProfile)
};

// Register new user
async function register(event) {
  const { email, password, firstName, lastName, role } = event.parsedBody;

  // Check if user already exists
  const existingUser = await usersTable.query(
    '#email = :email',
    { '#email': 'email' },
    { ':email': email },
    { IndexName: 'email-index', Limit: 1 }
  );

  if (existingUser.items.length > 0) {
    return ErrorResponses.conflict('User with this email already exists');
  }

  // Validate role
  const validRoles = ['athlete', 'scout', 'coach', 'admin'];
  if (!validRoles.includes(role)) {
    return ErrorResponses.validation('Invalid role specified');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);
  
  // Generate user ID
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Create user record
  const user = {
    PK: `USER#${userId}`,
    SK: 'PROFILE',
    userId,
    email: email.toLowerCase(),
    passwordHash,
    firstName,
    lastName,
    role,
    isActive: true,
    emailVerified: false,
    provider: 'email',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await usersTable.put(user);

  // Generate JWT tokens
  const tokens = JWTService.generateTokens({
    userId,
    email: user.email,
    role,
    firstName,
    lastName
  });

  // Publish user registration event
  await eventService.publishUserRegistered(userId, user.email, role);

  // Return user data (without password hash)
  const { passwordHash: _, ...userResponse } = user;
  
  return ResponseFormatter.success({
    user: userResponse,
    ...tokens
  }, 'User registered successfully', 201);
}

// Login user
async function login(event) {
  const { email, password } = event.parsedBody;

  // Find user by email
  const result = await usersTable.query(
    '#email = :email',
    { '#email': 'email' },
    { ':email': email.toLowerCase() },
    { IndexName: 'email-index', Limit: 1 }
  );

  if (result.items.length === 0) {
    return ErrorResponses.unauthorized('Invalid email or password');
  }

  const user = result.items[0];

  // Check if user is active
  if (!user.isActive) {
    return ErrorResponses.unauthorized('Account is deactivated');
  }

  // Verify password
  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    return ErrorResponses.unauthorized('Invalid email or password');
  }

  // Generate JWT tokens
  const tokens = JWTService.generateTokens({
    userId: user.userId,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName
  });

  // Publish login event
  await eventService.publishUserLoggedIn(user.userId, user.email);

  // Return user data (without password hash)
  const { passwordHash: _, ...userResponse } = user;
  
  return ResponseFormatter.success({
    user: userResponse,
    ...tokens
  }, 'Login successful');
}

// Refresh access token
async function refreshToken(event) {
  const { refreshToken } = event.parsedBody;

  try {
    const tokens = JWTService.refreshAccessToken(refreshToken);
    
    return ResponseFormatter.success(tokens, 'Token refreshed successfully');
  } catch (error) {
    return ErrorResponses.unauthorized(error.message);
  }
}

// Logout user
async function logout(event) {
  // In a more complex implementation, we would invalidate the token
  // For now, we'll just return success (client will discard tokens)
  return ResponseFormatter.success(null, 'Logout successful');
}

// Get current user profile
async function getProfile(event) {
  const { userId } = event.requestContext.authorizer;

  try {
    const user = await usersTable.get({
      PK: `USER#${userId}`,
      SK: 'PROFILE'
    });

    if (!user) {
      return ErrorResponses.notFound('User not found');
    }

    // Return user data (without password hash)
    const { passwordHash: _, ...userResponse } = user;
    
    return ResponseFormatter.success(
      { user: userResponse },
      'Profile retrieved successfully'
    );
  } catch (error) {
    console.error('Get profile error:', error);
    throw error;
  }
}

// Update user profile
async function updateProfile(event) {
  const { userId } = event.requestContext.authorizer;
  const updates = event.parsedBody;

  try {
    // Get current user profile
    const currentUser = await usersTable.get({
      PK: `USER#${userId}`,
      SK: 'PROFILE'
    });

    if (!currentUser) {
      return ErrorResponses.notFound('User not found');
    }

    // Build update expression for allowed fields
    const allowedFields = ['firstName', 'lastName', 'bio', 'phone', 'location'];
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

    // Update user profile
    const updatedUser = await usersTable.update(
      { PK: `USER#${userId}`, SK: 'PROFILE' },
      `SET ${updateExpressions.join(', ')}`,
      expressionAttributeNames,
      expressionAttributeValues
    );

    // Publish profile update event
    await eventService.publishUserProfileUpdated(userId, updates);

    // Return updated profile (without password hash)
    const { passwordHash: _, ...userResponse } = updatedUser;
    
    return ResponseFormatter.success(
      { user: userResponse },
      'Profile updated successfully'
    );
  } catch (error) {
    console.error('Profile update error:', error);
    throw error;
  }
}

// Main Lambda handler
exports.handler = async (event) => {
  console.log('Auth function called:', JSON.stringify(event, null, 2));

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
    console.error('Unhandled error in auth function:', error);
    return ErrorResponses.internalError('Internal server error');
  }
};