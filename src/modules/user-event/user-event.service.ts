import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectModel } from '@nestjs/mongoose'
import * as dayjs from 'dayjs'
import * as duration from 'dayjs/plugin/duration'
import 'dayjs/plugin/timezone'
import 'dayjs/plugin/utc'
import * as Discord from 'discord.js'
import { Model } from 'mongoose'
import { DBNAME } from 'src/constructor'
import { VoiceEvent } from './user-event.schema'
import { DiscordConfigService } from '../discord-config/discord-config.service'

dayjs.extend(duration)
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/utc'))

@Injectable()
export class UserEventService {
  @InjectModel(VoiceEvent.name, DBNAME)
  private readonly voiceEventModel: Model<VoiceEvent>
  private readonly logger = new Logger(UserEventService.name)
  private readonly client: Discord.Client
  constructor(
    private readonly discordConfigService: DiscordConfigService,
    private readonly configService: ConfigService,
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
  }

  getModel(): Model<VoiceEvent> {
    return this.voiceEventModel
  }

  async logUserEvent(userId: string, username: string, event: string) {
    try {
      if (this.client.users.cache.get(userId)?.bot) {
        return
      }

      const timestamp = dayjs().tz('Asia/Bangkok').toDate()
      const today = dayjs().tz('Asia/Bangkok').startOf('day').toDate()

      const voiceEvent = await this.voiceEventModel.findOneAndUpdate(
        { userId, username, 'events.timestamp': { $gte: today } },
        {
          $addToSet: {
            events: {
              $each: [
                {
                  event,
                  timestamp,
                },
              ],
            },
          },
        },
        { upsert: true, new: true },
      )
      this.logger.log(`User ${username} ${event} at ${timestamp}`)
    } catch (error) {
      this.logger.error('Error logging user event:', error.message)
    }
  }

  async handleVoiceEvents(newState, oldState) {
    const discordServerId =
      await this.discordConfigService.findGuildIdByServerId(oldState.guild.id)
    if (!discordServerId) {
      this.logger.error(`Discord Server ID not found: ${oldState.guild.id}`)
      return
    }

    const discordConfig = await this.discordConfigService
      .getModel()
      .findOne({ discordServerId })

    if (!discordConfig) {
      this.logger.error(`DiscordConfig not found for server ID: ${discordServerId}`)
      return
    }

    const voiceChannelId = discordConfig.channelId[0]?.voiceChannel

    if (
      oldState.selfDeaf !== newState.selfDeaf &&
      newState.channelId === voiceChannelId
    ) {
      await this.logUserEvent(
        newState.member.id,
        newState.member.user.username,
        newState.selfDeaf ? 'Deaf' : 'Undeaf',
      )
    }

    if (
      oldState.selfMute !== newState.selfMute &&
      newState.channelId === voiceChannelId
    ) {
      await this.logUserEvent(
        newState.member.id,
        newState.member.user.username,
        newState.selfMute ? 'Mute' : 'Unmute',
      )
    }

    if (
      oldState.streaming !== newState.streaming &&
      newState.channelId === voiceChannelId
    ) {
      await this.logUserEvent(
        newState.member.id,
        newState.member.user.username,
        newState.streaming ? 'Start Streaming' : 'Stop Streaming',
      )
    }

    if (
      oldState.selfVideo !== newState.selfVideo &&
      newState.channelId === voiceChannelId
    ) {
      await this.logUserEvent(
        newState.member.id,
        newState.member.user.username,
        newState.selfVideo ? 'Start Sharing Video' : 'Stop Sharing Video',
      )
    }

    if (
      oldState.deaf !== newState.deaf &&
      newState.channelId === voiceChannelId
    ) {
      await this.logUserEvent(
        newState.member.id,
        newState.member.user.username,
        newState.deaf ? 'Server Deaf' : 'Server Undeaf',
      )
    }
  }
}
