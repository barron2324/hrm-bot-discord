import { Logger, Module, OnModuleInit } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import configuration from 'src/config/configuration'
import { DBNAME } from 'src/constructor'

import { HealthzModule } from '../healthz/healthz.module'
import { TasksModule } from '../tasks/tasks.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
    }),
    MongooseModule.forRootAsync({
      connectionName: DBNAME,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        return {
          uri: configService.get<string>('database.host'),
        }
      },
      inject: [ConfigService],
    }),
    HealthzModule,
    TasksModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger();
  onModuleInit() {
    this.logger.log('Connected to MongoDB successfully')
  }
}
