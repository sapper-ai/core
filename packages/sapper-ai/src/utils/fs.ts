import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

export async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8')
  } catch {
    return null
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true })
}

function nextBackupPath(originalPath: string): string {
  const first = `${originalPath}.bak`
  if (!existsSync(first)) {
    return first
  }

  for (let i = 1; i < 1000; i += 1) {
    const candidate = `${originalPath}.bak.${i}`
    if (!existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(`Unable to find free backup path for ${originalPath}`)
}

export async function backupFile(originalPath: string): Promise<string> {
  const backupPath = nextBackupPath(originalPath)
  await ensureDir(dirname(backupPath))
  await copyFile(originalPath, backupPath)
  return backupPath
}

export async function atomicWriteFile(
  filePath: string,
  content: string,
  options: { mode?: number } = {}
): Promise<void> {
  const dir = dirname(filePath)
  await ensureDir(dir)

  const tmpName = `.${basename(filePath)}.tmp.${process.pid}.${Date.now()}`
  const tmpPath = join(dir, tmpName)

  await writeFile(tmpPath, content, { encoding: 'utf8', mode: options.mode })
  try {
    await rename(tmpPath, filePath)
  } catch (error) {
    await unlink(tmpPath).catch(() => {})
    throw error
  }
}
