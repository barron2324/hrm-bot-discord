import { Controller, Get } from '@nestjs/common'

@Controller('healthz')
export class HealthzController {
  @Get()
  check(): Record<string, any> {
    return { status: 'ok' }
  }
}
