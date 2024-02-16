import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema()
export class LogLeave extends Document {
  @Prop()
  username: string

  @Prop()
  userId: string

  @Prop()
  action: string

  @Prop()
  serverName: string

  @Prop()
  timestamp: Date
}

export const LogLeaveSchema = SchemaFactory.createForClass(LogLeave)
