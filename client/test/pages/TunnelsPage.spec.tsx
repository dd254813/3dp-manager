import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TunnelsPage from '../../src/pages/TunnelsPage'
import api from '../../src/api'

vi.mock('../../src/api')

describe('TunnelsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    vi.mocked(api.delete).mockResolvedValue({ data: {} })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const renderPage = async () => {
    const result = render(
      <MemoryRouter>
        <TunnelsPage />
      </MemoryRouter>
    )
    // Ждём завершения первоначальной загрузки данных
    await waitFor(() => {
      expect(screen.getByText('Relay серверы')).toBeInTheDocument()
    })
    return result
  }

  it('должен рендериться с заголовком', async () => {
    await renderPage()
    expect(screen.getByText('Relay серверы')).toBeInTheDocument()
  })

  it('должен отображать кнопку "Добавить"', async () => {
    await renderPage()
    expect(screen.getByText('Добавить')).toBeInTheDocument()
  })

  it('должен открывать диалог создания при клике на "Добавить"', async () => {
    await renderPage()
    const addButton = screen.getByText('Добавить')
    fireEvent.click(addButton)

    expect(screen.getByText('Новый редирект сервер')).toBeInTheDocument()
  })

  it('должен закрывать диалог создания при клике на отмену', async () => {
    await renderPage()
    const addButton = screen.getByText('Добавить')
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByText('Новый редирект сервер')).toBeInTheDocument()
    })

    const cancelButton = screen.getByText('Отмена')
    fireEvent.click(cancelButton)

    await waitFor(() => {
      expect(screen.queryByText('Новый редирект сервер')).not.toBeInTheDocument()
    })
  })

  it('должен отображать поля формы в диалоге создания', async () => {
    await renderPage()
    const addButton = screen.getByText('Добавить')
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByLabelText('Название')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('IP адрес')).toBeInTheDocument()
    expect(screen.getByLabelText('SSH Порт')).toBeInTheDocument()
    expect(screen.getByLabelText('SSH User')).toBeInTheDocument()
  })

  it('должен переключать режим аутентификации между паролем и ключом', async () => {
    await renderPage()
    const addButton = screen.getByText('Добавить')
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByLabelText('SSH Пароль')).toBeInTheDocument()
    })

    const keyRadio = screen.getByLabelText('По SSH ключу')
    fireEvent.click(keyRadio)

    await waitFor(() => {
      expect(screen.getByLabelText(/SSH Private Key/i)).toBeInTheDocument()
    })
  })

  it('должен показывать сообщение "Нет серверов" при пустом списке', async () => {
    await renderPage()
    expect(screen.getByText('Нет серверов')).toBeInTheDocument()
  })

  it('должен отображать список туннелей', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        { id: 1, name: 'Test Tunnel', ip: '192.168.1.1', sshPort: 22, username: 'root', isInstalled: true }
      ]
    })

    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('Test Tunnel')).toBeInTheDocument()
    })
    expect(screen.getByText('192.168.1.1')).toBeInTheDocument()
  })

  it('должен отображать статус "Активен" для установленного туннеля', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        { id: 1, name: 'Active Tunnel', ip: '192.168.1.1', sshPort: 22, username: 'root', isInstalled: true }
      ]
    })

    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('Активен')).toBeInTheDocument()
    })
  })

  it('должен отображать статус "Не настроен" для неустановленного туннеля', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        { id: 1, name: 'Inactive Tunnel', ip: '192.168.1.1', sshPort: 22, username: 'root', isInstalled: false }
      ]
    })

    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('Не настроен')).toBeInTheDocument()
    })
  })

  it('должен отображать кнопку "Установить" для неустановленного туннеля', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        { id: 1, name: 'Tunnel', ip: '192.168.1.1', sshPort: 22, username: 'root', isInstalled: false }
      ]
    })

    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('Установить')).toBeInTheDocument()
    })
  })

  it('должен открывать диалог подтверждения при удалении туннеля', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        { id: 1, name: 'Tunnel', ip: '192.168.1.1', sshPort: 22, username: 'root', isInstalled: true }
      ]
    })

    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('Tunnel')).toBeInTheDocument()
    })

    const deleteButton = screen.getAllByTestId('icon-Delete')[0]
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(screen.getByText('Удалить сервер из списка?')).toBeInTheDocument()
    })
  })

  it('должен закрывать диалог подтверждения при клике на "Отмена"', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        { id: 1, name: 'Tunnel', ip: '192.168.1.1', sshPort: 22, username: 'root', isInstalled: true }
      ]
    })

    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('Tunnel')).toBeInTheDocument()
    })

    const deleteButton = screen.getAllByTestId('icon-Delete')[0]
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(screen.getByText('Удалить сервер из списка?')).toBeInTheDocument()
    })

    const cancelButton = screen.getByText('Отмена')
    fireEvent.click(cancelButton)

    await waitFor(() => {
      expect(screen.queryByText('Удалить сервер из списка?')).not.toBeInTheDocument()
    })
  })
})
