import * as AuroraDataAPI from '@caspiandb/aurora-data-api'

export class Migration {
  public readonly id: string
  public readonly name: string
  public readonly file: string
  public readonly isApplied: boolean
  public readonly isLocal: boolean
  public readonly dataAPI: AuroraDataAPI

  constructor ({
    id,
    name,
    file,
    isApplied,
    isLocal,
    dataAPI
  }) {
    this.id = id
    this.name = name
    this.file = file
    this.isApplied = isApplied
    this.isLocal = isLocal
    this.dataAPI = dataAPI
  }

  public async apply (context?: unknown): Promise<void> {
    if (this.isApplied) { return }
    const { up } = await import(this.file)
    await up(this.dataAPI, this, context)
    await this.dataAPI.query(
      'INSERT INTO __migrations__ (id) VALUES (:id)',
      { id: this.id },
      { includeResultMetadata: false }
    )
  }

  public async rollback (context?: unknown): Promise<void> {
    if (!this.isApplied) { return }
    const { down } = await import(this.file)
    await down(this.dataAPI, this, context)
    await this.dataAPI.query(
      'DELETE FROM __migrations__ WHERE id = :id',
      { id: this.id },
      { includeResultMetadata: false }
    )
  }
}