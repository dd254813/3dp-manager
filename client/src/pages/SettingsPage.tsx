import React, { useEffect, useState } from 'react';
import { Box, TextField, Button, Typography, Paper, Snackbar, Alert, Grid, Divider, InputAdornment } from '@mui/material';
import api from '../api';
import { useAuth } from '../auth/AuthContext';

export default function SettingsPage() {
  // Настройки 3x-ui и ротации
  const [settings, setSettings] = useState({
    xui_url: '',
    xui_login: '',
    xui_password: '',
    rotation_interval: '30', // Значение по умолчанию
  });

  // Настройки админа (локальное состояние формы)
  const [adminProfile, setAdminProfile] = useState({
    login: '',
    password: '',
  });

  const [msg, setMsg] = useState({ open: false, type: 'success' as 'success'|'error', text: '' });
  const { logout } = useAuth(); // Чтобы разлогинить, если сменили свои данные

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await api.get('/settings');
      // Заполняем основные настройки
      setSettings((prev) => ({ ...prev, ...data }));
      
      // Логин админа тоже приходит в settings (если мы разрешили его чтение), 
      // но пароль (хеш) показывать нельзя.
      if (data.admin_login) {
        setAdminProfile((prev) => ({ ...prev, login: data.admin_login }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- Handlers для настроек 3x-ui и ротации ---
  const handleSettingChange = (prop: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, [prop]: event.target.value });
  };

  const handleSaveSettings = async () => {
    try {
      // Отправляем всё, что в settings
      await api.post('/settings', settings);
      setMsg({ open: true, type: 'success', text: 'Настройки сохранены!' });
    } catch (e) {
      setMsg({ open: true, type: 'error', text: 'Ошибка сохранения' });
    }
  };

  // --- Handlers для профиля админа ---
  const handleAdminChange = (prop: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setAdminProfile({ ...adminProfile, [prop]: event.target.value });
  };

  const handleSaveAdmin = async () => {
    try {
      await api.post('/auth/update-profile', adminProfile);
      setMsg({ open: true, type: 'success', text: 'Профиль администратора обновлен!' });
      setAdminProfile(prev => ({ ...prev, password: '' })); // Очищаем поле пароля
      
      // Опционально: можно сделать логаут, чтобы заставить войти с новыми данными
      // logout(); 
    } catch (e) {
      setMsg({ open: true, type: 'error', text: 'Ошибка обновления профиля' });
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Настройки утилиты</Typography>

      <Grid container spacing={3}>
        
        {/* БЛОК 1: Подключение к 3x-ui */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>Панель 3x-ui</Typography>
            <Divider sx={{ mb: 2 }} />
            
            <TextField
              fullWidth margin="normal" label="URL панели"
              value={settings.xui_url} onChange={handleSettingChange('xui_url')}
              helperText="Например: https://my-vpn.com:2053/panel_path"
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
          </Paper>
        </Grid>

        {/* БЛОК 2: Ротация и Админка */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            
            {/* Настройки Ротации */}
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
              <Button variant="contained" sx={{ mt: 2 }} onClick={handleSaveSettings}>
                Применить интервал
              </Button>
            </Paper>

            {/* Настройки Администратора */}
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

      <Snackbar open={msg.open} autoHideDuration={5000} onClose={() => setMsg({...msg, open: false})}>
        <Alert severity={msg.type}>{msg.text}</Alert>
      </Snackbar>
    </Box>
  );
}