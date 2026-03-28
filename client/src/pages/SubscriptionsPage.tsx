import { useEffect, useState, useCallback } from 'react';
import {
  Box, Button, Typography, Paper, Table, TableBody, TableCell,
  TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, TextField, DialogActions, FormControl, Select,
  InputAdornment, InputLabel, MenuItem, Snackbar, Alert,
  useTheme,
  useMediaQuery,
  Menu,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import { Delete, Add, Link as LinkIcon, OpenInNew, ContentCopy, Dns, Router, Edit, MoreVert, Remove } from '@mui/icons-material';
import api from '../api';
import { Logger } from '../utils/logger';

interface Subscription {
  id: string;
  name: string;
  uuid: string;
  inbounds: unknown[];
  inboundsConfig?: unknown[];
}

interface Tunnel {
  id: number;
  name: string;
  ip: string;
  domain: string;
  isInstalled: boolean;
}

interface InboundConfigUI {
  id: string;
  type: string;
  port: string;
  sni: string;
  link?: string;
}

interface Domain { id: number; name: string; }

const CONNECTION_OPTIONS = [
  'vless-tcp-reality',
  'vless-xhttp-reality',
  'vless-grpc-reality',
  'vless-ws',
  'hysteria2-udp',
  'vmess-tcp',
  'shadowsocks-tcp',
  'trojan-tcp-reality',
  'custom',
];

const patchLink = function (link: string, newHost: string): string {
  if (link.startsWith('vmess://')) {
    try {
      const base64Part = link.substring(8);
      const jsonStr = Buffer.from(base64Part, 'base64').toString('utf-8');
      const config = JSON.parse(jsonStr);
      config.add = newHost;
      const newJsonStr = JSON.stringify(config);
      const newBase64 = Buffer.from(newJsonStr).toString('base64');
      return `vmess://${newBase64}`;
    } catch {
      return link;
    }
  } else if (link.startsWith('vless://') || link.startsWith('trojan://')) {
    return link.replace(/@.*?:/, `@${newHost}:`);
  } else if (link.startsWith('ss://')) {
    if (link.includes('@')) {
      return link.replace(/@.*?:/, `@${newHost}:`);
    }
    return link;
  }
  return link;
};

const generateId = () => Math.random().toString(36).substring(7);

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [selectedServer, setSelectedServer] = useState<string | number>('main');
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [activeSub, setActiveSub] = useState<Subscription | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const openActionMenu = Boolean(menuAnchorEl);

  // Состояния модального окна конструктора
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [inbounds, setInbounds] = useState<InboundConfigUI[]>([]);
  const [portErrors, setPortErrors] = useState<Record<string, string>>({});

  // Состояния ссылок
  const [linksOpen, setLinksOpen] = useState(false);
  const [currentLinks, setCurrentLinks] = useState<string[]>([]);

  // Snackbar state for notifications
  const [snackbar, setSnackbar] = useState({ open: false, type: 'success' as 'success' | 'error', message: '' });

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', onConfirm: () => {} });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const loadSubs = useCallback(async () => {
    try {
      Logger.debug('Loading subscriptions...', 'Subs');
      const { data } = await api.get('/subscriptions');
      setSubs(data);
      Logger.debug(`Loaded ${data.length} subscriptions`, 'Subs');

      const tunnelsRes = await api.get('/tunnels');
      setTunnels(tunnelsRes.data.filter((el: Tunnel) => el.isInstalled));
      Logger.debug(`Loaded ${tunnelsRes.data.filter((el: Tunnel) => el.isInstalled).length} active tunnels`, 'Subs');

      const allDomains = await api.get('/domains/all');
      setDomains(allDomains.data);
      Logger.debug(`Loaded ${allDomains.data.length} domains`, 'Subs');
    } catch (error) {
      Logger.error('Failed to load', 'Subs', error);
      throw error;
    }
  }, []);

  useEffect(() => { loadSubs(); }, [loadSubs]);

  const handleActionMenuClick = (event: React.MouseEvent<HTMLButtonElement>, sub: Subscription) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveSub(sub);
  };

  const handleActionMenuClose = () => {
    setMenuAnchorEl(null);
    setActiveSub(null);
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setName('');
    setInbounds([
      { id: generateId(), type: 'hysteria2-udp', port: 'random', sni: 'random', link: '' },
      { id: generateId(), type: 'vless-xhttp-reality', port: 'random', sni: 'random', link: '' },
      { id: generateId(), type: 'vless-tcp-reality', port: 'random', sni: 'random', link: '' },
      { id: generateId(), type: 'vless-tcp-reality', port: 'random', sni: 'random', link: '' },
      { id: generateId(), type: 'vless-tcp-reality', port: 'random', sni: 'random', link: '' },
      { id: generateId(), type: 'vless-tcp-reality', port: 'random', sni: 'random', link: '' },
      { id: generateId(), type: 'vless-grpc-reality', port: 'random', sni: 'random', link: '' },
      { id: generateId(), type: 'vless-ws', port: 'random', sni: 'random', link: '' },
      { id: generateId(), type: 'vmess-tcp', port: 'random', sni: 'random', link: '' },
      { id: generateId(), type: 'shadowsocks-tcp', port: 'random', sni: 'random', link: '' },
    ]);
    setPortErrors({});
    setOpen(true);
  };

  const handleOpenEdit = (sub: Subscription) => {
    setEditingId(sub.id);
    setName(sub.name);

    if (sub.inboundsConfig && sub.inboundsConfig.length > 0) {
      setInbounds(sub.inboundsConfig.map(i => ({
        id: generateId(),
        type: i.type || 'vless-tcp-reality',
        port: i.port ? i.port.toString() : 'random',
        sni: i.sni || 'random',
        link: i.link || ''
      })));
    } else {
      setInbounds([{ id: generateId(), type: 'vless-tcp-reality', port: 'random', sni: 'random', link: '' }]);
    }

    setPortErrors({});
    setOpen(true);
  };

  const handleInboundChange = (id: string, field: keyof InboundConfigUI, value: string) => {
    setInbounds(prev => prev.map(inb => inb.id === id ? { ...inb, [field]: value } : inb));
    if (field === 'port' || (field === 'type' && value === 'custom')) {
      setPortErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
    }
  };

  const addInbound = () => {
    if (inbounds.length < 20) {
      setInbounds([...inbounds, { id: generateId(), type: 'vless-tcp-reality', port: 'random', sni: 'random', link: '' }]);
    }
  };

  const removeInbound = (id?: string) => {
    if (id) {
      if (inbounds.length > 1) {
        setInbounds(inbounds.filter(inb => inb.id !== id));
        setPortErrors(prev => {
          const n = { ...prev };
          delete n[id];
          return n;
        });
      }
    } else {
      setInbounds([
        {
          id: crypto.randomUUID(),
          type: 'vless-tcp-reality',
          port: 'random',
          sni: 'random',
          link: ''
        }
      ]);
      setPortErrors({});
    }
  };

  const handleSave = async () => {
    if (Object.keys(portErrors).length > 0) {
      setSnackbar({ open: true, type: 'error', message: 'Пожалуйста, исправьте ошибки с портами' });
      return;
    }
    if (!name.trim()) {
      setSnackbar({ open: true, type: 'error', message: 'Введите имя подписки' });
      return;
    }

    const payload = {
      name,
      inboundsConfig: inbounds.map(i => {
        if (i.type === 'custom') {
          return { type: i.type, link: i.link };
        }
        return {
          type: i.type,
          port: i.port === 'random' ? 'random' : parseInt(i.port),
          sni: i.sni
        };
      })
    };

    try {
      Logger.debug(`${editingId ? 'Updating' : 'Creating'} subscription`, 'Subs', payload);
      if (editingId) {
        await api.put(`/subscriptions/${editingId}`, payload);
        Logger.debug(`Updated subscription ${editingId}`, 'Subs');
      } else {
        await api.post('/subscriptions', payload);
        Logger.debug('Created subscription', 'Subs');
      }
      setOpen(false);
      loadSubs();
      setSnackbar({ open: true, type: 'success', message: editingId ? 'Подписка обновлена' : 'Подписка создана' });
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Произошла ошибка при сохранении';
      Logger.error(`Save error: ${message}`, 'Subs');
      setSnackbar({ open: true, type: 'error', message });
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      open: true,
      title: 'Удалить подписку и все соединения?',
      onConfirm: async () => {
        Logger.debug(`Deleting subscription: ${id}`, 'Subs');
        await api.delete(`/subscriptions/${id}`);
        Logger.debug(`Deleted subscription ${id}`, 'Subs');
        loadSubs();
        setSnackbar({ open: true, type: 'success', message: 'Подписка удалена' });
      }
    });
  };

  const showLinks = (sub: Subscription) => {
    let links: string[] = [];
    if (selectedServer === 'main') {
      links = sub.inbounds?.map(i => (i as { link?: string }).link).filter(Boolean) || [];
    } else {
      const tunnelIndex = +selectedServer - 1;
      const host = tunnels[tunnelIndex]?.domain?.length > 0 ? tunnels[tunnelIndex].domain : tunnels[tunnelIndex].ip;
      links = sub.inbounds?.map(i => patchLink((i as { link?: string }).link || '', host)).filter(Boolean) || [];
    }
    if (links.length === 0) {
      setCurrentLinks(['Нет активных ссылок (ждите ротации)']);
    } else {
      setCurrentLinks(links);
    }
    setLinksOpen(true);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant={isMobile ? 'h5' : 'h4'}>Подписки</Typography>
        {tunnels.length > 0 && (
          <FormControl variant='standard' size="small" sx={{ minWidth: 220, justifyContent: 'center' }}>
            <Select
              value={selectedServer}
              onChange={(e) => setSelectedServer(e.target.value)}
              startAdornment={
                <InputAdornment position="start">
                  {selectedServer === 'main' ? <Dns fontSize="small" /> : <Router fontSize="small" />}
                </InputAdornment>
              }
            >
              <MenuItem value="main">
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Основной сервер</Typography>
              </MenuItem>
              {tunnels.map((t) => (
                <MenuItem key={t.id} value={t.id.toString()}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.name}</Typography>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Box>
          <Button variant="contained" startIcon={<Add />} onClick={handleOpenCreate}>Создать</Button>
        </Box>
      </Box>

      <Paper sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Имя</TableCell>
              <TableCell>UUID</TableCell>
              <TableCell>Инбаунды</TableCell>
              <TableCell align="right">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {subs.map((sub) => (
              <TableRow key={sub.id}>
                <TableCell sx={{ fontWeight: 700 }}>{sub.name}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{sub.uuid}</TableCell>
                <TableCell>{sub.inbounds?.length || 0}</TableCell>
                <TableCell align="right">
                  {!isMobile && (
                    <>
                      <IconButton
                        color="primary"
                        onClick={() => navigator.clipboard.writeText(`${location.protocol}//${location.hostname}:${location.port}/bus/${sub.uuid}${selectedServer !== 'main' ? `/${selectedServer}` : ''}`)}
                        title="Копировать ссылку"
                      >
                        <ContentCopy />
                      </IconButton>
                      <IconButton
                        color="primary"
                        onClick={() => window.open(`${location.protocol}//${location.hostname}:${location.port}/bus/${sub.uuid}${selectedServer !== 'main' ? `/${selectedServer}` : ''}`, '_blank')}
                        title="Открыть подписку"
                      >
                        <OpenInNew />
                      </IconButton>
                    </>
                  )}

                  {/* Кнопка "Три точки" для вызова меню действий */}
                  <IconButton onClick={(e) => handleActionMenuClick(e, sub)}>
                    <MoreVert />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {subs.length === 0 && <Typography sx={{ p: 2 }} color='textSecondary' textAlign='center'>Нет подписок</Typography>}
      </Paper>

      <Menu
        anchorEl={menuAnchorEl}
        open={openActionMenu}
        onClose={handleActionMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {isMobile && activeSub && (
          <MenuItem onClick={() => navigator.clipboard.writeText(`${location.protocol}//${location.hostname}:${location.port}/bus/${activeSub.uuid}${selectedServer !== 'main' ? `/${selectedServer}` : ''}`)}>
            <ListItemIcon><ContentCopy fontSize="small" color="primary" /></ListItemIcon>
            <ListItemText>Копировать ссылку</ListItemText>
          </MenuItem>
        )}
        {isMobile && activeSub && (
          <MenuItem onClick={() => window.open(`${location.protocol}//${location.hostname}:${location.port}/bus/${activeSub.uuid}${selectedServer !== 'main' ? `/${selectedServer}` : ''}`, '_blank')}>
            <ListItemIcon><OpenInNew fontSize="small" color="primary" /></ListItemIcon>
            <ListItemText>Открыть подписку</ListItemText>
          </MenuItem>
        )}

        {activeSub && (
          <MenuItem onClick={() => showLinks(activeSub)}>
            <ListItemIcon><LinkIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Показать конфиги</ListItemText>
          </MenuItem>
        )}
        {activeSub && (
          <MenuItem onClick={() => handleOpenEdit(activeSub)}>
            <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
            <ListItemText>Редактировать</ListItemText>
          </MenuItem>
        )}
        {activeSub && (
          <MenuItem onClick={() => handleDelete(activeSub.id)}>
            <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
            <ListItemText sx={{ color: 'error.main' }}>Удалить</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Модальное окно создания / редактирования */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth disableRestoreFocus>
        <DialogTitle variant='h5'>{editingId ? 'Редактировать подписку' : 'Новая подписка'}</DialogTitle>
        <DialogContent dividers>
          <TextField
            autoFocus margin="dense" label="Имя подписки" fullWidth
            value={name} onChange={(e) => setName(e.target.value)}
            sx={{ mb: 4 }}
          />

          <Typography variant="h6" sx={{ mb: 2 }}>
            Инбаунды ({inbounds.length}/20)
          </Typography>

          {inbounds.map((inb, index) => (
            <Box key={inb.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2, p: 2 }}>
              <Typography sx={{ mt: 1, minWidth: 30, fontWeight: 'bold' }}>#{index + 1}</Typography>

              <FormControl size="small" sx={{ minWidth: 185 }}>
                <InputLabel>Тип</InputLabel>
                <Select
                  value={inb.type}
                  label="Тип"
                  sx={{ minWidth: '185px' }}
                  onChange={(e) => handleInboundChange(inb.id, 'type', e.target.value)}
                >
                  {CONNECTION_OPTIONS.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                </Select>
              </FormControl>

              {inb.type === 'custom' ? (
                // Поле для кастомной ссылки
                <FormControl size="small" sx={{ flexGrow: 1 }}>
                  <TextField
                    size="small"
                    label="Ссылка на подключение"
                    placeholder="vless://..."
                    value={inb.link || ''}
                    onChange={(e) => handleInboundChange(inb.id, 'link', e.target.value)}
                    fullWidth
                  />
                </FormControl>
              ) : (
                <>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <TextField
                      size="small"
                      label="Порт"
                      placeholder="random или порт"
                      value={inb.port}
                      onChange={(e) => handleInboundChange(inb.id, 'port', e.target.value)}
                      error={!!portErrors[inb.id]}
                      helperText={portErrors[inb.id] || ""}
                      sx={{ width: 140 }}
                    />
                  </FormControl>

                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>SNI</InputLabel>
                    <Select
                      value={inb.sni}
                      label="SNI"
                      onChange={(e) => handleInboundChange(inb.id, 'sni', e.target.value)}
                    >
                      <MenuItem value="random">random</MenuItem>
                      {domains.map(opt => <MenuItem key={opt.id} value={opt.name}>{opt.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </>
              )}

              <IconButton
                color="primary"
                onClick={() => removeInbound(inb.id)}
                disabled={inbounds.length <= 1}
                sx={{ mt: 0.5 }}
              >
                <Delete />
              </IconButton>
            </Box>
          ))}

          <Button
            variant="outlined"
            size='small'
            startIcon={<Add />}
            onClick={addInbound}
            disabled={inbounds.length >= 20}
          >
            Добавить инбаунд
          </Button>
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<Remove />}
            sx={{ ml: 0.5 }}
            onClick={() => removeInbound()}
          >
            Удалить все
          </Button>

        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Отмена</Button>
          <Button onClick={handleSave} variant="contained" color="primary">Сохранить</Button>
        </DialogActions>
      </Dialog>

      {/* Модальное окно ссылок */}
      <Dialog open={linksOpen} onClose={() => setLinksOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Активные ссылки</DialogTitle>
        <DialogContent>
          <TextField
            multiline fullWidth rows={10}
            value={currentLinks.join('\n\n')}
            slotProps={{ input: { readOnly: true, sx: { fontFamily: 'monospace', fontSize: 12 } } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => navigator.clipboard.writeText(currentLinks.join('\n'))}>Копировать все</Button>
          <Button onClick={() => setLinksOpen(false)}>Закрыть</Button>
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
            Удалить
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