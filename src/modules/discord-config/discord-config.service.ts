import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectModel } from '@nestjs/mongoose'
import * as Discord from 'discord.js'
import { Model } from 'mongoose'
import { DBNAME } from 'src/constructor'
import { DiscordConfig } from './discord-config.schema'

@Injectable()
export class DiscordConfigService {
  private readonly client: Discord.Client
  @InjectModel(DiscordConfig.name, DBNAME)
  private readonly discordConfigModel: Model<DiscordConfig>
  private botToken = this.configService.get<string>('BOTTOKEN')
  constructor(private readonly configService: ConfigService) {
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

    this.client.on('guildCreate', async (guild) => {
      const guildId = guild.id
      const newState = { guild: guild }
      this.handleGuildJoin(guildId, newState)
    })

    this.client.login(this.botToken)
  }

  getModel(): Model<DiscordConfig> {
    return this.discordConfigModel
  }

  async findGuildIdByServerId(discordServerId: string): Promise<string | null> {
    const config = await this.discordConfigModel.findOne({ discordServerId })
    return config ? config.discordServerId : null
  }

  async findserverSetting(
    discordServerId: string,
  ): Promise<DiscordConfig | null> {
    const setting = await this.discordConfigModel.findOne({ discordServerId })
    return setting ? setting : null
  }

  public async handleGuildJoin(guildId: string, newState) {
    try {
      const serverName = newState.guild.name

      const existingConfig = await this.discordConfigModel.findOne({
        discordServerId: guildId,
      })

      if (!existingConfig) {
        const newConfig = new this.discordConfigModel({
          discordServerId: guildId,
          discordServerName: serverName,
          channelId: [
            {
              voiceChannel: 'none',
              channelEnter: 'none',
              channelLeave: 'none',
              channelTotaltime: 'none',
              channelCronTotaltime: 'none',
              channelSendChart: 'none',
            },
          ],
        })

        await newConfig.save()
      } else {
        if (existingConfig.channelId.length === 0) {
          existingConfig.channelId.push({
            voiceChannel: 'none',
            channelEnter: 'none',
            channelLeave: 'none',
            channelTotaltime: 'none',
            channelCronTotaltime: 'none',
            channelSendChart: 'none',
          })
          await existingConfig.save()
        }

        existingConfig.discordServerId = guildId
      }
    } catch (error) {
      console.error('Error handling guild join:', error)
    }
  }

  async getChannelInfo(interaction, serverSetting): Promise<any> {
    const voiceChannelId = serverSetting.channelId[0]?.voiceChannel
    const voiceChannel =
      voiceChannelId !== 'none'
        ? await interaction.guild.channels.fetch(voiceChannelId)
        : null
    const voiceChannelName = voiceChannel ? voiceChannel.name : 'Not available'

    const channelEnterId = serverSetting.channelId[0]?.channelEnter
    const channelEnter =
      channelEnterId !== 'none'
        ? await interaction.guild.channels.fetch(channelEnterId)
        : null
    const channelEnterName = channelEnter ? channelEnter.name : 'Not available'

    const channelLeaveId = serverSetting.channelId[0]?.channelLeave
    const channelLeave =
      channelLeaveId !== 'none'
        ? await interaction.guild.channels.fetch(channelLeaveId)
        : null
    const channelLeaveName = channelLeave ? channelLeave.name : 'Not available'

    const channelTotaltimeId = serverSetting.channelId[0]?.channelTotaltime
    const channelTotaltime =
      channelTotaltimeId !== 'none'
        ? await interaction.guild.channels.fetch(channelTotaltimeId)
        : null
    const channelTotaltimeName = channelTotaltime
      ? channelTotaltime.name
      : 'Not available'

    const channelCronTotaltimeId =
      serverSetting.channelId[0]?.channelCronTotaltime
    const channelCronTotaltime =
      channelCronTotaltimeId !== 'none'
        ? await interaction.guild.channels.fetch(channelCronTotaltimeId)
        : null
    const channelCronTotaltimeName = channelCronTotaltime
      ? channelCronTotaltime.name
      : 'Not available'

    const channelSendChartId = serverSetting.channelId[0]?.channelSendChart
    const channelSendChart =
      channelSendChartId !== 'none'
        ? await interaction.guild.channels.fetch(channelSendChartId)
        : null
    const channelSendChartName = channelSendChart
      ? channelSendChart.name
      : 'Not available'

    return {
      voiceChannelName,
      channelEnterName,
      channelLeaveName,
      channelTotaltimeName,
      channelCronTotaltimeName,
      channelSendChartName,
    }
  }
}
