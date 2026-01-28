import React from 'react';
import { Box, Container, Grid, Typography, IconButton, Link, Stack, useTheme } from '@mui/material';
import { GitHub, YouTube, Telegram, Article } from '@mui/icons-material';

export default function Footer() {
  const theme = useTheme();

  return (
    <Box
      component="footer"
      sx={{
        py: 3,
        px: 2,
        mt: 'auto', // Ключевой стиль для прижатия к низу
        backgroundColor: (theme) =>
          theme.palette.mode === 'light'
            ? theme.palette.grey[200]
            : theme.palette.grey[900],
      }}
    >
      <Container maxWidth={false}>
        <Grid container spacing={4} justifyContent="space-between" alignItems="center">

          {/* Логотип и копирайт */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <img src="/img/logo.png" alt="Logo" width={32} height={32} style={{ marginRight: 14 }} />

            </Stack>
          </Grid>

          {/* Ссылка на документацию */}
          <Grid size={{ xs: 12, sm: 4 }} sx={{ textAlign: { xs: 'left', sm: 'center' } }}>
            <Link
              href="https://3dp-manager.com/docs/intro" // Ссылка на ваш репо или доку
              target="_blank"
              rel="noopener"
              color="text.primary"
              underline="hover"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontWeight: 500 }}
            >
              Документация
            </Link>
          </Grid>

          {/* Социальные иконки */}
          <Grid size={{ xs: 12, sm: 4 }} sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
            <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>

              <IconButton
                component="a"
                href="https://github.com/denpiligrim"
                target="_blank"
                aria-label="GitHub"
                color="inherit"
              >
                <GitHub />
              </IconButton>

              <IconButton
                component="a"
                href="https://youtube.com/@denpiligrim"
                target="_blank"
                aria-label="YouTube"
                color="inherit"
              >
                <YouTube />
              </IconButton>

              <IconButton
                component="a"
                href="https://t.me/denpiligrim_web"
                target="_blank"
                aria-label="Telegram"
                color="inherit"
              >
                <Telegram />
              </IconButton>

            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}