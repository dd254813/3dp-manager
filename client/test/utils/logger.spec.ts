import { describe, it, expect, vi } from 'vitest'
import { Logger } from '@/utils/logger'

describe('Logger', () => {
  describe('Logger.error', () => {
    it('должен вызывать console.error с правильным форматом', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      Logger.error('Test error', 'TestModule')
      expect(consoleSpy).toHaveBeenCalledWith('[TestModule] Test error', '')
      consoleSpy.mockRestore()
    })

    it('должен вызывать console.error с данными', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const data = { code: 500, message: 'Internal error' }
      Logger.error('Test error', 'TestModule', data)
      expect(consoleSpy).toHaveBeenCalledWith('[TestModule] Test error', data)
      consoleSpy.mockRestore()
    })

    it('должен использовать модуль по умолчанию "App"', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      Logger.error('Test error')
      expect(consoleSpy).toHaveBeenCalledWith('[App] Test error', '')
      consoleSpy.mockRestore()
    })
  })

  describe('Logger.warn', () => {
    it('должен вызывать console.warn с правильным форматом', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      Logger.warn('Test warning', 'TestModule')
      expect(consoleSpy).toHaveBeenCalledWith('[TestModule] Test warning', '')
      consoleSpy.mockRestore()
    })

    it('должен вызывать console.warn с данными', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const data = { code: 400, field: 'email' }
      Logger.warn('Test warning', 'TestModule', data)
      expect(consoleSpy).toHaveBeenCalledWith('[TestModule] Test warning', data)
      consoleSpy.mockRestore()
    })
  })

  describe('Logger.info', () => {
    it('должен вызывать console.info с правильным форматом', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      Logger.info('Test info', 'TestModule')
      expect(consoleSpy).toHaveBeenCalledWith('[TestModule] Test info', '')
      consoleSpy.mockRestore()
    })

    it('должен вызывать console.info с данными', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      const data = { user: 'admin', action: 'login' }
      Logger.info('Test info', 'TestModule', data)
      expect(consoleSpy).toHaveBeenCalledWith('[TestModule] Test info', data)
      consoleSpy.mockRestore()
    })
  })

  describe('Logger.debug', () => {
    it('должен вызывать console.log с правильным форматом', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      Logger.debug('Test debug', 'TestModule')
      expect(consoleSpy).toHaveBeenCalledWith('[TestModule] Test debug', '')
      consoleSpy.mockRestore()
    })

    it('должен вызывать console.log с данными', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const data = { state: 'loading', progress: 50 }
      Logger.debug('Test debug', 'TestModule', data)
      expect(consoleSpy).toHaveBeenCalledWith('[TestModule] Test debug', data)
      consoleSpy.mockRestore()
    })
  })

  describe('Logger.verbose', () => {
    it('должен вызывать console.log с правильным форматом', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      Logger.verbose('Test verbose', 'TestModule')
      expect(consoleSpy).toHaveBeenCalledWith('[TestModule] Test verbose', '')
      consoleSpy.mockRestore()
    })

    it('должен вызывать console.log с данными', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const data = { detailed: 'trace', step: 3 }
      Logger.verbose('Test verbose', 'TestModule', data)
      expect(consoleSpy).toHaveBeenCalledWith('[TestModule] Test verbose', data)
      consoleSpy.mockRestore()
    })
  })

  describe('formatMessage', () => {
    it('должен форматировать сообщение без данных', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      Logger.info('Simple message', 'Module')
      expect(consoleSpy).toHaveBeenCalledWith('[Module] Simple message', '')
      consoleSpy.mockRestore()
    })

    it('должен форматировать сообщение с объектом данных', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      Logger.info('Message with data', 'Module', { key: 'value' })
      expect(consoleSpy).toHaveBeenCalledWith('[Module] Message with data', { key: 'value' })
      consoleSpy.mockRestore()
    })

    it('должен форматировать сообщение с массивом данных', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      Logger.info('Message with array', 'Module', [1, 2, 3])
      expect(consoleSpy).toHaveBeenCalledWith('[Module] Message with array', [1, 2, 3])
      consoleSpy.mockRestore()
    })
  })
})
