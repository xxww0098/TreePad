import { describe, it, expect } from 'vitest'
import { bytesToBase64, base64ToBytes, base64ToText, toPlainArrayBuffer } from '../../shared/encoding'

describe('bytesToBase64', () => {
  it('空数组返回空字符串', () => {
    expect(bytesToBase64(new Uint8Array([]))).toBe('')
  })

  it('单字节编码正确', () => {
    // 0 → 'AA=='
    expect(bytesToBase64(new Uint8Array([0]))).toBe('AA==')
    // 255 → '/w=='
    expect(bytesToBase64(new Uint8Array([255]))).toBe('/w==')
  })

  it('与 btoa 结果一致（ASCII 范围）', () => {
    const text = 'Hello, TreePad!'
    const bytes = new TextEncoder().encode(text)
    expect(bytesToBase64(bytes)).toBe(btoa(text))
  })

  it('大文件（100KB+）不栈溢出', () => {
    const large = new Uint8Array(200 * 1024).fill(42)
    expect(() => bytesToBase64(large)).not.toThrow()
    const result = bytesToBase64(large)
    expect(result.length).toBeGreaterThan(0)
  })

  it('往返一致性：encode → decode → encode', () => {
    const original = new Uint8Array([1, 2, 3, 200, 201, 255])
    const encoded = bytesToBase64(original)
    const decoded = base64ToBytes(encoded)
    expect(decoded).toEqual(original)
  })

  it('3 字节对齐（无 padding）', () => {
    const bytes = new Uint8Array([77, 97, 110]) // 'Man'
    expect(bytesToBase64(bytes)).toBe('TWFu')
  })

  it('1 字节 padding（==）', () => {
    const bytes = new Uint8Array([77]) // 'M'
    expect(bytesToBase64(bytes)).toBe('TQ==')
  })

  it('2 字节 padding（=）', () => {
    const bytes = new Uint8Array([77, 97]) // 'Ma'
    expect(bytesToBase64(bytes)).toBe('TWE=')
  })
})

describe('base64ToBytes', () => {
  it('解码空字符串', () => {
    expect(base64ToBytes(btoa(''))).toEqual(new Uint8Array([]))
  })

  it('解码已知 base64', () => {
    const result = base64ToBytes('SGVsbG8=')
    expect(result).toEqual(new TextEncoder().encode('Hello'))
  })
})

describe('base64ToText', () => {
  it('解码 UTF-8 文本', () => {
    const encoded = bytesToBase64(new TextEncoder().encode('TreePad 测试'))
    expect(base64ToText(encoded)).toBe('TreePad 测试')
  })
})

describe('toPlainArrayBuffer', () => {
  it('返回独立的 ArrayBuffer（非子视图偏移）', () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const buf = toPlainArrayBuffer(bytes)
    expect(buf.byteLength).toBe(4)
    // 修改原数组不影响返回的 buffer
    bytes[0] = 99
    const view = new Uint8Array(buf)
    expect(view[0]).toBe(1)
  })

  it('正确处理带偏移的子视图', () => {
    const full = new Uint8Array([0, 0, 10, 20, 30])
    const sliced = full.slice(2) // [10, 20, 30]，byteOffset=0（slice 创建新 buffer）
    const buf = toPlainArrayBuffer(sliced)
    expect(new Uint8Array(buf)).toEqual(new Uint8Array([10, 20, 30]))
  })
})
