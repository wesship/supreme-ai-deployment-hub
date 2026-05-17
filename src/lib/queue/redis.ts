import { createClient } from 'redis';

// Redis Queue implementation for Phase 2
export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

export async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  return redisClient;
}

export async function enqueueTask(queueName: string, payload: any) {
  const client = await connectRedis();
  await client.lPush(queueName, JSON.stringify(payload));
}

export async function dequeueTask(queueName: string) {
  const client = await connectRedis();
  const result = await client.rPop(queueName);
  return result ? JSON.parse(result) : null;
}
