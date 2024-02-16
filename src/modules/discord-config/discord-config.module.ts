import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import { model } from 'src/config/model'
import { DBNAME } from 'src/constructor'

import { DiscordConfigService } from './discord-config.service'

@Module({
  imports: [MongooseModule.forFeature(model, DBNAME)],
  providers: [DiscordConfigService, ConfigService],
})
export class DiscordConfigModule {}
