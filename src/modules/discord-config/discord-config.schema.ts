import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema()
export class DiscordConfig extends Document {
  @Prop()
  discordServerId: string

  @Prop()
  discordServerName: string

  @Prop()
  channelId: Array<{
    voiceChannel: string
    channelEnter: string
    channelLeave: string
    channelTotaltime: string
    channelCronTotaltime: string
    channelSendChart: string
  }>
}

export const DiscordConfigSchema = SchemaFactory.createForClass(DiscordConfig)
