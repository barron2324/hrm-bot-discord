import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { DiscordService } from '../discord/discord.service'

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name)

  constructor(private readonly discordService: DiscordService) {}

  @Cron('45 48 10 * * 1-7')
  handleCron() {
    this.discordService.sendUserTotalTimeToAllChannels()
    this.logger.debug('Called every day at 12:00 PM')
  }
}
