import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import TunnelsPage from '../../src/pages/TunnelsPage'
import { ThemeProvider } from '../../src/ThemeContext'
import { AuthProvider } from '../../src/auth/AuthContext'

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockDelete = vi.fn()

vi.mock('../../src/api', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'debug').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

const setupMockGet = (overrides?: {
  tunnels?: unknown[]
}) => {
  mockGet.mockImplementation((url: string) => {
    if (url === '/tunnels') return Promise.resolve({ data: overrides?.tunnels || [] })
    return Promise.resolve({ data: {} })
  })
}

const renderTunnelsPage = () => {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <TunnelsPage />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

describe('TunnelsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Рендеринг', () => {
    it('должен рендериться с заголовком', async () => {
      setupMockGet()
      renderTunnelsPage()

      await waitFor(() => {
        expect(screen.getByText('Relay серверы')).toBeInTheDocument()
      })
    })

    it('должен отображать кнопку "Добавить"', async () => {
      setupMockGet()
      renderTunnelsPage()

      await waitFor(() => {
        expect(screen.getByText('Добавить')).toBeInTheDocument()
      })
    })

    it('должен отображать сообщение при отсутствии серверов', async () => {
      setupMockGet({ tunnels: [] })
      renderTunnelsPage()

      await waitFor(() => {
        expect(screen.getByText('Нет серверов')).toBeInTheDocument()
      })
    })

    it('должен отображать список серверов', async () => {
      const mockTunnels = [
        { id: 1, name: 'Test Server', ip: '192.168.1.1', sshPort: 22, username: 'root', isInstalled: true }
      ]
      setupMockGet({ tunnels: mockTunnels })
      renderTunnelsPage()

      await waitFor(() => {
        expect(screen.getByText('Test Server')).toBeInTheDocument()
        expect(screen.getByText('192.168.1.1')).toBeInTheDocument()
      })
    })

    it('должен отображать статус "Активен" для установленного сервера', async () => {
      const mockTunnels = [
        { id: 1, name: 'Active Server', ip: '192.168.1.1', sshPort: 22, username: 'root', isInstalled: true }
      ]
      setupMockGet({ tunnels: mockTunnels })
      renderTunnelsPage()

      await waitFor(() => {
        expect(screen.getByText('Активен')).toBeInTheDocument()
      })
    })

    it('должен отображать статус "Не настроен" для неустановленного сервера', async () => {
      const mockTunnels = [
        { id: 1, name: 'Inactive Server', ip: '192.168.1.1', sshPort: 22, username: 'root', isInstalled: false }
      ]
      setupMockGet({ tunnels: mockTunnels })
      renderTunnelsPage()

      await waitFor(() => {
        expect(screen.getByText('Не настроен')).toBeInTheDocument()
      })
    })
  })

  describe('Загрузка данных', () => {
    it('должен загружать туннели при монтировании', async () => {
      setupMockGet()
      renderTunnelsPage()

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/tunnels')
      })
    })

    it('должен отображать несколько серверов', async () => {
      const mockTunnels = [
        { id: 1, name: 'Server 1', ip: '1.1.1.1', sshPort: 22, username: 'root', isInstalled: true },
        { id: 2, name: 'Server 2', ip: '2.2.2.2', sshPort: 2222, username: 'admin', isInstalled: false }
      ]
      setupMockGet({ tunnels: mockTunnels })
      renderTunnelsPage()

      await waitFor(() => {
        expect(screen.getByText('Server 1')).toBeInTheDocument()
        expect(screen.getByText('Server 2')).toBeInTheDocument()
      })
    })
  })

  describe('Диалог создания сервера', () => {
    it('должен открывать диалог при клике на "Добавить"', async () => {
      setupMockGet()
      renderTunnelsPage()

      const addButton = await screen.findByText('Добавить')
      fireEvent.click(addButton)

      await waitFor(() => {
        expect(screen.getByText('Новый редирект сервер')).toBeInTheDocument()
      })
    })

    it('должен закрывать диалог при клике на "Отмена"', async () => {
      setupMockGet()
      renderTunnelsPage()

      const addButton = await screen.findByText('Добавить')
      fireEvent.click(addButton)

      const cancelButton = await screen.findByText('Отмена')
      fireEvent.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByText('Новый редирект сервер')).not.toBeInTheDocument()
      })
    })

    it('должен отображать поля формы', async () => {
      setupMockGet()
      renderTunnelsPage()

      const addButton = await screen.findByText('Добавить')
      fireEvent.click(addButton)

      await waitFor(() => {
        expect(screen.getByLabelText('Название')).toBeInTheDocument()
        expect(screen.getByLabelText('IP адрес')).toBeInTheDocument()
        expect(screen.getByLabelText('SSH Порт')).toBeInTheDocument()
        expect(screen.getByLabelText('SSH User')).toBeInTheDocument()
        expect(screen.getByLabelText('SSH Пароль')).toBeInTheDocument()
      })
    })

    it('должен отображать переключатель метода аутентификации', async () => {
      setupMockGet()
      renderTunnelsPage()

      const addButton = await screen.findByText('Добавить')
      fireEvent.click(addButton)

      await waitFor(() => {
        expect(screen.getByLabelText('По паролю')).toBeInTheDocument()
        expect(screen.getByLabelText('По SSH ключу')).toBeInTheDocument()
      })
    })

    it('должен переключаться на ввод SSH ключа', async () => {
      setupMockGet()
      renderTunnelsPage()

      const addButton = await screen.findByText('Добавить')
      fireEvent.click(addButton)

      const keyRadio = await screen.findByLabelText('По SSH ключу')
      fireEvent.click(keyRadio)

      await waitFor(() => {
        expect(screen.getByLabelText(/SSH Private Key/i)).toBeInTheDocument()
        expect(screen.queryByLabelText('SSH Пароль')).not.toBeInTheDocument()
      })
    })

    it('должен позволять вводить название сервера', async () => {
      setupMockGet()
      renderTunnelsPage()

      const addButton = await screen.findByText('Добавить')
      fireEvent.click(addButton)

      const nameField = await screen.findByLabelText('Название')
      fireEvent.change(nameField, { target: { value: 'My Server' } })

      expect(nameField).toHaveValue('My Server')
    })

    it('должен позволять вводить IP адрес', async () => {
      setupMockGet()
      renderTunnelsPage()

      const addButton = await screen.findByText('Добавить')
      fireEvent.click(addButton)

      const ipField = await screen.findByLabelText('IP адрес')
      fireEvent.change(ipField, { target: { value: '10.0.0.1' } })

      expect(ipField).toHaveValue('10.0.0.1')
    })

    it('должен позволять вводить SSH порт', async () => {
      setupMockGet()
      renderTunnelsPage()

      const addButton = await screen.findByText('Добавить')
      fireEvent.click(addButton)

      const portField = await screen.findByLabelText('SSH Порт')
      fireEvent.change(portField, { target: { value: '2222' } })

      expect(portField).toHaveValue(2222)
    })

    it('должен позволять вводить SSH пользователя', async () => {
      setupMockGet()
      renderTunnelsPage()

      const addButton = await screen.findByText('Добавить')
      fireEvent.click(addButton)

      const userField = await screen.findByLabelText('SSH User')
      fireEvent.change(userField, { target: { value: 'admin' } })

      expect(userField).toHaveValue('admin')
    })

    it('должен позволять вводить SSH пароль', async () => {
      setupMockGet()
      renderTunnelsPage()

      const addButton = await screen.findByText('Добавить')
      fireEvent.click(addButton)

      const passwordField = await screen.findByLabelText('SSH Пароль')
      fireEvent.change(passwordField, { target: { value: 'secret123' } })

      expect(passwordField).toHaveValue('secret123')
    })
  })

  describe('Валидация формы', () => {
    it('должен показывать ошибку при пустом названии', async () => {
      setupMockGet()
      renderTunnelsPage()

      const addButton = await screen.findByText('Добавить')
      fireEvent.click(addButton)

      const saveButton = await screen.findByText('Сохранить')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Введите название сервера')).toBeInTheDocument()
      })
    })

    it('должен показывать ошибку при пустом IP', async () => {
      setupMockGet()
      renderTunnelsPage()

      const addButton = await screen.findByText('Добавить')
      fireEvent.click(addButton)

      const nameField = await screen.findByLabelText('Название')
      fireEvent.change(nameField, { target: { value: 'Test' } })

      const saveButton = screen.getByText('Сохранить')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Введите IP адрес')).toBeInTheDocument()
      })
    })

    it('должен показывать ошибку при неверном формате IP', async () => {
      setupMockGet()
      renderTunnelsPage()

      const addButton = await screen.findByText('Добавить')
      fireEvent.click(addButton)

      const nameField = await screen.findByLabelText('Название')
      fireEvent.change(nameField, { target: { value: 'Test' } })

      const ipField = await screen.findByLabelText('IP адрес')
      fireEvent.change(ipField, { target: { value: 'invalid-ip' } })

      const saveButton = screen.getByText('Сохранить')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Неверный формат IP адреса')).toBeInTheDocument()
      })
    })

    it('должен показывать ошибку при неверном порте', async () => {
      setupMockGet()
      renderTunnelsPage()

      const addButton = await screen.findByText('Добавить')
      fireEvent.click(addButton)

      const nameField = await screen.findByLabelText('Название')
      fireEvent.change(nameField, { target: { value: 'Test' } })

      const ipField = await screen.findByLabelText('IP адрес')
      fireEvent.change(ipField, { target: { value: '1.1.1.1' } })

      const portField = await screen.findByLabelText('SSH Порт')
      fireEvent.change(portField, { target: { value: '99999' } })

      const saveButton = screen.getByText('Сохранить')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Порт должен быть от 1 до 65535')).toBeInTheDocument()
      })
    })

    it('должен показывать ошибку при пустом пароле', async () => {
      setupMockGet()
      renderTunnelsPage()

      const addButton = await screen.findByText('Добавить')
      fireEvent.click(addButton)

      const nameField = await screen.findByLabelText('Название')
      fireEvent.change(nameField, { target: { value: 'Test' } })

      const ipField = await screen.findByLabelText('IP адрес')
      fireEvent.change(ipField, { target: { value: '1.1.1.1' } })

      const saveButton = screen.getByText('Сохранить')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Введите SSH пароль')).toBeInTheDocument()
      })
    })

    it('должен показывать ошибку при пустом SSH ключе', async () => {
      setupMockGet()
      renderTunnelsPage()

      const addButton = await screen.findByText('Добавить')
      fireEvent.click(addButton)

      const keyRadio = await screen.findByLabelText('По SSH ключу')
      fireEvent.click(keyRadio)

      const nameField = await screen.findByLabelText('Название')
      fireEvent.change(nameField, { target: { value: 'Test' } })

      const ipField = await screen.findByLabelText('IP адрес')
      fireEvent.change(ipField, { target: { value: '1.1.1.1' } })

      const saveButton = screen.getByText('Сохранить')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Введите SSH ключ')).toBeInTheDocument()
      })
    })

    it('должен показывать ошибку при неверном формате SSH ключа', async () => {
      setupMockGet()
      renderTunnelsPage()

      const addButton = await screen.findByText('Добавить')
      fireEvent.click(addButton)

      const keyRadio = await screen.findByLabelText('По SSH ключу')
      fireEvent.click(keyRadio)

      const nameField = await screen.findByLabelText('Название')
      fireEvent.change(nameField, { target: { value: 'Test' } })

      const ipField = await screen.findByLabelText('IP адрес')
      fireEvent.change(ipField, { target: { value: '1.1.1.1' } })

      const keyField = await screen.findByLabelText(/SSH Private Key/i)
      fireEvent.change(keyField, { target: { value: 'invalid-key' } })

      const saveButton = screen.getByText('Сохранить')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Неверный формат SSH ключа')).toBeInTheDocument()
      })
    })
  })

  describe('Создание сервера', () => {
    it('должен создавать сервер с паролем', async () => {
      setupMockGet()
      mockPost.mockResolvedValue({})

      renderTunnelsPage()

      const addButton = await screen.findByText('Добавить')
      fireEvent.click(addButton)

      const nameField = await screen.findByLabelText('Название')
      fireEvent.change(nameField, { target: { value: 'New Server' } })

      const ipField = await screen.findByLabelText('IP адрес')
      fireEvent.change(ipField, { target: { value: '1.2.3.4' } })

      const portField = await screen.findByLabelText('SSH Порт')
      fireEvent.change(portField, { target: { value: '22' } })

      const userField = await screen.findByLabelText('SSH User')
      fireEvent.change(userField, { target: { value: 'root' } })

      const passwordField = await screen.findByLabelText('SSH Пароль')
      fireEvent.change(passwordField, { target: { value: 'secret123' } })

      const saveButton = screen.getByText('Сохранить')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/tunnels', expect.objectContaining({
          name: 'New Server',
          ip: '1.2.3.4',
        }))
      })
    })

    it('должен показывать успех после создания', async () => {
      setupMockGet()
      mockPost.mockResolvedValue({})

      renderTunnelsPage()

      const addButton = await screen.findByText('Добавить')
      fireEvent.click(addButton)

      const nameField = await screen.findByLabelText('Название')
      fireEvent.change(nameField, { target: { value: 'New Server' } })

      const ipField = await screen.findByLabelText('IP адрес')
      fireEvent.change(ipField, { target: { value: '1.2.3.4' } })

      const portField = await screen.findByLabelText('SSH Порт')
      fireEvent.change(portField, { target: { value: '22' } })

      const userField = await screen.findByLabelText('SSH User')
      fireEvent.change(userField, { target: { value: 'root' } })

      const passwordField = await screen.findByLabelText('SSH Пароль')
      fireEvent.change(passwordField, { target: { value: 'secret123' } })

      const saveButton = screen.getByText('Сохранить')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Сервер добавлен')).toBeInTheDocument()
      })
    })

    it('должен закрывать диалог после создания', async () => {
      setupMockGet()
      mockPost.mockResolvedValue({})

      renderTunnelsPage()

      const addButton = await screen.findByText('Добавить')
      fireEvent.click(addButton)

      const nameField = await screen.findByLabelText('Название')
      fireEvent.change(nameField, { target: { value: 'New Server' } })

      const ipField = await screen.findByLabelText('IP адрес')
      fireEvent.change(ipField, { target: { value: '1.2.3.4' } })

      const portField = await screen.findByLabelText('SSH Порт')
      fireEvent.change(portField, { target: { value: '22' } })

      const userField = await screen.findByLabelText('SSH User')
      fireEvent.change(userField, { target: { value: 'root' } })

      const passwordField = await screen.findByLabelText('SSH Пароль')
      fireEvent.change(passwordField, { target: { value: 'secret123' } })

      const saveButton = screen.getByText('Сохранить')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.queryByText('Новый редирект сервер')).not.toBeInTheDocument()
      })
    })

    it('должен очищать форму после создания', async () => {
      setupMockGet()
      mockPost.mockResolvedValue({})

      renderTunnelsPage()

      const addButton = await screen.findByText('Добавить')
      fireEvent.click(addButton)

      const nameField = await screen.findByLabelText('Название')
      fireEvent.change(nameField, { target: { value: 'New Server' } })

      const ipField = await screen.findByLabelText('IP адрес')
      fireEvent.change(ipField, { target: { value: '1.2.3.4' } })

      const portField = await screen.findByLabelText('SSH Порт')
      fireEvent.change(portField, { target: { value: '22' } })

      const userField = await screen.findByLabelText('SSH User')
      fireEvent.change(userField, { target: { value: 'root' } })

      const passwordField = await screen.findByLabelText('SSH Пароль')
      fireEvent.change(passwordField, { target: { value: 'secret123' } })

      const saveButton = screen.getByText('Сохранить')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.queryByText('Новый редирект сервер')).not.toBeInTheDocument()
      })

      fireEvent.click(addButton)
      await waitFor(() => {
        expect(screen.getByLabelText('Название')).toHaveValue('')
        expect(screen.getByLabelText('IP адрес')).toHaveValue('')
      })
    })
  })

  describe('Удаление сервера', () => {
    it('должен открывать диалог подтверждения удаления', async () => {
      const mockTunnels = [
        { id: 1, name: 'Test Server', ip: '1.1.1.1', sshPort: 22, username: 'root', isInstalled: true }
      ]
      setupMockGet({ tunnels: mockTunnels })
      renderTunnelsPage()

      const deleteButton = await screen.findByTestId('icon-Delete')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByText('Удалить сервер из списка?')).toBeInTheDocument()
      })
    })

    it('должен закрывать диалог при клике на "Отмена"', async () => {
      const mockTunnels = [
        { id: 1, name: 'Test Server', ip: '1.1.1.1', sshPort: 22, username: 'root', isInstalled: true }
      ]
      setupMockGet({ tunnels: mockTunnels })
      renderTunnelsPage()

      const deleteButton = await screen.findByTestId('icon-Delete')
      fireEvent.click(deleteButton)

      const cancelButton = await screen.findByText('Отмена')
      fireEvent.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByText('Удалить сервер из списка?')).not.toBeInTheDocument()
      })
    })

    it('должен удалять сервер при подтверждении', async () => {
      const mockTunnels = [
        { id: 1, name: 'Test Server', ip: '1.1.1.1', sshPort: 22, username: 'root', isInstalled: true }
      ]
      setupMockGet({ tunnels: mockTunnels })
      mockDelete.mockResolvedValue({})

      renderTunnelsPage()

      const deleteButton = await screen.findByTestId('icon-Delete')
      fireEvent.click(deleteButton)

      const confirmButton = screen.getByText('Подтвердить')
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith('/tunnels/1')
      })
    })

    it('должен показывать успех после удаления', async () => {
      const mockTunnels = [
        { id: 1, name: 'Test Server', ip: '1.1.1.1', sshPort: 22, username: 'root', isInstalled: true }
      ]
      setupMockGet({ tunnels: mockTunnels })
      mockDelete.mockResolvedValue({})

      renderTunnelsPage()

      const deleteButton = await screen.findByTestId('icon-Delete')
      fireEvent.click(deleteButton)

      const confirmButton = screen.getByText('Подтвердить')
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(screen.getByText('Сервер удалён')).toBeInTheDocument()
      })
    })
  })

  describe('Установка перенаправления', () => {
    it('должен отображать кнопку "Установить" для неустановленного сервера', async () => {
      const mockTunnels = [
        { id: 1, name: 'Test Server', ip: '1.1.1.1', sshPort: 22, username: 'root', isInstalled: false }
      ]
      setupMockGet({ tunnels: mockTunnels })
      renderTunnelsPage()

      await waitFor(() => {
        expect(screen.getByText('Установить')).toBeInTheDocument()
      })
    })

    it('должен открывать диалог подтверждения установки', async () => {
      const mockTunnels = [
        { id: 1, name: 'Test Server', ip: '1.1.1.1', sshPort: 22, username: 'root', isInstalled: false }
      ]
      setupMockGet({ tunnels: mockTunnels })
      renderTunnelsPage()

      const installButton = await screen.findByText('Установить')
      fireEvent.click(installButton)

      await waitFor(() => {
        expect(screen.getByText('Начать установку перенаправления на этот сервер?')).toBeInTheDocument()
      })
    })

    it('должен закрывать диалог установки при клике на "Отмена"', async () => {
      const mockTunnels = [
        { id: 1, name: 'Test Server', ip: '1.1.1.1', sshPort: 22, username: 'root', isInstalled: false }
      ]
      setupMockGet({ tunnels: mockTunnels })
      renderTunnelsPage()

      const installButton = await screen.findByText('Установить')
      fireEvent.click(installButton)

      const cancelButton = await screen.findByText('Отмена')
      fireEvent.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByText('Начать установку перенаправления')).not.toBeInTheDocument()
      })
    })

    it('должен устанавливать перенаправление при подтверждении', async () => {
      const mockTunnels = [
        { id: 1, name: 'Test Server', ip: '1.1.1.1', sshPort: 22, username: 'root', isInstalled: false }
      ]
      setupMockGet({ tunnels: mockTunnels })
      mockPost.mockResolvedValue({})

      renderTunnelsPage()

      const installButton = await screen.findByText('Установить')
      fireEvent.click(installButton)

      const confirmButton = screen.getByText('Подтвердить')
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/tunnels/1/install')
      })
    })

    it('должен показывать успех после установки', async () => {
      const mockTunnels = [
        { id: 1, name: 'Test Server', ip: '1.1.1.1', sshPort: 22, username: 'root', isInstalled: false }
      ]
      setupMockGet({ tunnels: mockTunnels })
      mockPost.mockResolvedValue({})

      renderTunnelsPage()

      const installButton = await screen.findByText('Установить')
      fireEvent.click(installButton)

      const confirmButton = screen.getByText('Подтвердить')
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(screen.getByText('Скрипт успешно установлен! Трафик перенаправляется.')).toBeInTheDocument()
      })
    })

    it('должен показывать ошибку при неудачной установке', async () => {
      const mockTunnels = [
        { id: 1, name: 'Test Server', ip: '1.1.1.1', sshPort: 22, username: 'root', isInstalled: false }
      ]
      setupMockGet({ tunnels: mockTunnels })
      mockPost.mockRejectedValue({ response: { data: { message: 'Ошибка подключения' } } })

      renderTunnelsPage()

      const installButton = await screen.findByText('Установить')
      fireEvent.click(installButton)

      const confirmButton = screen.getByText('Подтвердить')
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(screen.getByText('Ошибка: Ошибка подключения')).toBeInTheDocument()
      })
    })
  })
})
