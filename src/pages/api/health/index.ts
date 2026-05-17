import { redisClient } from '@/lib/queue/redis';

export async function checkHealth() {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      redis: 'disconnected',
      database: 'ok' // Mocked for now
    }
  };

  try {
    if (redisClient.isOpen) {
      await redisClient.ping();
      status.services.redis = 'ok';
    }
  } catch (error) {
    status.services.redis = 'error';
    status.status = 'degraded';
  }

  return status;
}
