import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectModel } from '@nestjs/mongoose'
import * as dayjs from 'dayjs'
import 'dayjs/plugin/timezone'
import 'dayjs/plugin/utc'
import * as Discord from 'discord.js'
import { EmbedBuilder } from 'discord.js'
import { Model } from 'mongoose'
import { DBNAME } from 'src/constructor'
import { LogEntry } from './log-entry.schema'
import { DiscordConfigService } from '../discord-config/discord-config.service'
import { checkDevice } from '../discord/components/devices/get-device'
import { LogLeave } from '../log-leave/log-leave.schema'
import { RedisService } from '../redis/redis.service'
import { UserTotalTimeService } from '../user-total-time/user-total-tiem.service'
import { Color } from '../discord/components/utils/color.utils'

@Injectable()
export class LogEntryService {
  private readonly client: Discord.Client
  @InjectModel(LogEntry.name, DBNAME)
  private readonly logEntryModel: Model<LogEntry>
  @InjectModel(LogLeave.name, DBNAME)
  private readonly logLeaveModel: Model<LogLeave>
  private readonly logger = new Logger(LogEntryService.name)
  constructor(
    private readonly discordConfigService: DiscordConfigService,
    private readonly userTotalTimeService: UserTotalTimeService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.client = new Discord.Client({
      intents: [
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.GuildMembers,
        Discord.GatewayIntentBits.DirectMessages,
        Discord.GatewayIntentBits.MessageContent,
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildVoiceStates,
        Discord.GatewayIntentBits.GuildPresences,
      ],
      partials: [
        Discord.Partials.Message,
        Discord.Partials.Channel,
        Discord.Partials.GuildMember,
        Discord.Partials.User,
        Discord.Partials.GuildScheduledEvent,
        Discord.Partials.ThreadMember,
      ],
    })

    const botToken = this.configService.get<string>('BOTTOKEN')
    this.client.login(botToken)
  }

  async logEntry(newState, entry) {
    try {
      if (this.client.users.cache.get(entry.userId)?.bot) {
        return
      }
      const discordServerId =
        await this.discordConfigService.findGuildIdByServerId(newState.guild.id)
      const discordConfig = await this.discordConfigService
        .getModel()
        .findOne({ discordServerId })
      const voiceChannelId = discordConfig.channelId[0]?.voiceChannel
      const channelEnterId = discordConfig.channelId[0]?.channelEnter
      const devices = checkDevice(newState, voiceChannelId)
      const timestamp = dayjs(entry.timestamp)
      const logEntry = new this.logEntryModel({
        ...entry,
        timestamp: timestamp.tz('Asia/Bangkok').toDate(),
        serverName: newState.guild.name,
        devicesType: devices,
      })

      await logEntry.save()

      const message = `User ${entry.username} joined the voice channel at ${logEntry.timestamp} on server ${newState.guild.name} using ${devices}`
      this.sendLogMessage(discordServerId, message, 'channelEnter')

      await this.redisService.addUserJoinTime(
        entry.userId,
        JSON.stringify({
          joinTime: entry.timestamp,
        }),
      )
    } catch (error) {
      this.logger.error('Error logging entry:', error.message)
    }
  }

  async logLeave(oldState, entry) {
    try {
      if (this.client.users.cache.get(entry.userId)?.bot) {
        return
      }
      const discordServerId =
        await this.discordConfigService.findGuildIdByServerId(oldState.guild.id)
      const discordConfig = await this.discordConfigService
        .getModel()
        .findOne({ discordServerId })
      const channelLeavelId = discordConfig.channelId[0]?.channelLeave

      const logLeave = new this.logLeaveModel({
        ...entry,
        timestamp: dayjs(entry.timestamp).tz('Asia/Bangkok').toDate(),
        serverName: oldState.guild.name,
      })

      await logLeave.save()

      const message = `User ${entry.username} left the voice channel at ${logLeave.timestamp} on server ${oldState.guild.name}`
      this.sendLogMessage(discordServerId, message, 'channelLeave')

      this.handleUserTotalTime(oldState, entry)
      this.redisService.userTimeMap.del(entry.userId)
    } catch (error) {
      this.logger.error('Error logging leave entry:', error.message)
    }
  }

  async getLogEntryDevicesType(userId: string): Promise<string> {
    try {
      const latestLogEntry = await this.logEntryModel
        .findOne({ userId })
        .sort({ timestamp: -1 })
      return latestLogEntry?.devicesType || ''
    } catch (error) {
      this.logger.error('Error getting LogEntry devicesType:', error.message)
      return ''
    }
  }

  async sendTotalTimeMessage(oldState, entry) {
    if (this.client.users.cache.get(entry.userId)?.bot) {
      return
    }
    try {
      const discordServerId =
        await this.discordConfigService.findGuildIdByServerId(oldState.guild.id)
      const discordConfig = await this.discordConfigService
        .getModel()
        .findOne({ discordServerId })
      const voiceChannelId = discordConfig.channelId[0]?.channelTotaltime

      if (voiceChannelId) {
        if (this.client.users.cache.get(entry.userId)?.bot) {
          return
        }

        const totalTimeInMinutesString: string | null =
          await this.redisService.totalTimes.get(entry.userId)
        const totalTimeInMinutes: number | null = totalTimeInMinutesString
          ? parseInt(totalTimeInMinutesString, 10)
          : null
        if (
          voiceChannelId &&
          !this.client.users.cache.get(entry.userId)?.bot &&
          !isNaN(totalTimeInMinutes) &&
          totalTimeInMinutes !== null &&
          totalTimeInMinutes !== undefined
        ) {
          const totalMinutes = parseFloat(totalTimeInMinutesString)
          const hours = Math.floor(totalMinutes / 60)
          const minutes = Math.floor(totalMinutes % 60)
          const seconds = Math.round((totalMinutes % 1) * 60)

          const totalChannel = oldState.guild.channels.cache.get(
            voiceChannelId,
          ) as Discord.TextChannel
          if (totalChannel) {
            if (totalChannel) {
              const embedMessage = new EmbedBuilder()
                .setColor(Color.hexColor.Green)
                .setTitle(`Total Time User ${entry.username}`)
                .setDescription(
                  `spent a total of ${hours} hours, ${minutes} minutes, ${seconds} seconds in the voice channel.`,
                )

              totalChannel.send({ embeds: [embedMessage] })
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Error in sendTotalTimeMessage:', error.message)
    }
  }

  async handleUserTotalTime(oldState, entry) {
    try {
      if (this.redisService.userTimeMap.exists(entry.userId)) {
        const joinTime = dayjs(
          await this.redisService.getUserJoinTime(entry.userId),
        )
        const leaveTime = dayjs(entry.timestamp)
        const duration = dayjs.duration(leaveTime.diff(joinTime))
        const devicesType = await this.getLogEntryDevicesType(entry.userId)
        const totalTime = duration.asMinutes()
        await this.redisService.totalTimes.set(entry.userId, totalTime)

        await this.userTotalTimeService.saveTotalTime(
          entry.userId,
          entry.username,
          totalTime,
          oldState.guild.name,
          oldState.guild.id,
          {
            devicesType,
            joinTime: entry.timestamp,
          },
        )

        this.sendTotalTimeMessage(oldState, entry)
      }
    } catch (error) {
      this.logger.error('Error handling user total time:', error.message)
    }
  }

  async sendLogMessage(
    discordServerId: string,
    message: string,
    channelType: 'channelEnter' | 'channelLeave',
  ) {
    try {
      const discordConfig = await this.discordConfigService
        .getModel()
        .findOne({ discordServerId })
      const channelId = discordConfig.channelId[0][channelType]

      const channel = this.client.guilds.cache
        .get(discordServerId)
        .channels.cache.get(channelId) as Discord.TextChannel

      if (channel) {
        let color: Discord.ColorResolvable
        if (channelType === 'channelEnter') {
          color = Color.hexColor.Green
        } else {
          color = Color.hexColor.Red
        }

        const embedMessage = new EmbedBuilder()
          .setColor(color)
          .setTitle(
            `${channelType === 'channelEnter' ? 'User Joined' : 'User Left'}`,
          )
          .setDescription(message)

        channel.send({ embeds: [embedMessage] })
      }
    } catch (error) {
      this.logger.error('Error sending log message:', error.message)
    }
  }
}
