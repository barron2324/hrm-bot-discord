import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Redis from 'ioredis'

@Injectable()
export class RedisService {
  private readonly redisClient: Redis.Redis
  private readonly logger = new Logger(RedisService.name)
  public readonly userTimeMap: Redis.Redis
  public readonly totalTimes: Redis.Redis
  public readonly speakingTimes: Redis.Redis

  constructor(private readonly configService: ConfigService) {
    try {
      const host: string =
        this.configService.get<string>('REDIS_HOST') || '127.0.0.1'
      const port: number = this.configService.get<number>('REDIS_PORT') || 6379
      const password: string =
        this.configService.get<string>('REDIS_PASSWORD') || ''

      this.redisClient = new Redis.Redis({
        host: host,
        port: port,
        password: password,
      })

      this.userTimeMap = new Redis.Redis({
        host: host,
        port: port,
        password: password,
        keyPrefix: 'userTimeMap:',
      })

      this.totalTimes = new Redis.Redis({
        host: host,
        port: port,
        password: password,
        keyPrefix: 'totalTimes:',
      })

      this.speakingTimes = new Redis.Redis({
        host: host,
        port: port,
        password: password,
        keyPrefix: 'speakingTimes:',
      })
    } catch (error) {
      this.logger.error(`Failed to connect to Redis: ${error.message}`)
      console.error(error)
      throw error
    }
  }

  getRedisClient(): Redis.Redis {
    return this.redisClient
  }

  async addUserJoinTime(userId: string, joinTime: string): Promise<void> {
    await this.userTimeMap.set(userId, JSON.stringify({ joinTime }))
  }

  async getUserJoinTime(userId: string): Promise<string | null> {
    const userData = await this.userTimeMap.get(userId)
    if (userData) {
      const userObj = JSON.parse(userData)
      return userObj.joinTime
    }
    return null
  }

  async addSpeakingTime(userId: string, speakingTime: string): Promise<void> {
    await this.speakingTimes.set(userId, JSON.stringify({ speakingTime }))
  }

  async getSpeakingTime(userId: string): Promise<string | null> {
    const speakingData = await this.speakingTimes.get(userId)
    if (speakingData) {
      const speakingObj = JSON.parse(speakingData)
      return speakingObj.speakingTime
    }
    return null
  }
}
