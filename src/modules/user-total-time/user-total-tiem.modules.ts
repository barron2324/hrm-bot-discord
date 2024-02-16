import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import { model } from 'src/config/model'
import { DBNAME } from 'src/constructor'
import { UserTotalTimeService } from './user-total-tiem.service'
import { DiscordConfigService } from '../discord-config/discord-config.service'
import { RedisService } from '../redis/redis.service'

@Module({
  imports: [MongooseModule.forFeature(model, DBNAME)],
  providers: [
    UserTotalTimeService,
    DiscordConfigService,
    ConfigService,
    RedisService,
  ],
})
export class UserTotalTimeModule {}
