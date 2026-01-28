import React from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'background.default',
      }}
    >
      <Container maxWidth="md" sx={{ textAlign: 'center' }}>
        <Typography variant="h1" color="primary" sx={{ fontWeight: 'bold' }}>
          404
        </Typography>
        <Typography variant="h5" color="text.secondary" gutterBottom>
          Страница не найдена
        </Typography>
        <Button 
          variant="contained" 
          size="large" 
          onClick={() => navigate('/')}
        >
          На главную
        </Button>
      </Container>
    </Box>
  );
}