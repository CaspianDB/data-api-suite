import * as AuroraDataAPI from '@caspiandb/aurora-data-api'
import DataAPIMigrations, { DataAPIMigrationsConfig } from './DataAPIMigrations'
import { Migration } from './Migration'

export default DataAPIMigrations
export { DataAPIMigrationsConfig }
export type MigrationFn = (dataAPI: AuroraDataAPI, migration: Migration, context?: unknown) => Promise<void>
