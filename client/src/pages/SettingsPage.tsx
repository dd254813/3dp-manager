import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Add,
  CheckCircle,
  PauseCircleFilled,
  PlayCircleFilled,
  Refresh,
} from '@mui/icons-material';
import api from '../api';
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

interface XuiPanel {
  id: number;
  name: string;
  url: string;
  login: string;
  password: string;
  host?: string;
  ip?: string;
  geoCountry?: string;
  geoFlag?: string;
  hysteriaEnabled?: boolean;
  hysteriaHost?: string | null;
  hysteriaPort?: number | null;
  hysteriaPassword?: string | null;
  hysteriaObfsPassword?: string | null;
  hysteriaSni?: string | null;
}

const EMPTY_PANEL_FORM = {
  name: '',
  url: '',
  login: '',
  password: '',
  hysteriaEnabled: false,
  hysteriaHost: '',
  hysteriaPort: '',
  hysteriaPassword: '',
  hysteriaObfsPassword: '',
  hysteriaSni: '',
};

const decodeDisplayValue = (value?: string | null) => {
  if (!value) {
    return '';
  }

  try {
    return value.includes('%') ? decodeURIComponent(value) : value;
  } catch {
    return value;
  }
};

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    rotation_interval: '30',
    rotation_status: 'active',
    last_rotation_timestamp: '',
  });
  const [panels, setPanels] = useState<XuiPanel[]>([]);
  const [panelDialog, setPanelDialog] = useState({
    open: false,
    editingId: null as number | null,
  });
  const [panelForm, setPanelForm] = useState(EMPTY_PANEL_FORM);
  const [panelLoading, setPanelLoading] = useState(false);

  const [adminProfile, setAdminProfile] = useState({
    login: '',
    password: '',
  });

  const [subs, setSubs] = useState<Subscription[]>([]);

  const [msg, setMsg] = useState({
    open: false,
    type: 'success' as 'success' | 'error',
    text: '',
  });
  const [loadingRotate, setLoadingRotate] = useState<boolean>(false);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    onConfirm: () => {},
    confirmText: 'Удалить',
    confirmColor: 'error' as 'error' | 'primary',
  });
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const loadSettings = useCallback(async () => {
    try {
      Logger.debug('Loading settings...', 'Settings');
      const { data } = await api.get('/settings');
      setSettings((prev) => ({
        ...prev,
        rotation_interval: data.rotation_interval || prev.rotation_interval,
        rotation_status: data.rotation_status || prev.rotation_status,
        last_rotation_timestamp: data.last_rotation_timestamp || '',
      }));

      if (data.admin_login) {
        setAdminProfile((prev) => ({ ...prev, login: data.admin_login }));
      }
      Logger.debug('Settings loaded successfully', 'Settings');
    } catch (error) {
      Logger.error('Failed to load settings', 'Settings', error);
    }
  }, []);

  const loadPanels = useCallback(async () => {
    try {
      Logger.debug('Loading xui panels...', 'Settings');
      const { data } = await api.get('/settings/panels');
      setPanels(data);
      Logger.debug(`Loaded ${data.length} xui panels`, 'Settings');
    } catch (error) {
      Logger.error('Failed to load xui panels', 'Settings', error);
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
    loadPanels();
    loadSubscriptions();
  }, [loadPanels, loadSettings, loadSubscriptions]);

  const getIntervalError = () => {
    const val = parseInt(settings.rotation_interval, 10);
    if (isNaN(val) || val < 10) {
      return 'Минимальный интервал — 10 минут';
    }
    return '';
  };

  const normalizePanelData = useCallback(
    (source = panelForm) => {
      const normalized = {
        ...source,
        name: source.name.trim(),
        url: source.url.trim().replace(/\/+$/, ''),
        login: source.login.trim(),
        password: source.password.trim(),
        hysteriaHost: source.hysteriaHost.trim(),
        hysteriaPort: source.hysteriaPort.trim(),
        hysteriaPassword: source.hysteriaPassword.trim(),
        hysteriaObfsPassword: source.hysteriaObfsPassword.trim(),
        hysteriaSni: source.hysteriaSni.trim(),
      };

      setPanelForm(normalized);
      return normalized;
    },
    [panelForm],
  );

  const resetPanelForm = useCallback(() => {
    setPanelForm(EMPTY_PANEL_FORM);
  }, []);

  const handleSettingChange =
    useCallback(
      (prop: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
        setSettings((prev) => ({ ...prev, [prop]: event.target.value }));
      },
      [],
    );

  const handlePresetClick = (minutes: number) => {
    setSettings((prev) => ({ ...prev, rotation_interval: minutes.toString() }));
  };

  const handleSaveInterval = async () => {
    if (getIntervalError()) {
      setMsg({
        open: true,
        text: 'Неверный интервал (минимум 10 минут)',
        type: 'error',
      });
      return;
    }

    try {
      Logger.debug('Saving rotation interval', 'Settings', {
        rotation_interval: settings.rotation_interval,
      });
      await api.post('/settings', {
        rotation_interval: settings.rotation_interval,
      });
      Logger.debug('Rotation interval saved successfully', 'Settings');
      setMsg({
        open: true,
        type: 'success',
        text: 'Интервал генерации применён!',
      });
    } catch (error) {
      Logger.error('Save interval error', 'Settings', error);
      setMsg({
        open: true,
        type: 'error',
        text: 'Ошибка сохранения интервала',
      });
    }
  };

  const handleAdminChange =
    useCallback(
      (prop: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
        setAdminProfile((prev) => ({ ...prev, [prop]: event.target.value }));
      },
      [],
    );

  const handleSaveAdmin = async () => {
    try {
      Logger.debug('Updating admin profile', 'Settings', {
        login: adminProfile.login,
      });
      await api.post('/auth/update-profile', adminProfile);
      Logger.debug('Admin profile updated', 'Settings');
      setMsg({
        open: true,
        type: 'success',
        text: 'Профиль администратора обновлён!',
      });
      setAdminProfile((prev) => ({ ...prev, password: '' }));
    } catch (error) {
      Logger.error('Update admin profile error', 'Settings', error);
      setMsg({
        open: true,
        type: 'error',
        text: 'Ошибка обновления профиля',
      });
    }
  };

  const handleForceRotate = async () => {
    setConfirmDialog({
      open: true,
      title:
        'ВНИМАНИЕ: Это немедленно обновит конфиги в подписках.\n\nИнтервал автоматической ротации НЕ будет сброшен.\n\nПродолжить?',
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
            setMsg({
              open: true,
              type: 'success',
              text: res.data.message || 'Ротация успешно выполнена!',
            });
            loadSubscriptions();
          } else {
            Logger.warn('Rotation completed with issues', 'Rotation', res.data?.message);
            setMsg({
              open: true,
              type: 'error',
              text: res.data?.message || 'Ошибка выполнения ротации',
            });
          }
        } catch (error) {
          setLoadingRotate(false);
          Logger.error('Rotation error', 'Rotation', error);
          setMsg({
            open: true,
            type: 'error',
            text: 'Ошибка сети или сервера',
          });
        }
      },
    });
  };

  const handleToggleAutoRotation = async (
    subscriptionId: string,
    enabled: boolean,
  ) => {
    try {
      await api.put('/subscriptions/bulk-auto-rotation', {
        subscriptionIds: [subscriptionId],
        enabled,
      });
      setSubs((prev) =>
        prev.map((s) =>
          s.id === subscriptionId
            ? { ...s, isAutoRotationEnabled: enabled }
            : s,
        ),
      );
      setMsg({
        open: true,
        type: 'success',
        text: enabled ? 'Авторотация включена' : 'Авторотация выключена',
      });
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Ошибка обновления';
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
          Logger.debug(
            `Starting manual rotation for subscription: ${sub.id}`,
            'Settings',
          );
          const res = await api.post(`/rotation/rotate-one/${sub.id}`);
          Logger.debug('Manual rotation completed', 'Settings');
          setMsg({
            open: true,
            type: 'success',
            text: res.data.message || 'Ротация выполнена',
          });
          loadSubscriptions();
        } catch (error: unknown) {
          const message =
            (error as { response?: { data?: { message?: string } } })?.response?.data
              ?.message || 'Ошибка ротации';
          Logger.error(`Manual rotation error: ${message}`, 'Settings');
          setMsg({ open: true, type: 'error', text: message });
        }
      },
    });
  };

  const handleBulkUpdate = async (enabled: boolean) => {
    try {
      const { data } = await api.put('/subscriptions/bulk-auto-rotation', {
        subscriptionIds: subs.map((s) => s.id),
        enabled,
      });
      setMsg({
        open: true,
        type: 'success',
        text: data.message || 'Настройки обновлены',
      });
      loadSubscriptions();
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Ошибка обновления';
      Logger.error(`Bulk update error: ${message}`, 'Settings');
      setMsg({ open: true, type: 'error', text: message });
    }
  };

  const togglePause = async () => {
    const previousStatus = settings.rotation_status;
    const newStatus = previousStatus === 'active' ? 'stopped' : 'active';

    Logger.debug(
      `Toggling rotation status: ${previousStatus} → ${newStatus}`,
      'Settings',
    );
    setSettings((prev) => ({ ...prev, rotation_status: newStatus }));

    try {
      await api.post('/settings', { rotation_status: newStatus });
      Logger.debug('Rotation status updated', 'Settings');
    } catch (error) {
      Logger.error('Toggle pause error', 'Settings', error);
      setSettings((prev) => ({ ...prev, rotation_status: previousStatus }));
      setMsg({
        open: true,
        type: 'error',
        text: 'Не удалось изменить статус',
      });
    }
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return 'Нет данных';
    return new Date(+isoString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getNextRotationDate = () => {
    if (settings.rotation_status === 'stopped') return 'Пауза';
    if (!settings.last_rotation_timestamp) return 'Ожидание...';

    const last = new Date(+settings.last_rotation_timestamp);
    const intervalMinutes = parseInt(settings.rotation_interval, 10) || 60;
    const next = new Date(last.getTime() + intervalMinutes * 60000);

    return next.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPanelLocationLabel = useCallback((panel: XuiPanel) => {
    const flag = decodeDisplayValue(panel.geoFlag);
    const country = decodeDisplayValue(panel.geoCountry);

    return [flag, country].filter(Boolean).join(' ').trim();
  }, []);

  const openCreatePanel = () => {
    setPanelDialog({ open: true, editingId: null });
    resetPanelForm();
  };

  const openEditPanel = (panel: XuiPanel) => {
    setPanelDialog({ open: true, editingId: panel.id });
    setPanelForm({
      name: panel.name,
      url: panel.url,
      login: panel.login,
      password: panel.password,
      hysteriaEnabled: panel.hysteriaEnabled || false,
      hysteriaHost: panel.hysteriaHost || '',
      hysteriaPort: panel.hysteriaPort?.toString() || '',
      hysteriaPassword: panel.hysteriaPassword || '',
      hysteriaObfsPassword: panel.hysteriaObfsPassword || '',
      hysteriaSni: panel.hysteriaSni || '',
    });
  };

  const handlePanelChange =
    useCallback(
      (prop: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
        const value =
          prop === 'hysteriaEnabled'
            ? event.target.checked
            : event.target.value;
        setPanelForm((prev) => ({ ...prev, [prop]: value }));
      },
      [],
    );

  const handleCheckPanelConnection = async (panel?: XuiPanel) => {
    const data = panel
      ? {
          url: panel.url.trim().replace(/\/+$/, ''),
          login: panel.login.trim(),
          password: panel.password.trim(),
        }
      : normalizePanelData();

    if (!data.url || !data.login || !data.password) {
      setMsg({
        open: true,
        type: 'error',
        text: 'Заполните URL, логин и пароль панели',
      });
      return;
    }

    try {
      setPanelLoading(true);
      const res = await api.post('/settings/panels/check', {
        url: data.url,
        login: data.login,
        password: data.password,
      });

      setPanelLoading(false);
      if (res.data.success) {
        setMsg({ open: true, type: 'success', text: 'Подключение успешно!' });
      } else {
        setMsg({
          open: true,
          type: 'error',
          text: 'Ошибка: неверные данные или нет доступа',
        });
      }
    } catch (error) {
      setPanelLoading(false);
      Logger.error('Connection check error', 'Settings', error);
      setMsg({
        open: true,
        type: 'error',
        text: 'Ошибка сети при проверке',
      });
    }
  };

  const handleSavePanel = async () => {
    const data = normalizePanelData();
    const hysteriaPort = data.hysteriaEnabled
      ? parseInt(data.hysteriaPort, 10)
      : null;

    if (!data.name || !data.url || !data.login || !data.password) {
      setMsg({
        open: true,
        type: 'error',
        text: 'Заполните все поля панели 3x-ui',
      });
      return;
    }

    if (data.hysteriaEnabled) {
      if (
        !data.hysteriaHost ||
        !data.hysteriaPort ||
        !data.hysteriaPassword ||
        !data.hysteriaObfsPassword
      ) {
        setMsg({
          open: true,
          type: 'error',
          text: 'Для Hysteria2 заполните host, порт, пароль и obfs пароль',
        });
        return;
      }

      if (
        Number.isNaN(hysteriaPort) ||
        !hysteriaPort ||
        hysteriaPort <= 0 ||
        hysteriaPort > 65535
      ) {
        setMsg({
          open: true,
          type: 'error',
          text: 'Некорректный порт Hysteria2',
        });
        return;
      }
    }

    const payload = {
      name: data.name,
      url: data.url,
      login: data.login,
      password: data.password,
      hysteriaEnabled: data.hysteriaEnabled,
      hysteriaHost: data.hysteriaEnabled ? data.hysteriaHost || null : null,
      hysteriaPort: data.hysteriaEnabled ? hysteriaPort : null,
      hysteriaPassword: data.hysteriaEnabled
        ? data.hysteriaPassword || null
        : null,
      hysteriaObfsPassword: data.hysteriaEnabled
        ? data.hysteriaObfsPassword || null
        : null,
      hysteriaSni: data.hysteriaEnabled ? data.hysteriaSni || null : null,
    };

    try {
      setPanelLoading(true);
      if (panelDialog.editingId) {
        await api.put(`/settings/panels/${panelDialog.editingId}`, payload);
        setMsg({ open: true, type: 'success', text: 'Панель обновлена' });
      } else {
        await api.post('/settings/panels', payload);
        setMsg({ open: true, type: 'success', text: 'Панель добавлена' });
      }

      setPanelLoading(false);
      setPanelDialog({ open: false, editingId: null });
      resetPanelForm();
      loadPanels();
    } catch (error: unknown) {
      setPanelLoading(false);
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Ошибка сохранения панели';
      Logger.error(`Save panel error: ${message}`, 'Settings');
      setMsg({ open: true, type: 'error', text: message });
    }
  };

  const handleDeletePanel = (panel: XuiPanel) => {
    setConfirmDialog({
      open: true,
      title: `Удалить панель "${panel.name}"?`,
      confirmText: 'Удалить',
      confirmColor: 'error',
      onConfirm: async () => {
        try {
          await api.delete(`/settings/panels/${panel.id}`);
          setMsg({ open: true, type: 'success', text: 'Панель удалена' });
          loadPanels();
        } catch (error: unknown) {
          const message =
            (error as { response?: { data?: { message?: string } } })?.response?.data
              ?.message || 'Ошибка удаления панели';
          Logger.error(`Delete panel error: ${message}`, 'Settings');
          setMsg({ open: true, type: 'error', text: message });
        }
      },
    });
  };

  const isPaused = settings.rotation_status === 'stopped';

  return (
    <Box>
      <Typography variant={isMobile ? 'h5' : 'h4'} gutterBottom>
        Настройки утилиты
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }}>
          <Grid container spacing={1}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                Статус сервиса
              </Typography>
              {isPaused ? (
                <Chip
                  icon={<PauseCircleFilled />}
                  label="Остановлен"
                  color="warning"
                  size="small"
                  variant="outlined"
                />
              ) : (
                <Chip
                  icon={<CheckCircle />}
                  label="Активен"
                  color="success"
                  size="small"
                  variant="outlined"
                />
              )}

              <Tooltip title={isPaused ? 'Возобновить ротацию' : 'Поставить на паузу'}>
                <IconButton
                  onClick={togglePause}
                  size="small"
                  sx={{
                    bgcolor: 'background.paper',
                    boxShadow: 2,
                    '&:hover': { bgcolor: 'background.paper' },
                    ml: 1,
                  }}
                >
                  {isPaused ? (
                    <PlayCircleFilled fontSize="large" />
                  ) : (
                    <PauseCircleFilled fontSize="large" />
                  )}
                </IconButton>
              </Tooltip>
            </Grid>
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
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 2 }}
            >
              <Typography variant="h6">Панели 3x-ui</Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={<Add />}
                onClick={openCreatePanel}
              >
                Добавить
              </Button>
            </Stack>
            <Divider sx={{ mb: 2 }} />

            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Каждая панель участвует в генерации отдельно. Relay-правила для
              tunnel-серверов строятся автоматически по всем активным панелям.
            </Typography>

            {panels.length === 0 ? (
              <Typography variant="body2" color="textSecondary">
                Панели 3x-ui пока не добавлены
              </Typography>
            ) : (
              <List sx={{ p: 0 }}>
                {panels.map((panel) => (
                  <ListItem
                    key={panel.id}
                    sx={{
                      px: 0,
                      py: 2,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 'none' },
                      display: 'block',
                    }}
                  >
                    <Box
                      sx={{
                        width: '100%',
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) auto',
                        gap: 2,
                        alignItems: 'start',
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Stack spacing={0.75}>
                          <Stack
                            direction="row"
                            alignItems="center"
                            spacing={1}
                            sx={{ flexWrap: 'wrap' }}
                          >
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {panel.name}
                            </Typography>
                            {getPanelLocationLabel(panel) && (
                              <Chip
                                size="small"
                                variant="outlined"
                                label={getPanelLocationLabel(panel)}
                              />
                            )}
                            {panel.hysteriaEnabled && (
                              <Chip
                                size="small"
                                color="info"
                                variant="outlined"
                                label={`Hysteria2 ${panel.hysteriaHost || panel.host}:${panel.hysteriaPort || ''}`}
                              />
                            )}
                          </Stack>
                          <Typography
                            variant="body2"
                            color="textSecondary"
                            sx={{ wordBreak: 'break-word' }}
                          >
                            {panel.url}
                          </Typography>
                          {[panel.host, panel.ip].filter(Boolean).length > 0 && (
                            <Typography
                              variant="caption"
                              display="block"
                              color="textSecondary"
                            >
                              {[panel.host, panel.ip].filter(Boolean).join(' • ')}
                            </Typography>
                          )}
                          {panel.hysteriaEnabled && panel.hysteriaSni && (
                            <Typography variant="caption" display="block" color="textSecondary">
                              Hysteria2 SNI: {decodeDisplayValue(panel.hysteriaSni)}
                            </Typography>
                          )}
                        </Stack>
                      </Box>

                      <Stack
                        direction={isMobile ? 'column' : 'row'}
                        spacing={1}
                        sx={{
                          minWidth: isMobile ? '100%' : 'auto',
                          alignItems: isMobile ? 'stretch' : 'center',
                          justifyContent: isMobile ? 'flex-start' : 'flex-end',
                        }}
                      >
                        <Button size="small" onClick={() => handleCheckPanelConnection(panel)}>
                          Проверить
                        </Button>
                        <Button size="small" onClick={() => openEditPanel(panel)}>
                          Изменить
                        </Button>
                        <Button size="small" color="error" onClick={() => handleDeletePanel(panel)}>
                          Удалить
                        </Button>
                      </Stack>
                    </Box>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Генерация инбаундов
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <TextField
                fullWidth
                margin="normal"
                label="Интервал генерации"
                type="number"
                value={settings.rotation_interval}
                onChange={handleSettingChange('rotation_interval')}
                slotProps={{
                  input: {
                    endAdornment: <InputAdornment position="end">мин</InputAdornment>,
                  },
                }}
                helperText="Как часто менять инбаунды (минимум 10 мин)"
              />
              <Stack direction="row" spacing={1} sx={{ mt: 1, mb: 2, flexWrap: 'wrap' }}>
                {ROTATION_PRESETS.map((preset) => (
                  <Chip
                    key={preset.value}
                    label={preset.label}
                    onClick={() => handlePresetClick(preset.value)}
                    color={
                      settings.rotation_interval === preset.value.toString()
                        ? 'primary'
                        : 'default'
                    }
                    variant={
                      settings.rotation_interval === preset.value.toString()
                        ? 'filled'
                        : 'outlined'
                    }
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
                <List
                  sx={{
                    maxHeight: 400,
                    overflow: 'auto',
                    bgcolor: 'background.default',
                    borderRadius: 1,
                  }}
                >
                  {subs.map((sub) => (
                    <ListItem
                      key={sub.id}
                      sx={{
                        py: 1,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        '&:last-child': { borderBottom: 'none' },
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={sub.isAutoRotationEnabled ?? true}
                            onChange={(e) =>
                              handleToggleAutoRotation(sub.id, e.target.checked)
                            }
                            color="primary"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {sub.name}
                            </Typography>
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
                <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
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
              <Typography variant="h6" gutterBottom>
                Доступ к 3DP-MANAGER
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <TextField
                fullWidth
                margin="normal"
                label="Логин администратора"
                value={adminProfile.login}
                onChange={handleAdminChange('login')}
              />
              <TextField
                fullWidth
                margin="normal"
                label="Новый пароль"
                type="password"
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

      <Dialog
        open={panelDialog.open}
        onClose={() => {
          setPanelDialog({ open: false, editingId: null });
          resetPanelForm();
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {panelDialog.editingId
            ? 'Редактировать панель 3x-ui'
            : 'Новая панель 3x-ui'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="dense"
            label="Название панели"
            value={panelForm.name}
            onChange={handlePanelChange('name')}
          />
          <TextField
            fullWidth
            margin="dense"
            label="URL панели"
            value={panelForm.url}
            onChange={handlePanelChange('url')}
            helperText="Например: https://my-vpn.com:2053/wfgpoVHaOF"
          />
          <TextField
            fullWidth
            margin="dense"
            label="Логин 3x-ui"
            value={panelForm.login}
            onChange={handlePanelChange('login')}
          />
          <TextField
            fullWidth
            margin="dense"
            label="Пароль 3x-ui"
            type="password"
            value={panelForm.password}
            onChange={handlePanelChange('password')}
          />

          <Divider sx={{ my: 2 }} />

          <FormControlLabel
            control={
              <Checkbox
                checked={panelForm.hysteriaEnabled}
                onChange={handlePanelChange('hysteriaEnabled')}
              />
            }
            label="Использовать Hysteria2 на этом сервере"
          />

          {panelForm.hysteriaEnabled && (
            <Box sx={{ mt: 1 }}>
              <TextField
                fullWidth
                margin="dense"
                label="Hysteria2 host"
                value={panelForm.hysteriaHost}
                onChange={handlePanelChange('hysteriaHost')}
                helperText="Хост, который будет попадать в hy2-ссылку"
              />
              <TextField
                fullWidth
                margin="dense"
                label="Hysteria2 port"
                value={panelForm.hysteriaPort}
                onChange={handlePanelChange('hysteriaPort')}
              />
              <TextField
                fullWidth
                margin="dense"
                label="Hysteria2 password"
                type="password"
                value={panelForm.hysteriaPassword}
                onChange={handlePanelChange('hysteriaPassword')}
              />
              <TextField
                fullWidth
                margin="dense"
                label="Hysteria2 obfs password"
                type="password"
                value={panelForm.hysteriaObfsPassword}
                onChange={handlePanelChange('hysteriaObfsPassword')}
              />
              <TextField
                fullWidth
                margin="dense"
                label="Hysteria2 SNI"
                value={panelForm.hysteriaSni}
                onChange={handlePanelChange('hysteriaSni')}
                helperText="Необязательно. Если пусто, будет использован SNI из инбаунда или host"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setPanelDialog({ open: false, editingId: null });
              resetPanelForm();
            }}
          >
            Отмена
          </Button>
          <Button onClick={() => handleCheckPanelConnection()} disabled={panelLoading}>
            Проверить
          </Button>
          <Button variant="contained" onClick={handleSavePanel} disabled={panelLoading}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={msg.open}
        autoHideDuration={5000}
        onClose={() => setMsg({ ...msg, open: false })}
      >
        <Alert severity={msg.type}>{msg.text}</Alert>
      </Snackbar>

      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
      >
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
