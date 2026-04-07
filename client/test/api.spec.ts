import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Мок для localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Динамический импорт после настройки моков
let api: typeof import('@/api').default

describe('api', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Очищаем модуль перед каждым тестом
    await vi.resetModules()
    const module = await import('@/api')
    api = module.default
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('API instance', () => {
    it('должен быть создан с baseURL /api', () => {
      expect(api.defaults.baseURL).toBe('/api')
    })
  })

  describe('Request interceptor', () => {
    it('должен добавлять токен из localStorage в заголовок Authorization', async () => {
      localStorageMock.getItem.mockReturnValue('test-token')
      
      const mockAdapter = vi.fn(() => Promise.resolve({ data: {}, status: 200, headers: {}, config: {} }))
      api.defaults.adapter = mockAdapter
      
      await api.get('/test')
      
      const config = mockAdapter.mock.calls[0][0]
      expect(config.headers.get('Authorization')).toBe('Bearer test-token')
    })

    it('не должен добавлять токен если он отсутствует', async () => {
      localStorageMock.getItem.mockReturnValue(null)
      
      const mockAdapter = vi.fn(() => Promise.resolve({ data: {}, status: 200, headers: {}, config: {} }))
      api.defaults.adapter = mockAdapter
      
      await api.get('/test')
      
      const config = mockAdapter.mock.calls[0][0]
      expect(config.headers.get('Authorization')).toBeFalsy()
    })

    it('должен логировать запрос с существующим токеном', async () => {
      localStorageMock.getItem.mockReturnValue('test-token')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      const mockAdapter = vi.fn(() => Promise.resolve({ data: {}, status: 200, headers: {}, config: {} }))
      api.defaults.adapter = mockAdapter
      
      await api.get('/test')
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Token: EXISTS'), expect.any(String))
      consoleSpy.mockRestore()
    })

    it('должен логировать запрос без токена', async () => {
      localStorageMock.getItem.mockReturnValue(null)
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      const mockAdapter = vi.fn(() => Promise.resolve({ data: {}, status: 200, headers: {}, config: {} }))
      api.defaults.adapter = mockAdapter
      
      await api.get('/test')
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Token: NULL'), expect.any(String))
      consoleSpy.mockRestore()
    })
  })

  describe('Response interceptor', () => {
    it('должен логировать успешный ответ', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      const mockAdapter = vi.fn(() => 
        Promise.resolve({ 
          data: { result: 'ok' }, 
          status: 200, 
          headers: {}, 
          config: { method: 'get', url: '/test' } 
        })
      )
      api.defaults.adapter = mockAdapter
      
      const response = await api.get('/test')
      
      expect(response.status).toBe(200)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('200 OK'), expect.any(String))
      consoleSpy.mockRestore()
    })

    it('должен логировать ошибку с status кодом', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const mockAdapter = vi.fn(() => 
        Promise.reject({ 
          response: { status: 401, data: { message: 'Unauthorized' } },
          config: { method: 'get', url: '/test' }
        })
      )
      api.defaults.adapter = mockAdapter
      
      await expect(api.get('/test')).rejects.toThrow()
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('ERROR 401: Unauthorized'),
        expect.any(String)
      )
      consoleSpy.mockRestore()
    })

    it('должен логировать сетевую ошибку без status', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const mockAdapter = vi.fn(() => 
        Promise.reject({ 
          message: 'Network Error',
          config: { method: 'get', url: '/test' }
        })
      )
      api.defaults.adapter = mockAdapter
      
      await expect(api.get('/test')).rejects.toThrow()
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('ERROR NETWORK: Network Error'),
        expect.any(String)
      )
      consoleSpy.mockRestore()
    })

    it('должен возвращать сообщение из response.data.message', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const mockAdapter = vi.fn(() => 
        Promise.reject({ 
          response: { status: 400, data: { message: 'Bad Request' } },
          config: { method: 'post', url: '/create' }
        })
      )
      api.defaults.adapter = mockAdapter
      
      await expect(api.post('/create')).rejects.toThrow()
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Bad Request'),
        expect.any(String)
      )
      consoleSpy.mockRestore()
    })
  })
})
