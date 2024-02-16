import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import { ScheduleModule } from '@nestjs/schedule'
import { model } from 'src/config/model'
import { DBNAME } from 'src/constructor'
import { TasksService } from './tasks.service'
import { ChartService } from '../chart/chart.service'
import { DiscordConfigService } from '../discord-config/discord-config.service'
import { DiscordService } from '../discord/discord.service'
import { LogEntryService } from '../log-entry/log-entry.service'
import { RedisService } from '../redis/redis.service'
import { UserEventService } from '../user-event/user-event.service'
import { UserTotalTimeService } from '../user-total-time/user-total-tiem.service'

@Module({
  imports: [ScheduleModule.forRoot(), MongooseModule.forFeature(model, DBNAME)],
  providers: [
    TasksService,
    DiscordService,
    ConfigService,
    DiscordConfigService,
    LogEntryService,
    UserTotalTimeService,
    UserEventService,
    RedisService,
    ChartService,
  ],
})
export class TasksModule {}
