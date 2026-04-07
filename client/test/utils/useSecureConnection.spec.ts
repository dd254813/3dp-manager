import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSecureConnection } from '../../src/utils/useSecureConnection'

describe('useSecureConnection', () => {
  const originalLocation = window.location

  beforeEach(() => {
    // Очищаем моки перед каждым тестом
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Восстанавливаем оригинальный location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    })
  })

  describe('при HTTPS соединении', () => {
    it('должен возвращать isSecure: true когда protocol https:', () => {
      // Мок для HTTPS
      Object.defineProperty(window, 'location', {
        value: {
          protocol: 'https:',
        },
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useSecureConnection())

      expect(result.current.isSecure).toBe(true)
    })
  })

  describe('при HTTP соединении', () => {
    it('должен возвращать isSecure: false когда protocol http:', () => {
      // Мок для HTTP
      Object.defineProperty(window, 'location', {
        value: {
          protocol: 'http:',
        },
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useSecureConnection())

      expect(result.current.isSecure).toBe(false)
    })
  })

  describe('при localhost', () => {
    it('должен возвращать isSecure: false для localhost без HTTPS', () => {
      Object.defineProperty(window, 'location', {
        value: {
          protocol: 'http:',
          hostname: 'localhost',
        },
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useSecureConnection())

      expect(result.current.isSecure).toBe(false)
    })
  })

  describe('мемозация', () => {
    it('должен возвращать одно и то же значение при повторных рендерах', () => {
      Object.defineProperty(window, 'location', {
        value: {
          protocol: 'https:',
        },
        writable: true,
        configurable: true,
      })

      const { result, rerender } = renderHook(() => useSecureConnection())
      const firstValue = result.current.isSecure

      rerender()

      expect(result.current.isSecure).toBe(firstValue)
    })
  })
})
