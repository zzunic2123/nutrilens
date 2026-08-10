import { describe, expect, it } from 'vitest'
import { dataUrlSizeInBytes } from './image'

describe('image helpers', () => {
  it('estimates decoded data URL size', () => {
    expect(dataUrlSizeInBytes('data:image/jpeg;base64,YWJjZA==')).toBe(4)
  })
})
