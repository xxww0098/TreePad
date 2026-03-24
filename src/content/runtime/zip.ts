import { zipSync, type Zippable } from 'fflate'

export function createZipArchive(files: Record<string, Uint8Array>): Uint8Array {
  return zipSync(files as Zippable)
}
