import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import { model } from 'src/config/model'
import { DBNAME } from 'src/constructor'
import { LogEntryService } from './log-entry.service'
import { DiscordConfigService } from '../discord-config/discord-config.service'
import { RedisService } from '../redis/redis.service'
import { UserTotalTimeService } from '../user-total-time/user-total-tiem.service'

@Module({
  imports: [MongooseModule.forFeature(model, DBNAME)],
  providers: [
    LogEntryService,
    DiscordConfigService,
    ConfigService,
    UserTotalTimeService,
    RedisService,
  ],
})
export class LogEntryModule {}
