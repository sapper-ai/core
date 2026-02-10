import { QuarantineManager } from '@sapper-ai/core'

interface QuarantineListCommandOptions {
  quarantineDir?: string
  write?: (text: string) => void
}

interface QuarantineRestoreCommandOptions {
  id: string
  quarantineDir?: string
  write?: (text: string) => void
}

export async function runQuarantineListCommand(options: QuarantineListCommandOptions): Promise<void> {
  const manager = new QuarantineManager({ quarantineDir: options.quarantineDir })
  const records = await manager.list()
  const write = options.write ?? ((text: string) => process.stdout.write(text))

  write(
    `${JSON.stringify(
      {
        count: records.length,
        records,
      },
      null,
      2
    )}\n`
  )
}

export async function runQuarantineRestoreCommand(options: QuarantineRestoreCommandOptions): Promise<void> {
  const manager = new QuarantineManager({ quarantineDir: options.quarantineDir })
  await manager.restore(options.id)

  const write = options.write ?? ((text: string) => process.stdout.write(text))
  write(`Restored quarantine record: ${options.id}\n`)
}
