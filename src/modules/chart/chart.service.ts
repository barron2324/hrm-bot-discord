import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ChartConfiguration } from 'chart.js'
import { ChartJSNodeCanvas } from 'chartjs-node-canvas'
import * as dayjs from 'dayjs'
import { MongoClient, Db, WithId } from 'mongodb'
import { UserData, ChartData } from 'src/interfaces/chart.interfaces'
import { Color } from '../discord/components/utils/color.utils'


@Injectable()
export class ChartService implements OnModuleInit {
  static chartJSNodeCanvas: ChartJSNodeCanvas | null = null
  private mongoDB: string
  private dbName: string
  private readonly logger = new Logger(ChartService.name)
  constructor(private readonly configService: ConfigService) {
    this.mongoDB = this.configService.get<string>('MONGODB_URI')
    this.dbName = this.configService.get<string>('DB_NAME')
    this.ensureChartInitialized()
  }

  async onModuleInit() {
    await this.ensureChartInitialized()
  }

  private async ensureChartInitialized(): Promise<void> {
    if (!ChartService.chartJSNodeCanvas) {
      ChartService.chartJSNodeCanvas = new ChartJSNodeCanvas({
        width: 1000,
        height: 600,
        chartCallback: async (ChartJS) => {
          if (typeof ChartJS !== 'undefined') {
            ChartJS.defaults.datasets.bar.barThickness = 50
          }
        },
      })
    }
  }

  private prepareChartDataForServer(usersData: UserData[]): ChartData {
    const labels = usersData.map((userData) => userData.discordName)
    const totalTimesHours = usersData.map((userData) =>
      this.convertTimeToHours(this.parseTimeStringToObject(userData.totalTime)),
    )
    const speakingTimesHours = usersData.map((userData) =>
      this.convertTimeToHours(
        this.parseTimeStringToObject(userData.sPeakingTime),
      ),
    )
    const dateCreate = {
      timestamp: dayjs().tz('Asia/Bangkok').format(),
    }

    return {
      labels: labels,
      datasets: [
        {
          label: 'totalTimeHours(Hours)',
          data: totalTimesHours,
          backgroundColor: [String(Color.hexadecimalColor.Blue)],
        },
        {
          label: 'speakingTimeHours(Hours)            ' + dateCreate.timestamp,
          data: speakingTimesHours,
          backgroundColor: [String(Color.hexadecimalColor.Yellow)],
        },
      ],
    }
  }

  private parseTimeStringToObject(timeString: string): {
    hours: string
    minutes: string
    seconds: string
  } {
    const [hours, minutes, seconds] = timeString
      .split(',')
      .map((part) => part.trim().split(' ')[0])
    return { hours, minutes, seconds }
  }

  private createChartConfiguration(data: ChartData): ChartConfiguration {
    return {
      type: 'bar',
      data: data,
      options: {
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    }
  }

  private convertTimeToHours(timeObject: {
    hours: string
    minutes: string
    seconds: string
  }): number {
    const hours = parseInt(timeObject.hours, 10) || 0
    const minutes = parseInt(timeObject.minutes, 10) || 0
    const seconds = parseInt(timeObject.seconds, 10) || 0

    return hours + minutes / 60 + seconds / 3600
  }

  async generateChart(configuration: ChartConfiguration): Promise<Buffer> {
    return await ChartService.chartJSNodeCanvas!.renderToBuffer(configuration)
  }

  async generateChartForServer(serverId: string): Promise<Buffer> {
    const dataFromMongo = await this.getDataForServer(serverId)
    if (dataFromMongo.length > 0) {
      const chartData = this.prepareChartDataForServer(dataFromMongo)
      return await this.generateChart(this.createChartConfiguration(chartData))
    } else {
      this.logger.error('No data found for server:', serverId)
      return Buffer.from('')
    }
  }

  async getDataForServer(serverId: string): Promise<UserData[]> {
    const client = new MongoClient(this.mongoDB, {})
    await client.connect()

    try {
      const database: Db = client.db(this.dbName)
      const collection =
        database.collection<WithId<UserData>>('cronusertotaltimes')
      const today = dayjs().tz('Asia/Bangkok').startOf('day').toDate() as any
      const result = await collection
        .find({
          discordServerId: serverId,
          createdAt: { $gte: today },
        })
        .toArray()

      return result
    } finally {
      client.close()
    }
  }
}
