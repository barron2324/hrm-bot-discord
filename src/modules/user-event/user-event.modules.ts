import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import { model } from 'src/config/model'
import { DBNAME } from 'src/constructor'
import { UserEventService } from './user-event.service'
import { DiscordConfigService } from '../discord-config/discord-config.service'

@Module({
  imports: [MongooseModule.forFeature(model, DBNAME), ConfigModule.forRoot()],
  providers: [UserEventService, DiscordConfigService, ConfigService],
})
export class UserEventTimeModule {}
