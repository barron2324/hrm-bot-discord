import { EmbedBuilder } from '@discordjs/builders'
import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  getVoiceConnection,
  VoiceConnection,
} from '@discordjs/voice'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as dayjs from 'dayjs'
import * as duration from 'dayjs/plugin/duration'
import 'dayjs/plugin/timezone'
import 'dayjs/plugin/utc'
import { GuildChannel, REST, Routes } from 'discord.js'
import * as Discord from 'discord.js'
import { GuildMember } from 'discord.js'

import { ChartService } from '../chart/chart.service'
import { DiscordConfigService } from '../discord-config/discord-config.service'
import { LogEntryService } from '../log-entry/log-entry.service'
import { RedisService } from '../redis/redis.service'
import { UserEventService } from '../user-event/user-event.service'
import { UserTotalTimeService } from '../user-total-time/user-total-tiem.service'
import { Color } from './components/utils/color.utils'

dayjs.extend(duration)
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/utc'))

@Injectable()
export class DiscordService {
  private readonly client: Discord.Client
  private rest: REST
  private voiceConnection: VoiceConnection | null = null
  private speakingStartTime: Date | null = null
  private clientBotId = this.configService.get<string>('CLIENTBOTID')
  private botToken = this.configService.get<string>('BOTTOKEN')
  private logger = new Logger(DiscordService.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly discordConfigService: DiscordConfigService,
    private readonly logEntryService: LogEntryService,
    private readonly userEventService: UserEventService,
    private readonly userTotalTimeService: UserTotalTimeService,
    private readonly redisService: RedisService,
    private readonly chartService: ChartService,
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

    this.client.once('ready', (client) => {
      this.logger.debug('Bot ' + client.user.tag + ' is now online!')
      this.rest = new REST({ version: '10' }).setToken(this.botToken)
      this.registerCommands()
    })

    this.client.on('interactionCreate', (interaction) => {
      if (!interaction.isCommand()) return
      this.handleCommand(interaction)
    })

    this.setupEventHandlers()
    this.client.login(this.botToken)
  }

  private async registerCommands() {
    const commands = [
      {
        name: 'help',
        description: 'Get help from the bot',
      },
      {
        name: 'set-voicechannel',
        description: 'Set your voice channel',
        type: 1,
        options: [
          {
            name: 'select',
            description: 'Select a voice channel',
            type: 1,
            options: [
              {
                name: 'voice-channel',
                description: 'Select a voice channel',
                type: 7,
                required: true,
                channelTypes: [2],
              },
            ],
          },
        ],
      },
      {
        name: 'set-channelenter',
        description: 'Set your text channel',
        type: 1,
        options: [
          {
            name: 'select',
            description: 'Select a text channel',
            type: 1,
            options: [
              {
                name: 'channel-enter',
                description: 'Select a text channel',
                type: 7,
                required: true,
              },
            ],
          },
        ],
      },
      {
        name: 'set-channelleave',
        description: 'Set your text channel',
        type: 1,
        options: [
          {
            name: 'select',
            description: 'Select a text channel',
            type: 1,
            options: [
              {
                name: 'channel-leave',
                description: 'Select a text channel',
                type: 7,
                required: true,
              },
            ],
          },
        ],
      },
      {
        name: 'set-channeltotaltime',
        description: 'Set your text channel',
        type: 1,
        options: [
          {
            name: 'select',
            description: 'Select a text channel',
            type: 1,
            options: [
              {
                name: 'channel-totaltime',
                description: 'Select a text channel',
                type: 7,
                required: true,
              },
            ],
          },
        ],
      },
      {
        name: 'set-cronjobuser',
        description: 'Set your text channel',
        type: 1,
        options: [
          {
            name: 'select',
            description: 'Select a text channel',
            type: 1,
            options: [
              {
                name: 'channel-cronjobuser',
                description: 'Select a text channel',
                type: 7,
                required: true,
              },
            ],
          },
        ],
      },
      {
        name: 'set-chart',
        description: 'Set your text channel',
        type: 1,
        options: [
          {
            name: 'select',
            description: 'Select a text channel',
            type: 1,
            options: [
              {
                name: 'channel-sendchart',
                description: 'Select a text channel',
                type: 7,
                required: true,
              },
            ],
          },
        ],
      },
      {
        name: 'set',
        description: 'Set configurations',
        type: 1,
        options: [
          {
            name: 'reset',
            description: 'Reset configurations',
            type: 1,
            options: [
              {
                name: 'option',
                description: 'Specify the reset option',
                type: 3,
                required: true,
                choices: [{ name: 'to_default', value: 'to_default' }],
              },
            ],
          },
        ],
      },
      {
        name: 'check',
        description: 'Check total time of a user',
        type: 1,
        options: [
          {
            name: 'time',
            description: 'Check total time of a user',
            type: 1,
            options: [
              {
                name: 'option',
                description: 'Check total time of a user',
                type: 3,
                required: true,
                choices: [{ name: 'user', value: 'user' }],
              },
            ],
          },
        ],
      },
      {
        name: 'server',
        description: 'Check server settings',
        type: 1,
        options: [
          {
            name: 'setting',
            description: 'Check server settings',
            type: 1,
            options: [
              {
                name: 'option',
                description: 'Check server settings',
                type: 3,
                required: true,
                choices: [{ name: 'info', value: 'info' }],
              },
            ],
          },
        ],
      },
      {
        name: 'create-role',
        description: 'Create role for user in server',
        type: 1,
        options: [
          {
            name: 'role',
            description: 'Create role for user in server',
            type: 1,
            options: [
              {
                name: 'option',
                description: 'Create role for user',
                type: 3,
                required: true,
                choices: [{ name: 'user', value: 'user' }],
              },
            ],
          },
        ],
      },
      {
        name: 'add-role',
        description: 'Add role for user in server',
        type: 1,
        options: [
          {
            name: 'role',
            description: 'Add role for user in server',
            type: 1,
            options: [
              {
                name: 'option',
                description: 'Add role for user',
                type: 3,
                required: true,
                choices: [
                  { name: 'all-user-in-server', value: 'all-user-in-server' },
                  { name: 'select-user', value: 'select-user' },
                ],
              },
              {
                name: 'target-role',
                description: 'Select the role in this server',
                type: 8,
                required: true,
              },
              {
                name: 'target-user',
                description: 'Select the user in this server',
                type: 6,
                required: false,
              },
            ],
          },
        ],
      },
      {
        name: 'sentchart',
        description: 'Send chart users for this server',
        type: 1,
        options: [
          {
            name: 'users',
            description: 'Send chart users for this server',
            type: 1,
          },
        ],
      },
    ]

    try {
      this.client.on('messageCreate', async (message) => {
        const interaction = message

        const discordServerId = interaction?.guildId

        if (discordServerId) {
          const foundServerId =
            await this.discordConfigService.findGuildIdByServerId(
              discordServerId,
            )

          if (foundServerId) {
            await this.rest.put(
              Routes.applicationGuildCommands(this.clientBotId, foundServerId),
              { body: commands },
            )
          } else {
            this.logger.error(`Discord Server ID not found: ${discordServerId}`)
          }
        }
      })
    } catch (error) {
      this.logger.error(error)
    }
  }

  private async handleCommand(interaction) {
    const command = interaction.commandName

    if (command === 'help') {
      try {
        const embedMessage = {
          color: Color.hexadecimalColor.Orange,
          title: 'Help Command',
          fields: [
            {
              name: 'set-voicechannel',
              value: '```\nSet your voice channel\n```',
            },
            {
              name: 'set-channelenter',
              value: '```\nSet your text channel for enter events\n```',
            },
            {
              name: 'set-channelleave',
              value: '```\nSet your text channel for leave events\n```',
            },
            {
              name: 'set-channeltotaltime',
              value: '```\nSet your text channel for total time events\n```',
            },
            {
              name: 'set-ronjobuser',
              value: '```\nSet your text channel for cron job events\n```',
            },
            {
              name: 'reset',
              value: '```\nReset all channels to default values\n```',
            },
            {
              name: 'check time',
              value:
                '```\nCheck user total time (for user using this command)\n```',
            },
            {
              name: 'server setting',
              value:
                '```\nVerify the configuration of this server settings (for role administrator)\n```',
            },
            {
              name: 'create-role user',
              value:
                '```\nCreate role for user in discord server (for role administrator)\n```',
            },
            {
              name: 'add-role all-user-in-server target-role',
              value:
                '```\nAdded roles for all users in discord server (for role administrator)\n```',
            },
            {
              name: 'add-role select-user target-role target-user',
              value:
                '```\nAdded role for select user in discord server. (for role administrator)\n```',
            },
          ],
          timestamp: new Date(),
          footer: {
            text: `${this.client.user.tag}`,
          },
        }
        await interaction.reply({ embeds: [embedMessage], ephemeral: true })
      } catch (error) {
        this.logger.error('Error replying to interaction:', error)
      }
    } else if (command === 'set-voicechannel') {
      const subCommand = interaction.options.getSubcommand()
      const voiceChannelOption = interaction.options.getChannel(
        'voice-channel',
      ) as GuildChannel
      if (subCommand === 'select') {
        const embedMessage = {
          color: Color.hexadecimalColor.GreenLemon,
          title: 'Set Up Voice Chat',
          description:
            'Set up the sound room with the /set-voicechannel command.',
          fields: [
            {
              name: 'ชื่อ Channel',
              value: `${voiceChannelOption.name}`,
            },
          ],
        }
        await interaction.reply({ embeds: [embedMessage], ephemeral: true })

        const discordServerId = interaction.guildId
        const foundServerId =
          await this.discordConfigService.findGuildIdByServerId(discordServerId)

        if (foundServerId) {
          await this.discordConfigService.getModel().findOneAndUpdate(
            { discordServerId: foundServerId },
            {
              $set: {
                'channelId.$[elem].voiceChannel': voiceChannelOption.id,
              },
            },
            {
              arrayFilters: [{ 'elem.voiceChannel': { $exists: true } }],
              new: true,
            },
          )
        } else {
          this.logger.error(`Discord Server ID not found: ${discordServerId}`)
        }
      }
    } else if (command === 'set-channelenter') {
      const subCommand = interaction.options.getSubcommand()
      const voiceChannelOption = interaction.options.getChannel(
        'channel-enter',
      ) as GuildChannel
      if (subCommand === 'select') {
        const embedMessage = {
          color: Color.hexadecimalColor.GreenLemon,
          title: 'Set Up Text Chat',
          description:
            'Set up the sound room with the /set-channelenter command.',
          fields: [
            {
              name: 'ชื่อ Channel',
              value: `${voiceChannelOption.name}`,
            },
          ],
        }
        await interaction.reply({ embeds: [embedMessage], ephemeral: true })

        const discordServerId = interaction.guildId
        const foundServerId =
          await this.discordConfigService.findGuildIdByServerId(discordServerId)

        if (foundServerId) {
          await this.discordConfigService.getModel().findOneAndUpdate(
            { discordServerId: foundServerId },
            {
              $set: {
                'channelId.$[elem].channelEnter': voiceChannelOption.id,
              },
            },
            {
              arrayFilters: [{ 'elem.channelEnter': { $exists: true } }],
              new: true,
            },
          )
        } else {
          this.logger.error(`Discord Server ID not found: ${discordServerId}`)
        }
      }
    } else if (command === 'set-channelleave') {
      const subCommand = interaction.options.getSubcommand()
      const voiceChannelOption = interaction.options.getChannel(
        'channel-leave',
      ) as GuildChannel
      if (subCommand === 'select') {
        const embedMessage = {
          color: Color.hexadecimalColor.GreenLemon,
          title: 'Set Up Text Chat',
          description:
            'Set up the sound room with the /set-channelleave command.',
          fields: [
            {
              name: 'ชื่อ Channel',
              value: `${voiceChannelOption.name}`,
            },
          ],
        }
        await interaction.reply({ embeds: [embedMessage], ephemeral: true })

        const discordServerId = interaction.guildId
        const foundServerId =
          await this.discordConfigService.findGuildIdByServerId(discordServerId)

        if (foundServerId) {
          await this.discordConfigService.getModel().findOneAndUpdate(
            { discordServerId: foundServerId },
            {
              $set: {
                'channelId.$[elem].channelLeave': voiceChannelOption.id,
              },
            },
            {
              arrayFilters: [{ 'elem.channelLeave': { $exists: true } }],
              new: true,
            },
          )
        } else {
          this.logger.error(`Discord Server ID not found: ${discordServerId}`)
        }
      }
    } else if (command === 'set-channeltotaltime') {
      const subCommand = interaction.options.getSubcommand()
      const voiceChannelOption = interaction.options.getChannel(
        'channel-totaltime',
      ) as GuildChannel
      if (subCommand === 'select') {
        const embedMessage = {
          color: Color.hexadecimalColor.GreenLemon,
          title: 'Set Up Text Chat',
          description:
            'Set up the sound room with the /set-channeltotaltime command.',
          fields: [
            {
              name: 'ชื่อ Channel',
              value: `${voiceChannelOption.name}`,
            },
          ],
        }
        await interaction.reply({ embeds: [embedMessage], ephemeral: true })

        const discordServerId = interaction.guildId
        const foundServerId =
          await this.discordConfigService.findGuildIdByServerId(discordServerId)

        if (foundServerId) {
          await this.discordConfigService.getModel().findOneAndUpdate(
            { discordServerId: foundServerId },
            {
              $set: {
                'channelId.$[elem].channelTotaltime': voiceChannelOption.id,
              },
            },
            {
              arrayFilters: [{ 'elem.channelTotaltime': { $exists: true } }],
              new: true,
            },
          )
        } else {
          this.logger.error(`Discord Server ID not found: ${discordServerId}`)
        }
      }
    } else if (command === 'set-cronjobuser') {
      const subCommand = interaction.options.getSubcommand()
      const voiceChannelOption = interaction.options.getChannel(
        'channel-cronjobuser',
      ) as GuildChannel
      if (subCommand === 'select') {
        const embedMessage = {
          color: Color.hexadecimalColor.GreenLemon,
          title: 'Set Up Text Chat',
          description:
            'Set up the sound room with the /set-cronjobuser command.',
          fields: [
            {
              name: 'ชื่อ Channel',
              value: `${voiceChannelOption.name}`,
            },
          ],
        }
        await interaction.reply({ embeds: [embedMessage], ephemeral: true })
        const discordServerId = interaction.guildId
        const foundServerId =
          await this.discordConfigService.findGuildIdByServerId(discordServerId)

        if (foundServerId) {
          await this.discordConfigService.getModel().findOneAndUpdate(
            { discordServerId: foundServerId },
            {
              $set: {
                'channelId.$[elem].channelCronTotaltime': voiceChannelOption.id,
              },
            },
            {
              arrayFilters: [
                { 'elem.channelCronTotaltime': { $exists: true } },
              ],
              new: true,
            },
          )
        } else {
          this.logger.error(`Discord Server ID not found: ${discordServerId}`)
        }
      }
    } else if (command === 'set-chart') {
      const subCommand = interaction.options.getSubcommand()
      const voiceChannelOption = interaction.options.getChannel(
        'channel-sendchart',
      ) as GuildChannel
      if (subCommand === 'select') {
        const embedMessage = {
          color: Color.hexadecimalColor.GreenLemon,
          title: 'Set Up Text Chat',
          description: 'Set up the sound room with the /set-chart command.',
          fields: [
            {
              name: 'ชื่อ Channel',
              value: `${voiceChannelOption.name}`,
            },
          ],
        }
        await interaction.reply({ embeds: [embedMessage], ephemeral: true })
        const discordServerId = interaction.guildId
        const foundServerId =
          await this.discordConfigService.findGuildIdByServerId(discordServerId)

        if (foundServerId) {
          await this.discordConfigService.getModel().findOneAndUpdate(
            { discordServerId: foundServerId },
            {
              $set: {
                'channelId.$[elem].channelSendChart': voiceChannelOption.id,
              },
            },
            {
              arrayFilters: [{ 'elem.channelSendChart': { $exists: true } }],
              new: true,
            },
          )
        } else {
          this.logger.error(`Discord Server ID not found: ${discordServerId}`)
        }
      }
    } else if (command === 'set') {
      const subCommand = interaction.options.getSubcommand()

      if (
        subCommand === 'reset' &&
        interaction.options.getString('option') === 'to_default'
      ) {
        try {
          const discordServerId = interaction.guildId
          const foundServerId =
            await this.discordConfigService.findGuildIdByServerId(
              discordServerId,
            )

          if (foundServerId) {
            await this.discordConfigService.getModel().findOneAndUpdate(
              { discordServerId: foundServerId },
              {
                $set: {
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
                },
              },
              { new: true },
            )
            const embedMessage = {
              color: Color.hexadecimalColor.GreenLemon,
              fields: [
                { name: 'Reset Success', value: 'ChannelId reset to default.' },
              ],
            }

            await interaction.reply({ embeds: [embedMessage], ephemeral: true })
          } else {
            this.logger.error(`Discord Server ID not found: ${discordServerId}`)
          }
        } catch (error) {
          this.logger.error('Error resetting channelId:', error.message)
          await interaction.reply(
            'Error resetting channelId. Please try again.',
          )
        }
      }
    } else if (command === 'check') {
      const subCommand = interaction.options.getSubcommand()

      if (
        subCommand === 'time' &&
        interaction.options.getString('option') === 'user'
      ) {
        const today = dayjs().tz('Asia/Bangkok').startOf('day').toDate()
        const discordServerId = interaction.guildId
        const userId = interaction.user.id
        let userTotalTime
        userTotalTime = await this.userTotalTimeService
          .getModel()
          .findOne({
            discordId: userId,
            discordServerId: discordServerId,
            createdAt: { $gte: today },
          })
          .exec()

        if (!userTotalTime) {
          userTotalTime = await this.userTotalTimeService
            .getModelCronUserTotalTime()
            .findOne({
              discordId: userId,
              discordServerId: discordServerId,
              createdAt: { $gte: today },
            })
            .exec()
        }

        if (!userTotalTime) {
          const embedMessage = {
            color: Color.hexadecimalColor.Red,
            fields: [
              {
                name: `User total time not found.`,
                value: '',
              },
            ],
          }
          await interaction.reply({ embeds: [embedMessage], ephemeral: true })
          return
        } else {
          const embedMessage = {
            color: Color.hexadecimalColor.Green,
            fields: [
              {
                name: `Send message success.`,
                value: '',
              },
            ],
          }
          await interaction.reply({ embeds: [embedMessage], ephemeral: true })
        }

        try {
          const {
            formattedDevicesInfo,
            formattedTotalTime,
            formattedSpeakingTime,
          } = this.userTotalTimeService.calculateTotalTime(userTotalTime, today)
          const embedMessage = {
            color: Color.hexadecimalColor.GreenLemon,
            fields: [
              {
                name: `Total time for **${userTotalTime.discordName}** From server **${userTotalTime.discordserverName}** on ${userTotalTime.createdAt}`,
                value: '',
              },
              {
                name: '**Total time**',
                value: `\`\`\`\n${formattedTotalTime}\n\`\`\``,
              },
              {
                name: '**Speak Time**',
                value: `\`\`\`\n${formattedSpeakingTime}\n\`\`\``,
              },
              {
                name: '**Device Method**',
                value: `\`\`\`\n${formattedDevicesInfo.join('\n')}\n\`\`\``,
              },
            ],
          }
          await interaction.user.send({ embeds: [embedMessage] })
        } catch (error) {
          this.logger.error('Error sending user total time:', error)
          await interaction.reply(
            'An error occurred while sending user total time.',
          )
        }
      } else {
        await interaction.reply('Invalid subcommand for /check')
      }
    } else if (command === 'server') {
      const subCommand = interaction.options.getSubcommand()
      if (
        subCommand === 'setting' &&
        interaction.options.getString('option') === 'info'
      ) {
        if (
          interaction.member.permissions.has(
            Discord.PermissionFlagsBits.Administrator,
          )
        ) {
          const discordServerId = interaction.guildId
          const serverSetting =
            await this.discordConfigService.findserverSetting(discordServerId)

          if (serverSetting) {
            const channelInfo = await this.discordConfigService.getChannelInfo(
              interaction,
              serverSetting,
            )

            const embedMessage = {
              color: Color.hexadecimalColor.GreenLemon,
              title: 'Server Setting Info',
              fields: [
                {
                  name: 'Discord Server Name',
                  value: `\`\`\`\n${serverSetting.discordServerName}\n\`\`\``,
                },
                {
                  name: 'Voice Channel',
                  value: `\`\`\`\nChannel name: ${channelInfo.voiceChannelName}\n\`\`\``,
                },
                {
                  name: 'Channel Enter',
                  value: `\`\`\`\nChannel name: ${channelInfo.channelEnterName}\n\`\`\``,
                },
                {
                  name: 'Channel Leave',
                  value: `\`\`\`\nChannel name: ${channelInfo.channelLeaveName}\n\`\`\``,
                },
                {
                  name: 'Channel Total Time',
                  value: `\`\`\`\nChannel name: ${channelInfo.channelTotaltimeName}\n\`\`\``,
                },
                {
                  name: 'Channel Cron job',
                  value: `\`\`\`\nChannel name: ${channelInfo.channelCronTotaltimeName}\n\`\`\``,
                },
                {
                  name: 'Channel Chart',
                  value: `\`\`\`\nChannel name: ${channelInfo.channelSendChartName}\n\`\`\``,
                },
              ],
            }

            await interaction.reply({ embeds: [embedMessage], ephemeral: true })
          } else {
            await interaction.reply('Server setting not found.')
          }
        } else {
          await interaction.reply(
            'You do not have the required permissions to use this command.',
          )
        }
      }
    } else if (command === 'create-role') {
      const subCommand = interaction.options.getSubcommand()
      if (
        subCommand === 'role' &&
        interaction.options.getString('option') === 'user'
      ) {
        if (
          interaction.member.permissions.has(
            Discord.PermissionFlagsBits.Administrator,
          )
        ) {
          try {
            const roleName = 'User'
            const role = await interaction.guild.roles.create({
              data: {
                role: `${roleName}`,
                color: [19, 141, 236],
              },
            })

            const permissions = [
              {
                id: role.id,
                allow: [
                  Discord.PermissionFlagsBits.ViewChannel,
                  Discord.PermissionFlagsBits.SendMessages,
                  Discord.PermissionFlagsBits.ReadMessageHistory,
                  Discord.PermissionFlagsBits.UseApplicationCommands,
                  Discord.PermissionFlagsBits.Connect,
                  Discord.PermissionFlagsBits.Speak,
                  Discord.PermissionFlagsBits.Stream,
                ],
              },
            ]

            await interaction.channel.permissionOverwrites.edit(
              role.id,
              permissions,
            )

            const embedMessage = {
              color: 0x138dec,
              title: 'Create role user for this server',
              fields: [
                {
                  name: `Role name: ${role.name}`,
                  value: 'created successfully with permissions!',
                },
              ],
            }

            await interaction.reply({ embeds: [embedMessage], ephemeral: true })
          } catch (error) {
            this.logger.error('Error creating role:', error)
            await interaction.reply(
              'An error occurred while creating the role.',
            )
          }
        } else {
          await interaction.reply(
            'You do not have the required permissions to use this command.',
          )
        }
      }
    } else if (command === 'add-role') {
      const subCommand = interaction.options.getSubcommand()

      if (subCommand === 'role') {
        const option = interaction.options.getString('option')

        if (
          interaction.member.permissions.has(
            Discord.PermissionFlagsBits.Administrator,
          )
        ) {
          try {
            if (option === 'all-user-in-server') {
              const targetRole = interaction.options.getRole('target-role')
              if (targetRole && !targetRole.botRole) {
                try {
                  const guild = interaction.guild
                  const members = await guild.members.fetch()
                  const nonBotMembers = members.filter(
                    (member: GuildMember) => !member.user.bot,
                  )
                  await Promise.all(
                    nonBotMembers.map((member: GuildMember) =>
                      member.roles.add(targetRole),
                    ),
                  )
                  const embedMessage = {
                    color: Color.hexadecimalColor.Green,
                    title: 'Add Role to All Users Successful!',
                    fields: [
                      {
                        name: `Role ${targetRole.name} added to all non-bot users in the server.`,
                        value: '',
                      },
                    ],
                  }

                  await interaction.reply({
                    embeds: [embedMessage],
                    ephemeral: true,
                  })
                } catch (error) {
                  this.logger.error('Error adding role to all users:', error)
                  await interaction.reply(
                    'An error occurred while adding the role to all users.',
                  )
                }
              } else {
                await interaction.reply(
                  'Invalid target role. Please select a valid role that is not a bot role.',
                )
              }
            } else if (option === 'select-user') {
              const targetRole = interaction.options.getRole('target-role')
              const targetUser = interaction.options.getUser('target-user')
              const guild = interaction.guild

              if (targetUser && guild) {
                try {
                  const targetMember = await guild.members.fetch(targetUser)
                  await targetMember.roles.add(targetRole)

                  const embedMessage = {
                    color: Color.hexadecimalColor.Green,
                    title: 'Add Role to Select User Successful!',
                    fields: [
                      {
                        name: `Role ${targetRole.name} added to ${targetUser.tag}.`,
                        value: '',
                      },
                    ],
                  }

                  await interaction.reply({
                    embeds: [embedMessage],
                    ephemeral: true,
                  })
                } catch (error) {
                  this.logger.error(
                    `Error adding role to ${targetUser.tag}:`,
                    error,
                  )
                  await interaction.reply(
                    `An error occurred while adding the role to ${targetUser.tag}.`,
                  )
                }
              } else {
                await interaction.reply(
                  'Invalid target role or user. Please select a valid role and user.',
                )
              }
            }
          } catch (error) {
            this.logger.error('Error Add role:', error)
          }
        }
      }
    } else if (command === 'sentchart') {
      if (!interaction || !interaction.inGuild()) {
        return
      }

      try {
        const { guildId } = interaction
        const dataFromMongo = await this.chartService.getDataForServer(guildId)

        if (dataFromMongo.length > 0) {
          const userData = dataFromMongo[0]
          const discordConfigService =
            await this.discordConfigService.findserverSetting(guildId)
          const channelSendChart =
            discordConfigService.channelId[0]?.channelSendChart
          const chartChannel = (await interaction.guild.channels.fetch(
            channelSendChart,
          )) as Discord.TextChannel

          if (channelSendChart) {
            const serverId = guildId
            const chartBuffer = await this.chartService.generateChartForServer(
              serverId,
            )
            const embedMessage = {
              color: Color.hexadecimalColor.GreenLemon,
              title: 'Chart Total Time',
              description: 'This is the chart showing total time.',
            }

            const embedMessageBuilder = {
              color: Color.hexadecimalColor.GreenLemon,
              title: `Send Chart Success!`,
              description: `\`\`\`\n Send to channel name ${chartChannel.name} \n\`\`\``,
            }
            await interaction.reply({
              embeds: [embedMessageBuilder],
              ephemeral: true,
            })
            await chartChannel.send({
              embeds: [embedMessage],
              files: [chartBuffer],
            })
          } else {
            await interaction.reply(
              'Invalid or non-text channel for sending charts',
              { ephemeral: true },
            )
          }
        } else {
          await interaction.reply('No user data found for this server', {
            ephemeral: true,
          })
        }
      } catch (error) {
        this.logger.error('Error during sentchart operation:', error)
        await interaction.reply('Error fetching data or generating chart', {
          ephemeral: true,
        })
      }
    }
  }
  private async setupEventHandlers() {
    const intervalId: NodeJS.Timeout | null = null
    this.client.on('voiceStateUpdate', async (oldState, newState) => {
      try {
        const guild = await newState.guild.members.fetch(
          newState.member.user.id,
        )
        const updatedState = {
          ...newState,
          member: guild,
        }

        const discordServerId =
          await this.discordConfigService.findGuildIdByServerId(
            newState.guild.id,
          )
        if (!discordServerId) {
          this.logger.error(`Discord Server ID not found: ${newState.guild.id}`)
          return
        }

        const discordConfig = await this.discordConfigService
          .getModel()
          .findOne({ discordServerId })
        if (!discordConfig) {
          this.logger.error(
            `DiscordConfig not found for server ID: ${discordServerId}`,
          )
          return
        }

        const voiceChannelId = discordConfig.channelId[0]?.voiceChannel

        if (!voiceChannelId) {
          this.logger.error(
            `VoiceChannel ID not found in DiscordConfig for server ID: ${discordServerId}`,
          )
          return
        }

        if (
          updatedState.channelId === voiceChannelId &&
          updatedState.guild.id === discordServerId
        ) {
          const isFirstUserInVoiceChannel =
            (
              updatedState.guild.channels.cache.get(
                updatedState.channelId,
              ) as Discord.VoiceChannel
            )?.members.size === 1

          if (
            !(await this.redisService.userTimeMap.exists(
              updatedState.member.id,
            ))
          ) {
            const entry = {
              username: updatedState.member.user.username,
              userId: updatedState.member.id,
              action: 'join',
              timestamp: dayjs().tz('Asia/Bangkok').format(),
            }

            await this.logEntryService.logEntry(updatedState, entry)
            await this.redisService.addUserJoinTime(
              updatedState.member.id,
              entry.timestamp,
            )

            await this.redisService.addSpeakingTime(updatedState.member.id, '1')
          }

          await this.userEventService.handleVoiceEvents(oldState, newState)

          if (isFirstUserInVoiceChannel) {
            const voiceChannel = updatedState.guild.channels.cache.get(
              voiceChannelId,
            ) as Discord.VoiceChannel
            let isSpeaking = false
            try {
              if (
                this.voiceConnection &&
                !this.voiceConnection.joinConfig.channelId
              ) {
                this.logger.log(`Bot has been destroyed. Stopping further actions.`)
                return
              }

              const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: true,
              })

              connection.on(VoiceConnectionStatus.Ready, async () => {
                this.logger.log(`Bot joined voice channel: ${voiceChannel.name}`)
                isSpeaking = false

                connection.receiver.speaking.on('start', async (userId) => {
                  isSpeaking = true

                  if (
                    this.voiceConnection &&
                    !this.voiceConnection.joinConfig.channelId
                  ) {
                    this.logger.log(
                      `Bot has been destroyed. Stopping further actions.`,
                    )
                    return
                  }
                  const user = await voiceChannel.guild.members.fetch(userId)
                  this.speakingStartTime = new Date()
                })

                connection.receiver.speaking.on('end', async (userId) => {
                  isSpeaking = false

                  const user = await voiceChannel.guild.members.fetch(userId)

                  if (this.speakingStartTime) {
                    const speakingEndTime = new Date()
                    const speakingDuration =
                      speakingEndTime.getTime() -
                      this.speakingStartTime.getTime()

                    const adjustedDuration =
                      speakingDuration < 1000 ? 1000 : speakingDuration

                    const totalSeconds = Math.floor(adjustedDuration / 1000)
                    const hours = Math.floor(totalSeconds / 3600)
                    const minutes = Math.floor((totalSeconds % 3600) / 60)
                    const seconds = totalSeconds % 60

                    const existingSpeakingTime =
                      await this.redisService.getSpeakingTime(userId)

                    let newTotalSeconds = totalSeconds

                    if (existingSpeakingTime) {
                      const existingSeconds = parseInt(existingSpeakingTime)
                      newTotalSeconds += existingSeconds
                    }

                    const newHours = Math.floor(newTotalSeconds / 3600)
                    const newMinutes = Math.floor((newTotalSeconds % 3600) / 60)
                    const newSeconds = newTotalSeconds % 60
                    await this.redisService.addSpeakingTime(
                      userId,
                      newTotalSeconds.toString(),
                    )
                  }

                  this.speakingStartTime = null
                })
              })
            } catch (error) {
              this.logger.error(
                `Error joining voice channel: ${voiceChannel.name}`,
                error,
              )
            }
          }
        } else if (oldState.channelId === voiceChannelId) {
          if (!newState.channelId || newState.channelId !== voiceChannelId) {
            const entry = {
              username: oldState.member.user.username,
              userId: oldState.member.id,
              action: 'leave',
              timestamp: dayjs().tz('Asia/Bangkok').format(),
            }
            await this.logEntryService.logLeave(oldState, entry)

            const voiceChannel = oldState.guild.channels.cache.get(
              voiceChannelId,
            ) as Discord.VoiceChannel
            const nonBotMembers = voiceChannel?.members.filter(
              (member) => !member.user.bot,
            )
            if (nonBotMembers.size === 0) {
              const connection = getVoiceConnection(voiceChannel.guild.id)
              if (connection) {
                setTimeout(async () => {
                  clearInterval(intervalId)
                  connection.destroy()
                  this.logger.log(
                    `Bot left voice channel due to no non-bot users: ${voiceChannel.name}`,
                  )
                }, 3000)
              }
            }
          }
        } else if (oldState.channelId === voiceChannelId) {
          if (!newState.channelId || newState.channelId !== voiceChannelId) {
            const entry = {
              username: oldState.member.user.username,
              userId: oldState.member.id,
              action: 'leave',
              timestamp: dayjs().tz('Asia/Bangkok').format(),
            }
            await this.logEntryService.logLeave(oldState, entry)
          }
        }
      } catch (error) {
        this.logger.error('Error handling voiceStateUpdate event:', error)
      }
    })
  }

  public async sendUserTotalTimeToAllChannels() {
    try {
      const configs = await this.discordConfigService.getModel().find()

      if (!configs || configs.length === 0) {
        this.logger.error('Error: No DiscordConfig found.')
        return
      }

      for (const config of configs) {
        const { discordServerId, channelId } = config

        if (!channelId) {
          this.logger.error(
            `Error: Missing channelId for server ${discordServerId}.`,
          )
          continue
        }

        for (const { channelCronTotaltime } of config.channelId) {
          const channel = this.client.channels.cache.get(
            channelCronTotaltime,
          ) as Discord.TextChannel

          if (!channel) {
            this.logger.error(
              `Error: Channel with ID ${channelCronTotaltime} not found.`,
            )
            continue
          }

          const today = dayjs().tz('Asia/Bangkok').startOf('day').toDate()

          for (const [userId, user] of this.client.users.cache) {
            await this.userTotalTimeService.sendTotalTimeToChannel(
              channel,
              userId,
              today,
              discordServerId,
            )
            await this.userTotalTimeService.saveCronUserTotalTime(
              userId,
              user.username,
              user.id,
              user.createdAt,
              today,
            )
          }
        }
      }
    } catch (error) {
      this.logger.error(
        'Error sending user total time to all channels:',
        error.message,
      )
    }
  }
}
