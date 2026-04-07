import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Button, Typography, Paper, Table, TableBody, TableCell,
  TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, TextField, DialogActions, Chip, CircularProgress,
  useTheme,
  useMediaQuery,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  Snackbar,
  Alert
} from '@mui/material';
import { Delete, Add, Terminal, CheckCircle, Error, Dns } from '@mui/icons-material';
import api from '../api';
import { getApiErrorMessage } from '../utils/errorHandlers';
import { Logger } from '../utils/logger';

interface Tunnel {
  id: number;
  name: string;
  ip: string;
  sshPort: number;
  username: string;
  isInstalled: boolean;
}

export default function TunnelsPage() {
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [open, setOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [authMethod, setAuthMethod] = useState<'password' | 'key'>('password');

  const [form, setForm] = useState({
    name: '', ip: '', sshPort: 22, username: 'root', password: '', privateKey: '', domain: ''
  });

  // Snackbar state for notifications
  const [snackbar, setSnackbar] = useState({ open: false, type: 'success' as 'success' | 'error', message: '' });

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', onConfirm: () => {} });

  // Form validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!form.name.trim()) {
      errors.name = 'Введите название сервера';
    }

    if (!form.ip.trim()) {
      errors.ip = 'Введите IP адрес';
    } else {
      // IPv4 validation
      const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      // IPv6 basic validation
      const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,7}:$|^([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}$|^([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}$|^([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}$|^([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})$|^:((:[0-9a-fA-F]{1,4}){1,7}|:)$/;
      
      if (!ipv4Regex.test(form.ip) && !ipv6Regex.test(form.ip)) {
        errors.ip = 'Неверный формат IP адреса';
      }
    }

    if (!form.sshPort || form.sshPort < 1 || form.sshPort > 65535) {
      errors.sshPort = 'Порт должен быть от 1 до 65535';
    }

    if (!form.username.trim()) {
      errors.username = 'Введите SSH пользователя';
    }

    if (authMethod === 'password' && !form.password) {
      errors.password = 'Введите SSH пароль';
    }

    if (authMethod === 'key' && !form.privateKey.trim()) {
      errors.privateKey = 'Введите SSH ключ';
    } else if (authMethod === 'key' && !form.privateKey.includes('-----BEGIN')) {
      errors.privateKey = 'Неверный формат SSH ключа';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const loadTunnels = useCallback(async () => {
    try {
      Logger.debug('Loading tunnels...', 'Tunnels');
      const { data } = await api.get('/tunnels');
      setTunnels(data);
      Logger.debug(`Loaded ${data.length} tunnels`, 'Tunnels');
    } catch (error) {
      Logger.error('Failed to load', 'Tunnels', error);
    }
  }, []);

  useEffect(() => { loadTunnels(); }, [loadTunnels]);

  const handleCreate = async () => {
    if (!validateForm()) {
      setSnackbar({ open: true, type: 'error', message: 'Исправьте ошибки в форме' });
      return;
    }

    const payload = {
      ...form,
      password: authMethod === 'password' ? form.password : null,
      privateKey: authMethod === 'key' ? form.privateKey : null,
    };

    Logger.debug(`Creating tunnel`, 'Tunnels', { name: form.name, ip: form.ip });
    await api.post('/tunnels', payload);
    Logger.debug('Tunnel created successfully', 'Tunnels');
    setOpen(false);
    setForm({ name: '', ip: '', sshPort: 22, username: 'root', password: '', privateKey: '', domain: '' });
    setAuthMethod('password');
    setFormErrors({});
    loadTunnels();
    setSnackbar({ open: true, type: 'success', message: 'Сервер добавлен' });
  };

  const handleDelete = async (id: number) => {
    setConfirmDialog({
      open: true,
      title: 'Удалить сервер из списка?',
      onConfirm: async () => {
        Logger.debug(`Deleting tunnel ID: ${id}`, 'Tunnels');
        await api.delete(`/tunnels/${id}`);
        Logger.debug(`Deleted tunnel ID: ${id}`, 'Tunnels');
        loadTunnels();
        setSnackbar({ open: true, type: 'success', message: 'Сервер удалён' });
      }
    });
  };

  const handleInstall = async (id: number) => {
    setConfirmDialog({
      open: true,
      title: 'Начать установку перенаправления на этот сервер?',
      onConfirm: async () => {
        Logger.debug(`Installing forwarding on tunnel ID: ${id}`, 'Tunnels');
        setLoadingId(id);
        try {
          await api.post(`/tunnels/${id}/install`);
          Logger.debug('Forwarding installed successfully', 'Tunnels');
          setSnackbar({ open: true, type: 'success', message: 'Скрипт успешно установлен! Трафик перенаправляется.' });
          loadTunnels();
        } catch (e) {
          const message = getApiErrorMessage(e, 'Неизвестная ошибка');
          Logger.error(`Install error on ID ${id}: ${message}`, 'Tunnels');
          setSnackbar({ open: true, type: 'error', message: 'Ошибка: ' + message });
        } finally {
          setLoadingId(null);
        }
      }
    });
  };

  const handleChange = useCallback((prop: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [prop]: e.target.value }));
  }, []);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant={isMobile ? 'h5' : 'h4'}>Relay серверы</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>Добавить</Button>
      </Box>

      <Paper sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Название</TableCell>
              <TableCell>Адрес</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell align="right">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tunnels.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.name}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Dns fontSize="small" color="action" />
                    {t.ip}
                  </Box>
                </TableCell>
                <TableCell>
                  {!isMobile && (t.isInstalled ?
                    <Chip icon={<CheckCircle />} label={"Активен"} color="success" size="small" variant="outlined" /> :
                    <Chip icon={<Error />} label={"Не настроен"} color="warning" size="small" variant="outlined" />
                  )}
                  {isMobile && (t.isInstalled ?
                    <CheckCircle color='success' /> :
                    <Error color='warning' />
                  )}
                </TableCell>
                <TableCell align="right">
                  {!t.isInstalled && (
                    <>
                      {isMobile ? (
                        <IconButton disabled={loadingId !== null} color="primary" onClick={() => handleInstall(t.id)}>
                          {loadingId === t.id ? <CircularProgress size={20} /> : <Terminal />}
                        </IconButton>
                      ) : (
                        <Button
                          startIcon={loadingId === t.id ? <CircularProgress size={20} /> : <Terminal />}
                          disabled={loadingId !== null}
                          onClick={() => handleInstall(t.id)}
                          sx={{ mr: 1 }}
                          variant="outlined"
                          size="small"
                        >
                          {isMobile ? '' : (loadingId === t.id ? 'Установка...' : 'Установить')}
                        </Button>
                      )}
                    </>
                  )}
                  <IconButton color="inherit" onClick={() => handleDelete(t.id)}>
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {tunnels.length === 0 && <TableRow><TableCell colSpan={4} align="center" sx={{ color: 'text.secondary' }}>Нет серверов</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Новый редирект сервер</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="Название"
            fullWidth
            value={form.name}
            onChange={handleChange('name')}
            error={!!formErrors.name}
            helperText={formErrors.name}
          />
          <TextField
            margin="dense"
            label="IP адрес"
            fullWidth
            value={form.ip}
            onChange={handleChange('ip')}
            error={!!formErrors.ip}
            helperText={formErrors.ip}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              margin="dense"
              label="SSH Порт"
              type="number"
              fullWidth
              value={form.sshPort}
              onChange={handleChange('sshPort')}
              error={!!formErrors.sshPort}
              helperText={formErrors.sshPort}
            />
            <TextField
              margin="dense"
              label="SSH User"
              fullWidth
              value={form.username}
              onChange={handleChange('username')}
              error={!!formErrors.username}
              helperText={formErrors.username}
            />
          </Box>
          <FormControl component="fieldset" sx={{ mt: 2, mb: 1 }}>
            <RadioGroup row value={authMethod} onChange={(e) => setAuthMethod(e.target.value as 'password' | 'key')}>
              <FormControlLabel value="password" control={<Radio />} label="По паролю" />
              <FormControlLabel value="key" control={<Radio />} label="По SSH ключу" />
            </RadioGroup>
          </FormControl>

          {authMethod === 'password' ? (
            <TextField
              margin="dense"
              label="SSH Пароль"
              type="password"
              fullWidth
              value={form.password}
              onChange={handleChange('password')}
              error={!!formErrors.password}
              helperText={formErrors.password}
            />
          ) : (
            <TextField
              margin="dense"
              label="SSH Private Key (RSA / Ed25519)"
              multiline
              rows={4}
              fullWidth
              value={form.privateKey}
              onChange={handleChange('privateKey')}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
              slotProps={{ input: { style: { fontFamily: 'monospace', fontSize: '0.875rem' } } }}
              error={!!formErrors.privateKey}
              helperText={formErrors.privateKey}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleCreate}>Сохранить</Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}>
        <DialogTitle>Подтверждение</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.title}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>Отмена</Button>
          <Button
            onClick={() => {
              confirmDialog.onConfirm();
              setConfirmDialog({ ...confirmDialog, open: false });
            }}
            variant="contained"
            color="error"
          >
            Подтвердить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.type}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}