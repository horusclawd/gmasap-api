const jwt = require('jsonwebtoken');

// JWT secret - in production this should be from AWS Systems Manager Parameter Store
const JWT_SECRET = process.env.JWT_SECRET || 'gmasap-dev-secret-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

class JWTService {
  static generateTokens(payload) {
    const accessToken = jwt.sign(
      {
        ...payload,
        type: 'access'
      },
      JWT_SECRET,
      { 
        expiresIn: JWT_EXPIRY,
        issuer: 'gmasap-api',
        audience: 'gmasap-app'
      }
    );

    const refreshToken = jwt.sign(
      {
        userId: payload.userId,
        email: payload.email,
        type: 'refresh'
      },
      JWT_SECRET,
      {
        expiresIn: REFRESH_TOKEN_EXPIRY,
        issuer: 'gmasap-api',
        audience: 'gmasap-app'
      }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: JWT_EXPIRY
    };
  }

  static verifyToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'gmasap-api',
        audience: 'gmasap-app'
      });
      
      return {
        success: true,
        decoded
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        expired: error.name === 'TokenExpiredError'
      };
    }
  }

  static extractTokenFromHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }

  static decodeTokenPayload(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  }

  static refreshAccessToken(refreshToken) {
    const verification = this.verifyToken(refreshToken);
    
    if (!verification.success) {
      throw new Error('Invalid refresh token');
    }

    const { decoded } = verification;
    
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    // Generate new access token
    return this.generateTokens({
      userId: decoded.userId,
      email: decoded.email
    });
  }
}

module.exports = {
  JWTService
};