import React, { useEffect, useState } from 'react';
import {
  Box, Button, Typography, Paper, Table, TableBody, TableCell,
  TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, TextField, DialogActions, Chip, CircularProgress,
  useTheme,
  useMediaQuery,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio
} from '@mui/material';
import { Delete, Add, Terminal, CheckCircle, Error, Dns } from '@mui/icons-material';
import api from '../api';

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

  useEffect(() => { loadTunnels(); }, []);

  const loadTunnels = async () => {
    try {
      const { data } = await api.get('/tunnels');
      setTunnels(data);
    } catch (e) { console.error(e); }
  };

  const handleCreate = async () => {
    const payload = {
      ...form,
      password: authMethod === 'password' ? form.password : null,
      privateKey: authMethod === 'key' ? form.privateKey : null,
    };

    await api.post('/tunnels', payload);
    setOpen(false);
    setForm({ name: '', ip: '', sshPort: 22, username: 'root', password: '', privateKey: '', domain: '' });
    setAuthMethod('password');
    loadTunnels();
  };

  const handleDelete = async (id: number) => {
    if (confirm('Удалить сервер из списка?')) {
      await api.delete(`/tunnels/${id}`);
      loadTunnels();
    }
  };

  const handleInstall = async (id: number) => {
    if (!confirm('Начать установку перенаправления на этот сервер?')) return;

    setLoadingId(id);
    try {
      await api.post(`/tunnels/${id}/install`);
      alert('Скрипт успешно установлен! Трафик перенаправляется.');
      loadTunnels();
    } catch (e: any) {
      alert('Ошибка: ' + (e.response?.data?.message || e.message));
    } finally {
      setLoadingId(null);
    }
  };

  const handleChange = (prop: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [prop]: e.target.value });
  };

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
          <TextField margin="dense" label="Название" fullWidth value={form.name} onChange={handleChange('name')} />
          <TextField margin="dense" label="IP адрес" fullWidth value={form.ip} onChange={handleChange('ip')} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField margin="dense" label="SSH Порт" type="number" fullWidth value={form.sshPort} onChange={handleChange('sshPort')} />
            <TextField margin="dense" label="SSH User" fullWidth value={form.username} onChange={handleChange('username')} />
          </Box>
          <FormControl component="fieldset" sx={{ mt: 2, mb: 1 }}>
            <RadioGroup row value={authMethod} onChange={(e) => setAuthMethod(e.target.value as 'password' | 'key')}>
              <FormControlLabel value="password" control={<Radio />} label="По паролю" />
              <FormControlLabel value="key" control={<Radio />} label="По SSH ключу" />
            </RadioGroup>
          </FormControl>

          {authMethod === 'password' ? (
            <TextField margin="dense" label="SSH Пароль" type="password" fullWidth value={form.password} onChange={handleChange('password')} />
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
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleCreate}>Сохранить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}