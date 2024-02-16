import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import { model } from 'src/config/model'
import { DBNAME } from 'src/constructor'

import { DiscordService } from './discord.service'

import { ChartService } from '../chart/chart.service'
import { DiscordConfigService } from '../discord-config/discord-config.service'
import { LogEntryService } from '../log-entry/log-entry.service'
import { RedisService } from '../redis/redis.service'
import { UserEventService } from '../user-event/user-event.service'
import { UserTotalTimeService } from '../user-total-time/user-total-tiem.service'

@Module({
  imports: [MongooseModule.forFeature(model, DBNAME)],
  providers: [
    DiscordService,
    ConfigService,
    DiscordService,
    DiscordConfigService,
    LogEntryService,
    UserEventService,
    UserTotalTimeService,
    ChartService,
    RedisService,
  ],
})
export class DiscordModule {}
