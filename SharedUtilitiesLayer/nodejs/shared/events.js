const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');

const eventBridgeClient = new EventBridgeClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

class EventService {
  constructor() {
    this.eventBusName = process.env.EVENT_BUS_NAME;
    this.source = 'gmasap.api';
  }

  async publishEvent(eventType, detail, detailType = null) {
    try {
      // Local-dev friendliness: under SAM local, EventBridge calls will fail unless LocalStack/real AWS creds are configured.
      // In local mode, we log and no-op so core flows (e.g., auth) keep working.
      const isLocal = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'local';
      if (isLocal && process.env.DISABLE_EVENTS !== 'false') {
        console.log(`[local] skipping EventBridge publish: ${eventType}`);
        return null;
      }
      const event = {
        Source: this.source,
        DetailType: detailType || eventType,
        Detail: JSON.stringify({
          ...detail,
          eventId: this.generateEventId(),
          timestamp: new Date().toISOString(),
          version: '1.0'
        }),
        EventBusName: this.eventBusName
      };

      const command = new PutEventsCommand({
        Entries: [event]
      });

      const result = await eventBridgeClient.send(command);
      
      if (result.FailedEntryCount > 0) {
        throw new Error(`Failed to publish event: ${JSON.stringify(result.Entries[0].ErrorMessage)}`);
      }

      console.log(`Event published: ${eventType}`, { eventId: event.Detail.eventId });
      return event.Detail.eventId;
    } catch (error) {
      console.error('Failed to publish event:', error);
      throw error;
    }
  }

  // User events
  async publishUserRegistered(userId, email, role) {
    return await this.publishEvent('UserRegistered', {
      userId,
      email,
      role
    }, 'User Registration');
  }

  async publishUserProfileUpdated(userId, changes) {
    return await this.publishEvent('UserProfileUpdated', {
      userId,
      changes
    }, 'User Profile Update');
  }

  async publishUserLoggedIn(userId, email) {
    return await this.publishEvent('UserLoggedIn', {
      userId,
      email,
      loginTime: new Date().toISOString()
    }, 'User Authentication');
  }

  // Post events
  async publishPostCreated(postId, authorId, postType) {
    return await this.publishEvent('PostCreated', {
      postId,
      authorId,
      postType
    }, 'Social Feed Activity');
  }

  async publishPostLiked(postId, userId, authorId) {
    return await this.publishEvent('PostLiked', {
      postId,
      userId,
      authorId
    }, 'Social Feed Activity');
  }

  async publishPostUnliked(postId, userId, authorId) {
    return await this.publishEvent('PostUnliked', {
      postId,
      userId,
      authorId
    }, 'Social Feed Activity');
  }

  async publishPostDeleted(postId, authorId) {
    return await this.publishEvent('PostDeleted', {
      postId,
      authorId
    }, 'Social Feed Activity');
  }

  // Athlete events
  async publishAthleteProfileCreated(userId, sport, position) {
    return await this.publishEvent('AthleteProfileCreated', {
      userId,
      sport,
      position
    }, 'Athlete Profile');
  }

  async publishAthleteVideoUploaded(userId, videoId, sport) {
    return await this.publishEvent('AthleteVideoUploaded', {
      userId,
      videoId,
      sport
    }, 'Athlete Media');
  }

  async publishAthleteStatsUpdated(userId, category, stats) {
    return await this.publishEvent('AthleteStatsUpdated', {
      userId,
      category,
      stats
    }, 'Athlete Performance');
  }

  // Message events (for future phases)
  async publishMessageSent(conversationId, senderId, recipientId) {
    return await this.publishEvent('MessageSent', {
      conversationId,
      senderId,
      recipientId
    }, 'Direct Messaging');
  }

  // Scout events (for future phases)
  async publishAthleteWatchlisted(scoutId, athleteId) {
    return await this.publishEvent('AthleteWatchlisted', {
      scoutId,
      athleteId
    }, 'Scout Activity');
  }

  async publishAthleteNoteAdded(scoutId, athleteId, noteId) {
    return await this.publishEvent('AthleteNoteAdded', {
      scoutId,
      athleteId,
      noteId
    }, 'Scout Activity');
  }

  // Utility methods
  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
const eventService = new EventService();

module.exports = {
  EventService,
  eventService
};