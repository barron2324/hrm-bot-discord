import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { model } from 'src/config/model'
import { DBNAME } from 'src/constructor'

@Module({
  imports: [MongooseModule.forFeature(model, DBNAME)],
  providers: [],
})
export class CronUserTotalTimeModule {}
