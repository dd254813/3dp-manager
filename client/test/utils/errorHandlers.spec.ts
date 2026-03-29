import { describe, it, expect } from 'vitest'
import {
  isApiError,
  getApiErrorMessage,
  getApiErrorStatus,
} from '@/utils/errorHandlers'

describe('errorHandlers', () => {
  describe('isApiError', () => {
    it('должен возвращать true для API ошибки с response', () => {
      const error = { response: { status: 400, data: { message: 'Error' } } }
      expect(isApiError(error)).toBe(true)
    })

    it('должен возвращать true для API ошибки без response.data', () => {
      const error = { response: {} }
      expect(isApiError(error)).toBe(true)
    })

    it('должен возвращать false для null', () => {
      expect(isApiError(null)).toBe(false)
    })

    it('должен возвращать false для строки', () => {
      expect(isApiError('error')).toBe(false)
    })

    it('должен возвращать false для объекта без response', () => {
      expect(isApiError({ message: 'Error' })).toBe(false)
    })
  })

  describe('getApiErrorMessage', () => {
    it('должен извлекать строковое сообщение из ошибки', () => {
      const error = { response: { data: { message: 'Custom error' } } }
      expect(getApiErrorMessage(error)).toBe('Custom error')
    })

    it('должен извлекать массив сообщений и объединять через точку с запятой', () => {
      const error = { response: { data: { message: ['Error 1', 'Error 2'] } } }
      expect(getApiErrorMessage(error)).toBe('Error 1; Error 2')
    })

    it('должен возвращать сообщение по умолчанию для обычной ошибки', () => {
      expect(getApiErrorMessage('string error')).toBe('Произошла ошибка')
    })

    it('должен извлекать message из Error объекта', () => {
      const error = new Error('Native error')
      expect(getApiErrorMessage(error)).toBe('Native error')
    })

    it('должен использовать кастомное сообщение по умолчанию', () => {
      expect(getApiErrorMessage(null, 'Custom default')).toBe('Custom default')
    })

    it('должен возвращать undefined message как сообщение по умолчанию', () => {
      const error = { response: { data: { message: undefined } } }
      expect(getApiErrorMessage(error)).toBe('Произошла ошибка')
    })
  })

  describe('getApiErrorStatus', () => {
    it('должен извлекать status код из ошибки', () => {
      const error = { response: { status: 404 } }
      expect(getApiErrorStatus(error)).toBe(404)
    })

    it('должен возвращать undefined для ошибки без status', () => {
      const error = { response: {} }
      expect(getApiErrorStatus(error)).toBeUndefined()
    })

    it('должен возвращать undefined для не API ошибки', () => {
      expect(getApiErrorStatus('error')).toBeUndefined()
    })

    it('должен возвращать undefined для null', () => {
      expect(getApiErrorStatus(null)).toBeUndefined()
    })
  })
})
