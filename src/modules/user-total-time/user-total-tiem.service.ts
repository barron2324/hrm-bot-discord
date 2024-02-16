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
import { UserTotalTime } from './user-total-tiem.schema'
import { CronUserTotalTime } from '../cron-total-time/cron-totol-time.schema'
import { DiscordConfigService } from '../discord-config/discord-config.service'
import { formatsPeakingTime } from '../discord/components/utils/format-speak-time'
import { formatTotalTime } from '../discord/components/utils/format-total-time'
import { RedisService } from '../redis/redis.service'
import { Color } from '../discord/components/utils/color.utils'

dayjs.extend(duration)
dayjs.extend(require('dayjs/plugin/timezone'))
dayjs.extend(require('dayjs/plugin/utc'))

@Injectable()
export class UserTotalTimeService {
  @InjectModel(UserTotalTime.name, DBNAME)
  private readonly userTotalTimeModel: Model<UserTotalTime>
  @InjectModel(CronUserTotalTime.name, DBNAME)
  private readonly cronUserTotalTimeModel: Model<CronUserTotalTime>
  private readonly client: Discord.Client
  private readonly logger = new Logger(UserTotalTimeService.name)
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly discordConfigService: DiscordConfigService,
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

  getModel(): Model<UserTotalTime> {
    return this.userTotalTimeModel
  }

  getModelCronUserTotalTime(): Model<CronUserTotalTime> {
    return this.cronUserTotalTimeModel
  }

  async saveTotalTime(
    userId: string,
    discordName: string,
    totalTime: number,
    discordserverName: string,
    discordServerId: string,
    totalTimeData,
  ) {
    try {
      if (this.client.users.cache.get(userId)?.bot) {
        return
      }

      const bangkokTime = dayjs().tz('Asia/Bangkok').format()
      const hours = Math.floor(totalTime / 60)
      const minutes = Math.floor(totalTime % 60)
      const seconds = Math.round((totalTime % 1) * 60)

      const existingSpeakingTime = await this.redisService.getSpeakingTime(
        userId,
      )

      let updatedSpeakingTime = []

      if (existingSpeakingTime) {
        const existingSeconds = parseInt(existingSpeakingTime)
        const totalSeconds = existingSeconds
        const updatedHours = Math.floor(totalSeconds / 3600)
        const updatedMinutes = Math.floor((totalSeconds % 3600) / 60)
        const updatedSeconds = totalSeconds % 60

        updatedSpeakingTime = [
          {
            hours: updatedHours.toString(),
            minutes: updatedMinutes.toString(),
            seconds: updatedSeconds.toString(),
          },
        ]
      }

      const existingRecord = await this.userTotalTimeModel.findOne({
        discordId: userId,
        discordServerId: discordServerId,
        createdAt: {
          $gte: dayjs(bangkokTime).startOf('day').toDate(),
          $lt: dayjs(bangkokTime).endOf('day').toDate(),
        },
      })

      if (existingRecord) {
        existingRecord.joinMethod = existingRecord.joinMethod || []
        existingRecord.joinMethod.unshift({
          devicesType: totalTimeData.devicesType,
          totalTime: {
            hours: hours.toString(),
            minutes: minutes.toString(),
            seconds: seconds.toString(),
          },
          joinTime: dayjs().tz('Asia/Bangkok').toDate(),
        })

        const calSpeakingTime =
          parseFloat(updatedSpeakingTime[0].hours) * 3600 +
          parseFloat(updatedSpeakingTime[0].minutes) * 60 +
          parseFloat(updatedSpeakingTime[0].seconds)

        const calHours = Math.floor(calSpeakingTime / 3600)
        const calMinutes = Math.floor((calSpeakingTime % 3600) / 60)
        const calSeconds = Math.floor(calSpeakingTime % 60)

        await this.userTotalTimeModel.findByIdAndUpdate(existingRecord._id, {
          $set: {
            discordServerId: discordServerId,
            joinMethod: existingRecord.joinMethod,
            sPeakingTime: [
              ...existingRecord.sPeakingTime,
              {
                hours: calHours.toString(),
                minutes: calMinutes.toString(),
                seconds: calSeconds.toString(),
              },
            ],
          },
        })
      } else {
        const calSpeakingTime =
          parseFloat(updatedSpeakingTime[0].hours) * 3600 +
          parseFloat(updatedSpeakingTime[0].minutes) * 60 +
          parseFloat(updatedSpeakingTime[0].seconds)

        const calHours = Math.floor(calSpeakingTime / 3600)
        const calMinutes = Math.floor((calSpeakingTime % 3600) / 60)
        const calSeconds = Math.floor(calSpeakingTime % 60)

        const totalTimeEntry = new this.userTotalTimeModel({
          discordName,
          discordId: userId,
          discordServerId: discordServerId,
          sPeakingTime: [
            {
              hours: calHours.toString(),
              minutes: calMinutes.toString(),
              seconds: calSeconds.toString(),
            },
          ],
          joinMethod: [
            {
              devicesType: totalTimeData.devicesType,
              totalTime: {
                hours: hours.toString(),
                minutes: minutes.toString(),
                seconds: seconds.toString(),
              },
              joinTime: dayjs().tz('Asia/Bangkok').toDate(),
            },
          ],
          createdAt: dayjs(bangkokTime).toDate(),
          discordserverName,
        })

        await totalTimeEntry.save()
      }
      await this.redisService.speakingTimes.del(userId)
    } catch (error) {
      this.logger.error('Error saving total time entry:', error.message)
    }
  }

  public calculateTotalTime(userTotalTime: UserTotalTime, today: Date) {
    const devicesInfo: Record<string, number[]> = {}
    const speakingInfo: Record<string, number[]> = {}
    let totalDayTime = 0
    let userSpeakingTime = 0

    for (const joinMethod of userTotalTime.joinMethod) {
      const joinTime = new Date(joinMethod.joinTime)
      if (joinTime.toDateString() === today.toDateString()) {
        totalDayTime += parseInt(joinMethod.totalTime.hours) * 3600
        totalDayTime += parseInt(joinMethod.totalTime.minutes) * 60
        totalDayTime += parseInt(joinMethod.totalTime.seconds)
        const totalTimeInSeconds =
          parseInt(joinMethod.totalTime.hours) * 3600 +
          parseInt(joinMethod.totalTime.minutes) * 60 +
          parseInt(joinMethod.totalTime.seconds)
        if (devicesInfo[joinMethod.devicesType]) {
          devicesInfo[joinMethod.devicesType].push(totalTimeInSeconds)
        } else {
          devicesInfo[joinMethod.devicesType] = [totalTimeInSeconds]
        }
      }
    }

    for (const speakingTime of userTotalTime.sPeakingTime) {
      const totalTimeInSeconds =
        parseInt(speakingTime.hours) * 3600 +
        parseInt(speakingTime.minutes) * 60 +
        parseInt(speakingTime.seconds)

      userSpeakingTime += totalTimeInSeconds

      if (speakingInfo['sPeakingTime']) {
        speakingInfo['sPeakingTime'].push(totalTimeInSeconds)
      } else {
        speakingInfo['sPeakingTime'] = [totalTimeInSeconds]
      }
    }

    const sPeakingTimeTotal = speakingInfo['sPeakingTime']?.reduce(
      (acc, curr) => acc + curr,
      0,
    )

    const formattedDevicesInfo: string[] = []
    for (const deviceType in devicesInfo) {
      const totalDeviceTime = devicesInfo[deviceType].reduce(
        (acc, curr) => acc + curr,
        0,
      )
      formattedDevicesInfo.push(
        `${deviceType} = ${formatTotalTime(totalDeviceTime)}`,
      )
    }

    const formattedTotalTime = formatTotalTime(totalDayTime)
    const formattedSpeakingTime = formatsPeakingTime(sPeakingTimeTotal)

    return {
      formattedDevicesInfo,
      formattedTotalTime,
      formattedSpeakingTime,
    }
  }

  async sendTotalTimeToChannel(
    channel: Discord.TextChannel,
    userId: string,
    today: Date,
    discordServerId: string,
  ) {
    try {
      const userTotalTime = await this.userTotalTimeModel
        .findOne({
          discordId: userId,
          discordServerId,
          createdAt: { $gte: today },
        })
        .exec()

      if (!userTotalTime) {
        return
      }

      const {
        formattedDevicesInfo,
        formattedTotalTime,
        formattedSpeakingTime,
      } = this.calculateTotalTime(userTotalTime, today)

      const embedMessage = new Discord.EmbedBuilder()
        .setColor(Color.hexColor.Blue)
        .setTitle(
          `Total time for ${userTotalTime.discordName} on ${userTotalTime.createdAt}`,
        )
        .addFields(
          {
            name: 'Total time',
            value: `\`\`\`\n${formattedTotalTime}\n\`\`\``,
          },
          {
            name: 'Speak Time',
            value: `\`\`\`\n${formattedSpeakingTime}\n\`\`\``,
          },
          {
            name: 'Devices Used',
            value: `\`\`\`\n${formattedDevicesInfo.join('\n')}\n\`\`\``,
          },
        )

      await channel.send({ embeds: [embedMessage] })
    } catch (error) {
      this.logger.error(
        `Error sending user total time for user ID ${userId} in server ${discordServerId}:`,
        error.message,
      )
    }
  }

  async saveCronUserTotalTime(
    userId: string,
    discordName: string,
    discordId: string,
    createdAt: Date,
    today: Date,
  ) {
    try {
      const userTotalTimes = await this.userTotalTimeModel
        .find({
          discordId: userId,
          createdAt: {
            $gte: dayjs(today).startOf('day').toDate(),
            $lt: dayjs(today).endOf('day').toDate(),
          },
        })
        .exec()

      if (!userTotalTimes || userTotalTimes.length === 0) {
        return
      }

      for (const userTotalTime of userTotalTimes) {
        const existingEntry = await this.cronUserTotalTimeModel
          .findOne({
            userId,
            discordServerId: userTotalTime.discordServerId,
            createdAt: {
              $gte: dayjs(today).startOf('day').toDate(),
              $lt: dayjs(today).endOf('day').toDate(),
            },
          })
          .exec()

        if (existingEntry) {
          continue
        }

        const reducedJoinMethod = userTotalTime.joinMethod.reduce(
          (acc, curr) => {
            const existingDeviceTypeIndex = acc.findIndex(
              (device) => device.devicesType === curr.devicesType,
            )

            if (existingDeviceTypeIndex !== -1) {
              acc[existingDeviceTypeIndex].totalTime = {
                hours: String(
                  Number(acc[existingDeviceTypeIndex].totalTime.hours) +
                    Number(curr.totalTime.hours),
                ),
                minutes: String(
                  Number(acc[existingDeviceTypeIndex].totalTime.minutes) +
                    Number(curr.totalTime.minutes),
                ),
                seconds: String(
                  Number(acc[existingDeviceTypeIndex].totalTime.seconds) +
                    Number(curr.totalTime.seconds),
                ),
              }
            } else {
              acc.push({
                devicesType: curr.devicesType,
                totalTime: curr.totalTime,
              })
            }

            return acc
          },
          [],
        )

        const {
          formattedDevicesInfo,
          formattedTotalTime,
          formattedSpeakingTime,
        } = this.calculateTotalTime(userTotalTime, today)

        const cronUserTotalTimeEntry = new this.cronUserTotalTimeModel({
          discordName,
          userId,
          discordserverName: userTotalTime.discordserverName,
          discordServerId: userTotalTime.discordServerId,
          totalTime: formattedTotalTime,
          sPeakingTime: formattedSpeakingTime,
          joinMethod: reducedJoinMethod,
          createdAt: new Date(),
        })

        await cronUserTotalTimeEntry.save()

        setTimeout(async () => {
          await this.userTotalTimeModel.deleteOne({
            discordId: userId,
            createdAt: {
              $gte: dayjs(today).startOf('day').toDate(),
              $lt: dayjs(today).endOf('day').toDate(),
            },
          })
        }, 10000)
      }
    } catch (error) {
      this.logger.error('Error saving cron user total time entry:', error.message)
    }
  }
}
