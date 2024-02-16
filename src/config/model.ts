import {
  CronUserTotalTime,
  CronUserTotalTimeSchema,
} from 'src/modules/cron-total-time/cron-totol-time.schema'
import {
  DiscordConfig,
  DiscordConfigSchema,
} from 'src/modules/discord-config/discord-config.schema'
import {
  LogEntry,
  LogEntrySchema,
} from 'src/modules/log-entry/log-entry.schema'
import { LogLeave } from 'src/modules/log-leave/log-leave.schema'
import {
  VoiceEvent,
  VoiceEventSchema,
} from 'src/modules/user-event/user-event.schema'
import {
  UserTotalTime,
  UserTotalTimeSchema,
} from 'src/modules/user-total-time/user-total-tiem.schema'

export const model = [
  { name: DiscordConfig.name, schema: DiscordConfigSchema },
  { name: LogEntry.name, schema: LogEntrySchema },
  { name: LogLeave.name, schema: LogEntrySchema },
  { name: UserTotalTime.name, schema: UserTotalTimeSchema },
  { name: VoiceEvent.name, schema: VoiceEventSchema },
  { name: CronUserTotalTime.name, schema: CronUserTotalTimeSchema },
]
