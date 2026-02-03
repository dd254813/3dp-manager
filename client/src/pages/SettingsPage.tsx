import React, { useEffect, useState } from 'react';
import { Box, TextField, Button, Typography, Paper, Snackbar, Alert, Grid, Divider, InputAdornment, Stack, Chip, Tooltip, IconButton } from '@mui/material';
import api from '../api';
import { CheckCircle, PauseCircleFilled, PlayCircleFilled, Schedule, Update } from '@mui/icons-material';

const ROTATION_PRESETS = [
  { label: 'Сутки', value: 1440 },
  { label: '3 дня', value: 4320 },
  { label: 'Неделя', value: 10080 },
];

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

  const [msg, setMsg] = useState({ open: false, type: 'success' as 'success' | 'error', text: '' });
  const [intervalError, setIntervalError] = useState<string>('');
  const [loadingRotate, setLoadingRotate] = useState<boolean>(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const val = parseInt(settings.rotation_interval, 10);
    if (isNaN(val) || val < 10) {
      setIntervalError('Минимальный интервал — 10 минут');
    } else {
      setIntervalError('');
    }
  }, [settings.rotation_interval]);

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
    const data = cleanData(); // Сначала чистим

    try {
      setMsg({ open: true, type: 'success', text: 'Проверка...' });
      const res = await api.post('/settings/check', {
        xui_url: data.xui_url,
        xui_login: data.xui_login,
        xui_password: data.xui_password
      });

      if (res.data.success) {
        setMsg({ open: true, type: 'success', text: 'Подключение успешно!' });
      } else {
        setMsg({ open: true, type: 'error', text: 'Ошибка: Неверные данные или нет доступа' });
      }
    } catch (e) {
      setMsg({ open: true, type: 'error', text: 'Ошибка сети при проверке' });
    }
  };

  const loadSettings = async () => {
    try {
      const { data } = await api.get('/settings');
      setSettings((prev) => ({ ...prev, ...data }));

      if (data.admin_login) {
        setAdminProfile((prev) => ({ ...prev, login: data.admin_login }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSettingChange = (prop: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, [prop]: event.target.value });
  };

  const handlePresetClick = (minutes: number) => {
    setSettings(prev => ({ ...prev, rotation_interval: minutes.toString() }));
  };

  const handleSaveSettings = async () => {
    if (intervalError) {
      setMsg({ open: true, text: 'Исправьте ошибки перед сохранением', type: 'error' });
      return;
    }

    const data = cleanData();

    try {
      await api.post('/settings', data);
      setMsg({ open: true, type: 'success', text: 'Настройки сохранены!' });
    } catch (e) {
      setMsg({ open: true, type: 'error', text: 'Ошибка сохранения' });
    }
  };

  const handleAdminChange = (prop: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setAdminProfile({ ...adminProfile, [prop]: event.target.value });
  };

  const handleSaveAdmin = async () => {
    try {
      await api.post('/auth/update-profile', adminProfile);
      setMsg({ open: true, type: 'success', text: 'Профиль администратора обновлен!' });
      setAdminProfile(prev => ({ ...prev, password: '' }));
    } catch (e) {
      setMsg({ open: true, type: 'error', text: 'Ошибка обновления профиля' });
    }
  };

  const handleForceRotate = async () => {
    if (confirm('ВНИМАНИЕ: Это немедленно обновит конфиги в подписках.\n\nИнтервал автоматической ротации НЕ будет сброшен.\n\nПродолжить?')) {
      try {
        setLoadingRotate(true);
        const res = await api.post('/rotation/rotate-all');

        setLoadingRotate(false);
        if (res.data && res.data.success) {
          setMsg({ open: true, type: 'success', text: res.data.message || 'Ротация успешно выполнена!' });
        } else {
          setMsg({
            open: true,
            type: 'error',
            text: res.data?.message || 'Ошибка выполнения ротации'
          });
        }
      } catch (e) {
        setLoadingRotate(false);
        setMsg({ open: true, type: 'error', text: 'Ошибка сети или сервера' });
      }
    }
  };

  const togglePause = async () => {
    const newStatus = settings.rotation_status === 'active' ? 'stopped' : 'active';
    const updatedSettings = { ...settings, rotation_status: newStatus };

    setSettings(updatedSettings);

    try {
      await api.post('/settings', updatedSettings);

    } catch (e) {
      setSettings((prev: any) => ({ ...prev, rotation_status: settings.rotation_status }));
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
      <Typography variant="h4" gutterBottom>Настройки утилиты</Typography>

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
                sx={{ mt: 2, ml: 2 }}
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
              <Button variant="contained" sx={{ mt: 2 }} onClick={handleSaveSettings}>
                Применить интервал
              </Button>
              <Button
                variant="outlined"
                loading={loadingRotate}
                color="warning"
                onClick={handleForceRotate}
                sx={{ mt: 2, ml: 2 }}
              >
                Сгенерировать сейчас
              </Button>
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
    </Box>
  );
}