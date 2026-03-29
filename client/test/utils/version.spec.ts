import { describe, it, expect } from 'vitest'
import { APP_VERSION } from '@/utils/version'

describe('version', () => {
  describe('APP_VERSION', () => {
    it('должен быть строкой', () => {
      expect(typeof APP_VERSION).toBe('string')
    })

    it('должен соответствовать формату семантического версионирования', () => {
      const semverRegex = /^\d+\.\d+\.\d+$/
      expect(APP_VERSION).toMatch(semverRegex)
    })

    it('должен быть непустой строкой', () => {
      expect(APP_VERSION.length).toBeGreaterThan(0)
    })
  })
})
