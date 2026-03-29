import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import SettingsPage from '../../src/pages/SettingsPage'
import { ThemeProvider } from '../../src/ThemeContext'
import { AuthProvider } from '../../src/auth/AuthContext'

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()

vi.mock('../../src/api', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
  },
}))

// Хелпер для настройки мока get по умолчанию
const setupMockGet = (overrides?: { settings?: Record<string, unknown>, subscriptions?: unknown[] }) => {
  mockGet.mockImplementation((url: string) => {
    if (url === '/settings') return Promise.resolve({ data: overrides?.settings || {} })
    if (url === '/subscriptions') return Promise.resolve({ data: overrides?.subscriptions || [] })
    return Promise.resolve({ data: {} })
  })
}

const renderSettingsPage = () => {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SettingsPage />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Рендеринг', () => {
    it('должен рендериться с заголовком', async () => {
      setupMockGet()
      renderSettingsPage()
      
      await waitFor(() => {
        expect(screen.getByText('Настройки утилиты')).toBeInTheDocument()
      })
    })

    it('должен отображать секцию панели 3x-ui', async () => {
      setupMockGet()
      renderSettingsPage()
      
      await waitFor(() => {
        expect(screen.getByText('Панель 3x-ui')).toBeInTheDocument()
      })
    })

    it('должен отображать секцию генерации инбаундов', async () => {
      setupMockGet()
      renderSettingsPage()
      
      await waitFor(() => {
        expect(screen.getByText('Генерация инбаундов')).toBeInTheDocument()
      })
    })

    it('должен отображать поля ввода для 3x-ui', async () => {
      setupMockGet()
      renderSettingsPage()
      
      await waitFor(() => {
        expect(screen.getByLabelText('URL панели')).toBeInTheDocument()
        expect(screen.getByLabelText('Логин 3x-ui')).toBeInTheDocument()
        expect(screen.getByLabelText('Пароль 3x-ui')).toBeInTheDocument()
      })
    })

    it('должен отображать поле интервала генерации', async () => {
      setupMockGet()
      renderSettingsPage()
      
      await waitFor(() => {
        expect(screen.getByLabelText('Интервал генерации')).toBeInTheDocument()
      })
    })

    it('должен отображать пресеты интервалов', async () => {
      setupMockGet()
      renderSettingsPage()
      
      await waitFor(() => {
        expect(screen.getByText('Сутки')).toBeInTheDocument()
        expect(screen.getByText('3 дня')).toBeInTheDocument()
        expect(screen.getByText('Неделя')).toBeInTheDocument()
      })
    })
  })

  describe('Загрузка настроек', () => {
    it('должен загружать настройки при монтировании', async () => {
      const mockSettings = {
        xui_url: 'https://test.com:2053',
        xui_login: 'admin',
        xui_password: 'password',
        rotation_interval: '60',
        rotation_status: 'active',
        last_rotation_timestamp: '1234567890',
      }
      setupMockGet({ settings: mockSettings })
      renderSettingsPage()
      
      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/settings')
      })
    })

    it('должен загружать подписки при монтировании', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', isAutoRotationEnabled: true }
      ]
      mockGet.mockImplementation((url: string) => {
        if (url === '/subscriptions') return Promise.resolve({ data: mockSubs })
        return Promise.resolve({ data: {} })
      })
      
      renderSettingsPage()
      
      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/subscriptions')
      })
    })
  })

  describe('Изменение полей', () => {
    it('должен позволять изменять URL панели', async () => {
      setupMockGet()
      renderSettingsPage()
      
      const urlField = await screen.findByLabelText('URL панели')
      fireEvent.change(urlField, { target: { value: 'https://new-url.com:2053' } })
      
      expect(urlField).toHaveValue('https://new-url.com:2053')
    })

    it('должен позволять изменять логин 3x-ui', async () => {
      setupMockGet()
      renderSettingsPage()
      
      const loginField = await screen.findByLabelText('Логин 3x-ui')
      fireEvent.change(loginField, { target: { value: 'newadmin' } })
      
      expect(loginField).toHaveValue('newadmin')
    })

    it('должен позволять изменять пароль 3x-ui', async () => {
      setupMockGet()
      renderSettingsPage()
      
      const passwordField = await screen.findByLabelText('Пароль 3x-ui')
      fireEvent.change(passwordField, { target: { value: 'newpassword' } })
      
      expect(passwordField).toHaveValue('newpassword')
    })
  })

  describe('Пресеты интервалов', () => {
    it('должен отображать пресеты интервалов', async () => {
      setupMockGet({ settings: { rotation_interval: '30' } })
      renderSettingsPage()
      
      await waitFor(() => {
        expect(screen.getByText('Сутки')).toBeInTheDocument()
        expect(screen.getByText('3 дня')).toBeInTheDocument()
        expect(screen.getByText('Неделя')).toBeInTheDocument()
      })
    })
  })

  describe('Сохранение настроек подключения', () => {
    it('должен показывать ошибку при пустых полях', async () => {
      setupMockGet()
      renderSettingsPage()
      
      const saveButton = await screen.findByText('Сохранить подключение')
      fireEvent.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Заполните все поля/i)).toBeInTheDocument()
      })
    })

    it('должен сохранять настройки при валидных данных', async () => {
      setupMockGet()
      mockPost.mockResolvedValue({ data: {} })
      
      renderSettingsPage()
      
      const urlField = await screen.findByLabelText('URL панели')
      const loginField = screen.getByLabelText('Логин 3x-ui')
      const passwordField = screen.getByLabelText('Пароль 3x-ui')
      
      fireEvent.change(urlField, { target: { value: 'https://test.com:2053' } })
      fireEvent.change(loginField, { target: { value: 'admin' } })
      fireEvent.change(passwordField, { target: { value: 'password' } })
      
      const saveButton = screen.getByText('Сохранить подключение')
      fireEvent.click(saveButton)
      
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/settings', expect.objectContaining({
          xui_url: 'https://test.com:2053',
          xui_login: 'admin',
          xui_password: 'password',
        }))
      })
    })

    it('должен показывать сообщение об успехе после сохранения', async () => {
      setupMockGet()
      mockPost.mockResolvedValue({ data: {} })
      
      renderSettingsPage()
      
      const urlField = await screen.findByLabelText('URL панели')
      const loginField = screen.getByLabelText('Логин 3x-ui')
      const passwordField = screen.getByLabelText('Пароль 3x-ui')
      
      fireEvent.change(urlField, { target: { value: 'https://test.com:2053' } })
      fireEvent.change(loginField, { target: { value: 'admin' } })
      fireEvent.change(passwordField, { target: { value: 'password' } })
      
      const saveButton = screen.getByText('Сохранить подключение')
      fireEvent.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByText('Настройки сохранены!')).toBeInTheDocument()
      })
    })
  })

  describe('Проверка подключения', () => {
    it('должен проверять подключение при клике на кнопку "Проверить"', async () => {
      setupMockGet()
      mockPost.mockResolvedValue({ data: { success: true } })
      
      renderSettingsPage()
      
      const urlField = await screen.findByLabelText('URL панели')
      const loginField = screen.getByLabelText('Логин 3x-ui')
      const passwordField = screen.getByLabelText('Пароль 3x-ui')
      
      fireEvent.change(urlField, { target: { value: 'https://test.com:2053' } })
      fireEvent.change(loginField, { target: { value: 'admin' } })
      fireEvent.change(passwordField, { target: { value: 'password' } })
      
      const checkButton = screen.getByText('Проверить')
      fireEvent.click(checkButton)
      
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/settings/check', expect.objectContaining({
          xui_url: 'https://test.com:2053',
          xui_login: 'admin',
          xui_password: 'password',
        }))
      })
    })

    it('должен показывать успех при успешной проверке', async () => {
      setupMockGet()
      mockPost.mockResolvedValue({ data: { success: true } })
      
      renderSettingsPage()
      
      const urlField = await screen.findByLabelText('URL панели')
      const loginField = screen.getByLabelText('Логин 3x-ui')
      const passwordField = screen.getByLabelText('Пароль 3x-ui')
      
      fireEvent.change(urlField, { target: { value: 'https://test.com:2053' } })
      fireEvent.change(loginField, { target: { value: 'admin' } })
      fireEvent.change(passwordField, { target: { value: 'password' } })
      
      const checkButton = screen.getByText('Проверить')
      fireEvent.click(checkButton)
      
      await waitFor(() => {
        expect(screen.getByText('Подключение успешно!')).toBeInTheDocument()
      })
    })

    it('должен показывать ошибку при неудачной проверке', async () => {
      setupMockGet()
      mockPost.mockResolvedValue({ data: { success: false } })
      
      renderSettingsPage()
      
      const urlField = await screen.findByLabelText('URL панели')
      const loginField = screen.getByLabelText('Логин 3x-ui')
      const passwordField = screen.getByLabelText('Пароль 3x-ui')
      
      fireEvent.change(urlField, { target: { value: 'https://test.com:2053' } })
      fireEvent.change(loginField, { target: { value: 'admin' } })
      fireEvent.change(passwordField, { target: { value: 'wrong' } })
      
      const checkButton = screen.getByText('Проверить')
      fireEvent.click(checkButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Ошибка/i)).toBeInTheDocument()
      })
    })
  })

  describe('Сохранение интервала', () => {
    it('должен сохранять интервал при клике на кнопку', async () => {
      setupMockGet()
      mockPost.mockResolvedValue({ data: {} })
      
      renderSettingsPage()
      
      const intervalField = await screen.findByLabelText('Интервал генерации')
      fireEvent.change(intervalField, { target: { value: '120' } })
      
      const saveButton = screen.getByText('Применить интервал')
      fireEvent.click(saveButton)
      
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/settings', {
          rotation_interval: '120',
        })
      })
    })

    it('должен показывать сообщение об успехе после сохранения интервала', async () => {
      setupMockGet()
      mockPost.mockResolvedValue({ data: {} })
      
      renderSettingsPage()
      
      const intervalField = await screen.findByLabelText('Интервал генерации')
      fireEvent.change(intervalField, { target: { value: '120' } })
      
      const saveButton = screen.getByText('Применить интервал')
      fireEvent.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByText('Интервал генерации применён!')).toBeInTheDocument()
      })
    })
  })

  describe('Принудительная ротация', () => {
    it('должен показывать диалог подтверждения при клике на "Сгенерировать сейчас"', async () => {
      setupMockGet()
      renderSettingsPage()
      
      const rotateButton = await screen.findByText('Сгенерировать сейчас')
      fireEvent.click(rotateButton)
      
      await waitFor(() => {
        expect(screen.getByText(/ВНИМАНИЕ/i)).toBeInTheDocument()
      })
    })

    it('должен выполнять ротацию при подтверждении', async () => {
      setupMockGet()
      mockPost.mockResolvedValue({ data: { success: true, message: 'Ротация выполнена' } })
      
      renderSettingsPage()
      
      const rotateButton = await screen.findByText('Сгенерировать сейчас')
      fireEvent.click(rotateButton)
      
      const confirmButton = await screen.findByText('Продолжить')
      fireEvent.click(confirmButton)
      
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/rotation/rotate-all')
      })
    })
  })

  describe('Управление авторотацией подписок', () => {
    it('должен отображать список подписок с чекбоксами', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', isAutoRotationEnabled: true }
      ]
      mockGet.mockImplementation((url: string) => {
        if (url === '/subscriptions') return Promise.resolve({ data: mockSubs })
        return Promise.resolve({ data: {} })
      })
      
      renderSettingsPage()
      
      await waitFor(() => {
        expect(screen.getByText('Test Sub')).toBeInTheDocument()
      })
    })

    it('должен переключать авторотацию при клике на чекбокс', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', isAutoRotationEnabled: true }
      ]
      mockGet.mockImplementation((url: string) => {
        if (url === '/subscriptions') return Promise.resolve({ data: mockSubs })
        return Promise.resolve({ data: {} })
      })
      mockPut.mockResolvedValue({ data: {} })
      
      renderSettingsPage()
      
      const checkbox = await screen.findByRole('checkbox')
      fireEvent.click(checkbox)
      
      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/subscriptions/bulk-auto-rotation', expect.anything())
      })
    })

    it('должен показывать сообщение при включении авторотации', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', isAutoRotationEnabled: false }
      ]
      mockGet.mockImplementation((url: string) => {
        if (url === '/subscriptions') return Promise.resolve({ data: mockSubs })
        return Promise.resolve({ data: {} })
      })
      mockPut.mockResolvedValue({ data: {} })
      
      renderSettingsPage()
      
      const checkbox = await screen.findByRole('checkbox')
      fireEvent.click(checkbox)
      
      await waitFor(() => {
        expect(screen.getByText('Авторотация включена')).toBeInTheDocument()
      })
    })

    it('должен выполнять ручную ротацию при клике на кнопку обновления', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', isAutoRotationEnabled: true }
      ]
      mockGet.mockImplementation((url: string) => {
        if (url === '/subscriptions') return Promise.resolve({ data: mockSubs })
        return Promise.resolve({ data: {} })
      })
      mockPost.mockResolvedValue({ data: { message: 'Ротация выполнена' } })
      
      renderSettingsPage()
      
      const refreshButton = await screen.findByRole('button', { name: /Обновить подписку вручную/i })
      fireEvent.click(refreshButton)
      
      const confirmButton = await screen.findByText('Продолжить')
      fireEvent.click(confirmButton)
      
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/rotation/rotate-one/1')
      })
    })

    it('должен выполнять массовое включение авторотации', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', isAutoRotationEnabled: false }
      ]
      mockGet.mockImplementation((url: string) => {
        if (url === '/subscriptions') return Promise.resolve({ data: mockSubs })
        return Promise.resolve({ data: {} })
      })
      mockPut.mockResolvedValue({ data: { message: 'Настройки обновлены' } })
      
      renderSettingsPage()
      
      const enableAllButton = await screen.findByText('Включить для всех')
      fireEvent.click(enableAllButton)
      
      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/subscriptions/bulk-auto-rotation', expect.objectContaining({
          enabled: true,
        }))
      })
    })

    it('должен выполнять массовое выключение авторотации', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', isAutoRotationEnabled: true }
      ]
      mockGet.mockImplementation((url: string) => {
        if (url === '/subscriptions') return Promise.resolve({ data: mockSubs })
        return Promise.resolve({ data: {} })
      })
      mockPut.mockResolvedValue({ data: { message: 'Настройки обновлены' } })
      
      renderSettingsPage()
      
      const disableAllButton = await screen.findByText('Выключить для всех')
      fireEvent.click(disableAllButton)
      
      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/subscriptions/bulk-auto-rotation', expect.objectContaining({
          enabled: false,
        }))
      })
    })
  })

  describe('Обновление профиля администратора', () => {
    it('должен позволять изменять логин администратора', async () => {
      setupMockGet()
      renderSettingsPage()
      
      const loginField = await screen.findByLabelText('Логин администратора')
      fireEvent.change(loginField, { target: { value: 'newadmin' } })
      
      expect(loginField).toHaveValue('newadmin')
    })

    it('должен позволять изменять пароль администратора', async () => {
      setupMockGet()
      renderSettingsPage()
      
      const passwordField = await screen.findByLabelText('Новый пароль')
      fireEvent.change(passwordField, { target: { value: 'newpassword' } })
      
      expect(passwordField).toHaveValue('newpassword')
    })

    it('должен сохранять профиль администратора', async () => {
      setupMockGet()
      mockPost.mockResolvedValue({ data: {} })
      
      renderSettingsPage()
      
      const loginField = await screen.findByLabelText('Логин администратора')
      const passwordField = screen.getByLabelText('Новый пароль')
      
      fireEvent.change(loginField, { target: { value: 'newadmin' } })
      fireEvent.change(passwordField, { target: { value: 'newpassword' } })
      
      const saveButton = screen.getByText('Обновить профиль')
      fireEvent.click(saveButton)
      
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/auth/update-profile', expect.objectContaining({
          login: 'newadmin',
          password: 'newpassword',
        }))
      })
    })

    it('должен показывать сообщение об успехе после обновления профиля', async () => {
      setupMockGet()
      mockPost.mockResolvedValue({ data: {} })
      
      renderSettingsPage()
      
      const loginField = await screen.findByLabelText('Логин администратора')
      const passwordField = screen.getByLabelText('Новый пароль')
      
      fireEvent.change(loginField, { target: { value: 'newadmin' } })
      fireEvent.change(passwordField, { target: { value: 'newpassword' } })
      
      const saveButton = screen.getByText('Обновить профиль')
      fireEvent.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByText('Профиль администратора обновлен!')).toBeInTheDocument()
      })
    })
  })

  describe('Пауза/возобновление ротации', () => {
    it('должен отображать статус "Активен" при active статусе', async () => {
      setupMockGet({ settings: { rotation_status: 'active' } })
      renderSettingsPage()
      
      await waitFor(() => {
        expect(screen.getByText('Активен')).toBeInTheDocument()
      })
    })

    it('должен отображать статус "Остановлен" при stopped статусе', async () => {
      setupMockGet({ settings: { rotation_status: 'stopped' } })
      renderSettingsPage()
      
      await waitFor(() => {
        expect(screen.getByText('Остановлен')).toBeInTheDocument()
      })
    })

    it('должен переключать статус при клике на кнопку паузы', async () => {
      setupMockGet({ settings: { rotation_status: 'active' } })
      mockPost.mockResolvedValue({ data: {} })
      
      renderSettingsPage()
      
      const pauseButton = await screen.findByRole('button', { name: 'Поставить на паузу' })
      fireEvent.click(pauseButton)
      
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/settings', expect.objectContaining({
          rotation_status: 'stopped',
        }))
      })
    })
  })

  describe('Отображение дат ротации', () => {
    it('должен отображать дату последней ротации', async () => {
      setupMockGet({ settings: { last_rotation_timestamp: '1234567890' } })
      renderSettingsPage()
      
      await waitFor(() => {
        expect(screen.getByText('Последняя генерация')).toBeInTheDocument()
      })
    })

    it('должен отображать дату следующей ротации', async () => {
      setupMockGet({ settings: { 
        rotation_status: 'active',
        last_rotation_timestamp: '1234567890',
        rotation_interval: '60'
      } })
      renderSettingsPage()
      
      await waitFor(() => {
        expect(screen.getByText('Следующая генерация')).toBeInTheDocument()
      })
    })

    it('должен отображать "Пауза" для следующей ротации при stopped статусе', async () => {
      setupMockGet({ settings: { rotation_status: 'stopped' } })
      renderSettingsPage()
      
      await waitFor(() => {
        expect(screen.getByText('Пауза')).toBeInTheDocument()
      })
    })
  })
})
