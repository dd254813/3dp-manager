import React, { useEffect, useState, useCallback } from 'react';
import { Box, TextField, Button, Typography, Paper, Snackbar, Alert, Grid, Divider, InputAdornment, Stack, Chip, Tooltip, IconButton, useTheme, useMediaQuery, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, FormControlLabel, Checkbox } from '@mui/material';
import api from '../api';
import { CheckCircle, PauseCircleFilled, PlayCircleFilled, Refresh } from '@mui/icons-material';
import { Logger } from '../utils/logger';

const ROTATION_PRESETS = [
  { label: 'Сутки', value: 1440 },
  { label: '3 дня', value: 4320 },
  { label: 'Неделя', value: 10080 },
];

interface Subscription {
  id: string;
  name: string;
  uuid: string;
  isAutoRotationEnabled?: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    xui_url: '',
    xui_login: '',
    xui_password: '',
    rotation_interval: '30',
    rotation_status: 'active',
    last_rotation_timestamp: '',
  });

  const [adminProfile, setAdminProfile] = useState({
    login: '',
    password: '',
  });

  const [subs, setSubs] = useState<Subscription[]>([]);

  const [msg, setMsg] = useState({ open: false, type: 'success' as 'success' | 'error', text: '' });
  const [loadingRotate, setLoadingRotate] = useState<boolean>(false);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false, title: '', onConfirm: () => {},
    confirmText: 'Удалить', confirmColor: 'error' as 'error' | 'primary'
  });
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const loadSettings = useCallback(async () => {
    try {
      Logger.debug('Loading settings...', 'Settings');
      const { data } = await api.get('/settings');
      Logger.debug('Settings API response', 'Settings', data);
      setSettings((prev) => ({ ...prev, ...data }));
      Logger.debug('Settings after update', 'Settings', {
        rotation_interval: data.rotation_interval,
        prev_interval: prev => prev.rotation_interval
      });

      if (data.admin_login) {
        setAdminProfile((prev) => ({ ...prev, login: data.admin_login }));
      }
      Logger.debug('Settings loaded successfully', 'Settings');
    } catch (error) {
      Logger.error('Failed to load', 'Settings', error);
    }
  }, []);

  const loadSubscriptions = useCallback(async () => {
    try {
      Logger.debug('Loading subscriptions...', 'Settings');
      const { data } = await api.get('/subscriptions');
      setSubs(data);
      Logger.debug(`Loaded ${data.length} subscriptions`, 'Settings');
    } catch (error) {
      Logger.error('Failed to load subscriptions', 'Settings', error);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadSubscriptions();
  }, [loadSettings, loadSubscriptions]);

  const getIntervalError = () => {
    const val = parseInt(settings.rotation_interval, 10);
    if (isNaN(val) || val < 10) {
      return 'Минимальный интервал — 10 минут';
    }
    return '';
  };

  const cleanData = () => {
    const cleaned = { ...settings };

    if (cleaned.xui_url) {
      cleaned.xui_url = cleaned.xui_url.replace(/\/+$/, '');
    }

    if (cleaned.xui_login) cleaned.xui_login = cleaned.xui_login.trim();
    if (cleaned.xui_password) cleaned.xui_password = cleaned.xui_password.trim();

    setSettings(prev => ({ ...prev, ...cleaned }));

    return cleaned;
  };

  const handleCheckConnection = async () => {
    const data = cleanData();

    try {
      Logger.debug(`Checking connection to: ${data.xui_url}`, 'Settings');
      setMsg({ open: true, type: 'success', text: 'Проверка...' });
      const res = await api.post('/settings/check', {
        xui_url: data.xui_url,
        xui_login: data.xui_login,
        xui_password: data.xui_password
      });

      if (res.data.success) {
        Logger.debug('Connection check: SUCCESS', 'Settings');
        setMsg({
          open: true,
          type: 'success',
          text: 'Подключение успешно!'
        });
      } else {
        Logger.warn('Connection check: FAILED', 'Settings', res.data);
        setMsg({
          open: true,
          type: 'error',
          text: 'Ошибка: Неверные данные или нет доступа'
        });
      }
    } catch (error) {
      Logger.error('Connection check error', 'Settings', error);
      setMsg({ open: true, type: 'error', text: 'Ошибка сети при проверке' });
    }
  };

  const handleSettingChange = useCallback((prop: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prev => ({ ...prev, [prop]: event.target.value }));
  }, []);

  const handlePresetClick = (minutes: number) => {
    setSettings(prev => ({ ...prev, rotation_interval: minutes.toString() }));
  };

  const handleSaveSettings = async () => {
    // Валидация полей подключения к 3x-ui
    if (!settings.xui_url || !settings.xui_login || !settings.xui_password) {
      setMsg({
        open: true,
        text: 'Заполните все поля подключения к 3x-ui (URL, логин, пароль)',
        type: 'error'
      });
      return;
    }

    if (getIntervalError()) {
      setMsg({ open: true, text: 'Исправьте ошибки перед сохранением', type: 'error' });
      return;
    }

    const data = cleanData();

    try {
      Logger.debug('Saving settings', 'Settings', {
        xui_url: data.xui_url ? '***' : 'empty',
        xui_login: data.xui_login,
        rotation_interval: data.rotation_interval
      });
      await api.post('/settings', data);
      Logger.debug('Settings saved successfully', 'Settings');
      setMsg({ open: true, type: 'success', text: 'Настройки сохранены!' });
    } catch (error) {
      Logger.error('Save error', 'Settings', error);
      setMsg({ open: true, type: 'error', text: 'Ошибка сохранения' });
    }
  };

  const handleSaveInterval = async () => {
    if (getIntervalError()) {
      setMsg({ open: true, text: 'Неверный интервал (минимум 10 минут)', type: 'error' });
      return;
    }

    try {
      Logger.debug('Saving rotation interval', 'Settings', {
        rotation_interval: settings.rotation_interval
      });
      await api.post('/settings', {
        rotation_interval: settings.rotation_interval
      });
      Logger.debug('Rotation interval saved successfully', 'Settings');
      setMsg({ open: true, type: 'success', text: 'Интервал генерации применён!' });
    } catch (error) {
      Logger.error('Save interval error', 'Settings', error);
      setMsg({ open: true, type: 'error', text: 'Ошибка сохранения интервала' });
    }
  };

  const handleAdminChange = useCallback((prop: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setAdminProfile(prev => ({ ...prev, [prop]: event.target.value }));
  }, []);

  const handleSaveAdmin = async () => {
    try {
      Logger.debug('Updating admin profile', 'Settings', { login: adminProfile.login });
      await api.post('/auth/update-profile', adminProfile);
      Logger.debug('Admin profile updated', 'Settings');
      setMsg({ open: true, type: 'success', text: 'Профиль администратора обновлен!' });
      setAdminProfile(prev => ({ ...prev, password: '' }));
    } catch (error) {
      Logger.error('Update admin profile error', 'Settings', error);
      setMsg({ open: true, type: 'error', text: 'Ошибка обновления профиля' });
    }
  };

  const handleForceRotate = async () => {
    setConfirmDialog({
      open: true,
      title: 'ВНИМАНИЕ: Это немедленно обновит конфиги в подписках.\n\nИнтервал автоматической ротации НЕ будет сброшен.\n\nПродолжить?',
      confirmText: 'Сгенерировать',
      confirmColor: 'primary',
      onConfirm: async () => {
        try {
          Logger.debug('Starting forced rotation', 'Rotation');
          setLoadingRotate(true);
          const res = await api.post('/rotation/rotate-all');

          setLoadingRotate(false);
          if (res.data && res.data.success) {
            Logger.debug('Rotation completed successfully', 'Rotation');
            setMsg({ open: true, type: 'success', text: res.data.message || 'Ротация успешно выполнена!' });
          } else {
            Logger.warn('Rotation completed with issues', 'Rotation', res.data?.message);
            setMsg({
              open: true,
              type: 'error',
              text: res.data?.message || 'Ошибка выполнения ротации'
            });
          }
        } catch (error) {
          setLoadingRotate(false);
          Logger.error('Rotation error', 'Rotation', error);
          setMsg({ open: true, type: 'error', text: 'Ошибка сети или сервера' });
        }
      }
    });
  };

  const handleToggleAutoRotation = async (subscriptionId: string, enabled: boolean) => {
    try {
      await api.put('/subscriptions/bulk-auto-rotation', {
        subscriptionIds: [subscriptionId],
        enabled
      });
      setSubs(prev => prev.map(s =>
        s.id === subscriptionId ? { ...s, isAutoRotationEnabled: enabled } : s
      ));
      setMsg({
        open: true,
        type: 'success',
        text: enabled ? 'Авторотация включена' : 'Авторотация выключена'
      });
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Ошибка обновления';
      Logger.error(`Toggle auto-rotation error: ${message}`, 'Settings');
      setMsg({ open: true, type: 'error', text: message });
      loadSubscriptions();
    }
  };

  const handleManualRotate = async (sub: Subscription) => {
    setConfirmDialog({
      open: true,
      title: `Обновить подписку "${sub.name}" сейчас?`,
      confirmText: 'Обновить',
      confirmColor: 'primary',
      onConfirm: async () => {
        try {
          Logger.debug(`Starting manual rotation for subscription: ${sub.id}`, 'Settings');
          const res = await api.post(`/rotation/rotate-one/${sub.id}`);
          Logger.debug('Manual rotation completed', 'Settings');
          setMsg({ open: true, type: 'success', text: res.data.message || 'Ротация выполнена' });
          loadSubscriptions();
        } catch (error: unknown) {
          const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Ошибка ротации';
          Logger.error(`Manual rotation error: ${message}`, 'Settings');
          setMsg({ open: true, type: 'error', text: message });
        }
      }
    });
  };

  const handleBulkUpdate = async (enabled: boolean) => {
    try {
      const { data } = await api.put('/subscriptions/bulk-auto-rotation', {
        subscriptionIds: subs.map(s => s.id),
        enabled
      });
      setMsg({ open: true, type: 'success', text: data.message || 'Настройки обновлены' });
      loadSubscriptions();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Ошибка обновления';
      Logger.error(`Bulk update error: ${message}`, 'Settings');
      setMsg({ open: true, type: 'error', text: message });
    }
  };

  const togglePause = async () => {
    const newStatus = settings.rotation_status === 'active' ? 'stopped' : 'active';
    const updatedSettings = { ...settings, rotation_status: newStatus };

    Logger.debug(`Toggling rotation status: ${settings.rotation_status} → ${newStatus}`, 'Settings');
    setSettings(updatedSettings);

    try {
      await api.post('/settings', updatedSettings);
      Logger.debug('Rotation status updated', 'Settings');
    } catch (error) {
      Logger.error('Toggle pause error', 'Settings', error);
      setSettings((prev) => ({ ...prev, rotation_status: prev.rotation_status }));
      setMsg({ open: true, type: 'error', text: 'Не удалось изменить статус' });
    }
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return 'Нет данных';
    return new Date(+isoString).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getNextRotationDate = () => {
    if (settings.rotation_status === 'stopped') return 'Пауза';
    if (!settings.last_rotation_timestamp) return 'Ожидание...';

    const last = new Date(+settings.last_rotation_timestamp);
    const intervalMinutes = parseInt(settings.rotation_interval) || 60;
    const next = new Date(last.getTime() + intervalMinutes * 60000);

    return next.toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const isPaused = settings.rotation_status === 'stopped';

  return (
    <Box>
      <Typography variant={isMobile ? 'h5' : 'h4'} gutterBottom>Настройки утилиты</Typography>

      <Grid container spacing={3}>

        <Grid size={{ xs: 12 }}>
          <Grid container spacing={1}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                Статус сервиса
              </Typography>
              {isPaused ?
                <Chip icon={<PauseCircleFilled />} label="Остановлен" color="warning" size="small" variant="outlined" /> :
                <Chip icon={<CheckCircle />} label="Активен" color="success" size="small" variant="outlined" />
              }

              <Tooltip title={isPaused ? "Возобновить ротацию" : "Поставить на паузу"}>
                <IconButton
                  onClick={togglePause}
                  size="small"
                  sx={{
                    bgcolor: 'background.paper',
                    boxShadow: 2,
                    '&:hover': { bgcolor: 'background.paper' },
                    ml: 1
                  }}
                >
                  {isPaused ? <PlayCircleFilled fontSize="large" /> : <PauseCircleFilled fontSize="large" />}
                </IconButton>
              </Tooltip>
            </Grid>
            {/* Последняя генерация */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">
                    Последняя генерация
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, mt: 2 }}>
                    {formatDate(settings.last_rotation_timestamp)}
                  </Typography>
                </Box>
              </Stack>
            </Grid>

            {/* Следующая генерация */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">
                    Следующая генерация
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, mt: 2 }}>
                    {getNextRotationDate()}
                  </Typography>
                </Box>
              </Stack>
            </Grid>
          </Grid>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>Панель 3x-ui</Typography>
            <Divider sx={{ mb: 2 }} />

            <TextField
              fullWidth margin="normal" label="URL панели"
              value={settings.xui_url} onChange={handleSettingChange('xui_url')}
              helperText="Например: https://my-vpn.com:2053/wfgpoVHaOF"
            />
            <TextField
              fullWidth margin="normal" label="Логин 3x-ui"
              value={settings.xui_login} onChange={handleSettingChange('xui_login')}
            />
            <TextField
              fullWidth margin="normal" label="Пароль 3x-ui" type="password"
              value={settings.xui_password} onChange={handleSettingChange('xui_password')}
            />

            <Button variant="contained" sx={{ mt: 2 }} onClick={handleSaveSettings}>
              Сохранить подключение
            </Button>
            {settings.xui_url && settings.xui_login && settings.xui_password && (
              <Button
                variant="outlined"
                color="info"
                sx={{ mt: 2, ml: isMobile ? 1 : 2 }}
                onClick={handleCheckConnection}
              >
                Проверить
              </Button>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Генерация инбаундов</Typography>
              <Divider sx={{ mb: 2 }} />

              <TextField
                fullWidth margin="normal" label="Интервал генерации"
                type="number"
                value={settings.rotation_interval}
                onChange={handleSettingChange('rotation_interval')}
                slotProps={{
                  input: { endAdornment: <InputAdornment position="end">мин</InputAdornment> }
                }}
                helperText="Как часто менять инбаунды (минимум 10 мин)"
              />
              <Stack direction="row" spacing={1} sx={{ mt: 1, mb: 2 }}>
                {ROTATION_PRESETS.map((preset) => (
                  <Chip
                    key={preset.value}
                    label={preset.label}
                    onClick={() => handlePresetClick(preset.value)}
                    color={settings.rotation_interval === preset.value.toString() ? "primary" : "default"}
                    variant={settings.rotation_interval === preset.value.toString() ? "filled" : "outlined"}
                    clickable
                  />
                ))}
              </Stack>
              <Button variant="contained" sx={{ mt: 2 }} onClick={handleSaveInterval}>
                Применить интервал
              </Button>
              <Button
                variant="outlined"
                loading={loadingRotate}
                color="warning"
                onClick={handleForceRotate}
                sx={{ mt: 2, ml: isMobile ? 0 : 2 }}
              >
                Сгенерировать сейчас
              </Button>

              <Divider sx={{ my: 3 }} />

              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                Управление авторотацией подписок
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Выберите подписки для автоматической ротации:
              </Typography>

              {subs.length === 0 ? (
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  Нет активных подписок
                </Typography>
              ) : (
                <List sx={{ maxHeight: 400, overflow: 'auto', bgcolor: 'background.default', borderRadius: 1 }}>
                  {subs.map(sub => (
                    <ListItem
                      key={sub.id}
                      sx={{
                        py: 1,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        '&:last-child': { borderBottom: 'none' }
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={sub.isAutoRotationEnabled ?? true}
                            onChange={(e) => handleToggleAutoRotation(sub.id, e.target.checked)}
                            color="primary"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{sub.name}</Typography>
                            <Typography variant="caption" color="textSecondary">
                              {sub.uuid.substring(0, 8)}...
                            </Typography>
                          </Box>
                        }
                        sx={{ flexGrow: 1 }}
                      />
                      <Tooltip title="Обновить подписку вручную">
                        <IconButton
                          size="small"
                          onClick={() => handleManualRotate(sub)}
                          color="primary"
                        >
                          <Refresh />
                        </IconButton>
                      </Tooltip>
                    </ListItem>
                  ))}
                </List>
              )}

              {subs.length > 0 && (
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleBulkUpdate(true)}
                  >
                    Включить для всех
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleBulkUpdate(false)}
                  >
                    Выключить для всех
                  </Button>
                </Box>
              )}
            </Paper>

            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Доступ к 3DP-MANAGER</Typography>
              <Divider sx={{ mb: 2 }} />

              <TextField
                fullWidth margin="normal" label="Логин администратора"
                value={adminProfile.login}
                onChange={handleAdminChange('login')}
              />
              <TextField
                fullWidth margin="normal" label="Новый пароль" type="password"
                value={adminProfile.password}
                onChange={handleAdminChange('password')}
                helperText="Оставьте пустым, если не хотите менять"
              />
              <Button variant="contained" color="warning" sx={{ mt: 2 }} onClick={handleSaveAdmin}>
                Обновить профиль
              </Button>
            </Paper>

          </Box>
        </Grid>
      </Grid>

      <Snackbar open={msg.open} autoHideDuration={5000} onClose={() => setMsg({ ...msg, open: false })}>
        <Alert severity={msg.type}>{msg.text}</Alert>
      </Snackbar>

      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}>
        <DialogTitle>Подтверждение действия</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.title}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
            Отмена
          </Button>
          <Button
            onClick={() => {
              setConfirmDialog({ ...confirmDialog, open: false });
              confirmDialog.onConfirm();
            }}
            variant="contained"
            color={confirmDialog.confirmColor}
          >
            {confirmDialog.confirmText}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}