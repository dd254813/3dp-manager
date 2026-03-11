import React, { useState } from 'react';
import { Box, Paper, TextField, Button, Typography, Alert, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth/AuthContext';

export default function LoginPage() {
  const [creds, setCreds] = useState({ login: '', password: '' });
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/login', creds);
      login(res.data.access_token);
      navigate('/');
    } catch (e) {
      setError('Неверный логин или пароль');
    }
  };

  return (
    <Box className="animated-container" sx={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: 'background.default'
    }}>
      <Paper sx={{
        p: 4,
        width: '100%',
        maxWidth: 400,
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        animation: 'fadeIn 1.5s ease-out',
        boxShadow: '0 15px 25px rgba(0,0,0,0.5)'
      }}>
        <Typography variant="h5" gutterBottom align="center"><span style={{ verticalAlign: 'middle' }}>Вход в 3DP-MANAGER</span> <Chip label="v2.0.1" size="small" sx={{ verticalAlign: 'middle' }} /></Typography>


        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth margin="normal" label="Логин"
            value={creds.login} onChange={(e) => setCreds({ ...creds, login: e.target.value })}
          />
          <TextField
            fullWidth margin="normal" label="Пароль" type="password"
            value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })}
          />
          <Button fullWidth variant="contained" size="large" type="submit" sx={{ mt: 3, transition: 'transform 0.3s ease', '&:hover': { transform: 'scale(1.05)' } }}>
            Войти
          </Button>
        </form>
      </Paper>
    </Box>
  );
}