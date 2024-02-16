import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type VoiceEventDocument = VoiceEvent & Document

@Schema()
export class VoiceEvent {
  @Prop({ required: true })
  servername: string

  @Prop({ required: true })
  userId: string

  @Prop({ required: true })
  username: string

  @Prop({ default: Date.now })
  createdAt: Date

  @Prop()
  events: Array<{ event: string; timestamp: Date }>
}

export const VoiceEventSchema = SchemaFactory.createForClass(VoiceEvent)
