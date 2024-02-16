import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { model } from 'src/config/model'
import { DBNAME } from 'src/constructor'
import { LogLeaveService } from './log-leave.service'

@Module({
  imports: [MongooseModule.forFeature(model, DBNAME)],
  providers: [LogLeaveService],
})
export class LogLeaveModule {}
