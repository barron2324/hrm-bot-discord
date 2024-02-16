import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema()
export class CronUserTotalTime extends Document {
  @Prop()
  discordName: string

  @Prop()
  userId: string

  @Prop()
  discordserverName: string

  @Prop()
  discordServerId: string

  @Prop()
  totalTime: string

  @Prop()
  sPeakingTime: string

  @Prop({
    type: [
      {
        devicesType: String,
        totalTime: {
          hours: { type: String, required: true },
          minutes: { type: String, required: true },
          seconds: { type: String, required: true },
        },
      },
    ],
    default: [],
  })
  joinMethod: Array<{
    devicesType: string
    totalTime: {
      hours: string
      minutes: string
      seconds: string
    }
  }>

  @Prop({ default: Date.now })
  createdAt: Date
}
export const CronUserTotalTimeSchema =
  SchemaFactory.createForClass(CronUserTotalTime)
