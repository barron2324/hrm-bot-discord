import { Module, DynamicModule } from '@nestjs/common'
import { Client } from 'discord.js'
import { ChartService } from './chart.service'

@Module({
  providers: [ChartService],
  exports: [ChartService],
})
export class ChartModule {
  static forRoot(discordClientProvider: {
    provide: string
    useValue: Client
  }): DynamicModule {
    return {
      module: ChartModule,
      providers: [discordClientProvider],
      exports: [ChartService],
      global: true,
    }
  }
}
