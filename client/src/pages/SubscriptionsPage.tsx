import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  FormControl,
  Select,
  InputAdornment,
  InputLabel,
  MenuItem,
  Snackbar,
  Alert,
  useTheme,
  useMediaQuery,
  Menu,
  ListItemIcon,
  ListItemText,
  Checkbox,
} from '@mui/material';
import {
  Delete,
  Add,
  Link as LinkIcon,
  OpenInNew,
  ContentCopy,
  Dns,
  Router,
  Edit,
  MoreVert,
  Remove,
  Refresh,
} from '@mui/icons-material';
import api from '../api';
import { copyToClipboard } from '../utils/copyToClipboard';
import { Logger } from '../utils/logger';

interface InboundRecord {
  id: number;
  protocol: string;
  link?: string | null;
  xuiPanelId?: number | null;
  relayPort?: number | null;
}

interface Subscription {
  id: string;
  name: string;
  uuid: string;
  inbounds: InboundRecord[];
  inboundsConfig?: Array<{
    type?: string;
    port?: number | string;
    sni?: string;
    link?: string;
  }>;
  isAutoRotationEnabled?: boolean;
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

interface Domain {
  id: number;
  name: string;
}

interface XuiPanelSummary {
  id: number;
  name: string;
  geoFlag?: string;
}

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

const patchLink = (link: string, newHost: string, newPort?: number): string => {
  if (link.startsWith('vmess://')) {
    try {
      const base64Part = link.substring(8);
      const jsonStr = Buffer.from(base64Part, 'base64').toString('utf-8');
      const config = JSON.parse(jsonStr) as { add: string; port?: string | number };
      config.add = newHost;
      if (newPort) {
        config.port = newPort.toString();
      }
      const newJsonStr = JSON.stringify(config);
      const newBase64 = Buffer.from(newJsonStr).toString('base64');
      return `vmess://${newBase64}`;
    } catch {
      return link;
    }
  }

  if (
    link.startsWith('vless://') ||
    link.startsWith('trojan://') ||
    link.startsWith('hy2://') ||
    (link.startsWith('ss://') && link.includes('@'))
  ) {
    if (newPort) {
      return link.replace(/@[^/?#]+:\d+/, `@${newHost}:${newPort}`);
    }
    return link.replace(/@.*?:/, `@${newHost}:`);
  }

  return link;
};

const generateId = () => Math.random().toString(36).substring(7);

const getSubscriptionUrl = (uuid: string, tunnelId: string | number) => {
  const tunnelPart = tunnelId !== 'main' ? `/${tunnelId}` : '';
  const path = `/bus/${uuid}${tunnelPart}`;
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  return path;
};

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [panels, setPanels] = useState<XuiPanelSummary[]>([]);
  const [selectedServer, setSelectedServer] = useState<string | number>('main');
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [activeSub, setActiveSub] = useState<Subscription | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const openActionMenu = Boolean(menuAnchorEl);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [inbounds, setInbounds] = useState<InboundConfigUI[]>([]);
  const [portErrors, setPortErrors] = useState<Record<string, string>>({});

  const [linksOpen, setLinksOpen] = useState(false);
  const [currentLinks, setCurrentLinks] = useState<string[]>([]);

  const [snackbar, setSnackbar] = useState({
    open: false,
    type: 'success' as 'success' | 'error',
    message: '',
  });

  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    onConfirm: () => {},
    confirmText: 'Удалить',
    confirmColor: 'error' as 'error' | 'primary',
  });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const loadSubs = useCallback(async () => {
    try {
      Logger.debug('Loading subscriptions...', 'Subs');
      const [subsRes, tunnelsRes, domainsRes, panelsRes] = await Promise.all([
        api.get('/subscriptions'),
        api.get('/tunnels'),
        api.get('/domains/all'),
        api.get('/settings/panels'),
      ]);

      setSubs(subsRes.data);
      setTunnels(tunnelsRes.data.filter((el: Tunnel) => el.isInstalled));
      setDomains(domainsRes.data);
      setPanels(panelsRes.data);

      Logger.debug(`Loaded ${subsRes.data.length} subscriptions`, 'Subs');
    } catch (error) {
      Logger.error('Failed to load', 'Subs', error);
      throw error;
    }
  }, []);

  useEffect(() => {
    loadSubs();
  }, [loadSubs]);

  const getInboundSummary = useCallback(
    (sub: Subscription) => {
      const total = sub.inbounds?.length || 0;
      if (total === 0) {
        return { total: 0, breakdown: '' };
      }

      const counts = new Map<string, number>();
      let sharedCount = 0;

      for (const inbound of sub.inbounds || []) {
        if (!inbound.xuiPanelId) {
          sharedCount++;
          continue;
        }

        const panel = panels.find((item) => item.id === inbound.xuiPanelId);
        const label = panel
          ? `${panel.geoFlag || ''} ${panel.name}`.trim()
          : `Panel ${inbound.xuiPanelId}`;
        counts.set(label, (counts.get(label) || 0) + 1);
      }

      const parts = Array.from(counts.entries()).map(
        ([label, count]) => `${label}: ${count}`,
      );
      if (sharedCount > 0) {
        parts.push(`общие: ${sharedCount}`);
      }

      return {
        total,
        breakdown: parts.join(' • '),
      };
    },
    [panels],
  );

  const handleActionMenuClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    sub: Subscription,
  ) => {
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
      setInbounds(
        sub.inboundsConfig.map((i) => ({
          id: generateId(),
          type: i.type || 'vless-tcp-reality',
          port: i.port ? i.port.toString() : 'random',
          sni: i.sni || 'random',
          link: i.link || '',
        })),
      );
    } else {
      setInbounds([
        {
          id: generateId(),
          type: 'vless-tcp-reality',
          port: 'random',
          sni: 'random',
          link: '',
        },
      ]);
    }

    setPortErrors({});
    setOpen(true);
  };

  const handleInboundChange = (
    id: string,
    field: keyof InboundConfigUI,
    value: string,
  ) => {
    setInbounds((prev) =>
      prev.map((inb) => (inb.id === id ? { ...inb, [field]: value } : inb)),
    );
    if (field === 'port' || (field === 'type' && value === 'custom')) {
      setPortErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const addInbound = () => {
    if (inbounds.length < 20) {
      setInbounds([
        ...inbounds,
        {
          id: generateId(),
          type: 'vless-tcp-reality',
          port: 'random',
          sni: 'random',
          link: '',
        },
      ]);
    }
  };

  const removeInbound = (id?: string) => {
    if (id) {
      if (inbounds.length > 1) {
        setInbounds(inbounds.filter((inb) => inb.id !== id));
        setPortErrors((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
      return;
    }

    setInbounds([
      {
        id: crypto.randomUUID(),
        type: 'vless-tcp-reality',
        port: 'random',
        sni: 'random',
        link: '',
      },
    ]);
    setPortErrors({});
  };

  const handleSave = async () => {
    if (Object.keys(portErrors).length > 0) {
      setSnackbar({
        open: true,
        type: 'error',
        message: 'Пожалуйста, исправьте ошибки с портами',
      });
      return;
    }
    if (!name.trim()) {
      setSnackbar({
        open: true,
        type: 'error',
        message: 'Введите имя подписки',
      });
      return;
    }

    const payload = {
      name,
      inboundsConfig: inbounds.map((i) => {
        if (i.type === 'custom') {
          return { type: i.type, link: i.link };
        }
        return {
          type: i.type,
          port: i.port === 'random' ? 'random' : parseInt(i.port),
          sni: i.sni,
        };
      }),
    };

    try {
      Logger.debug(
        `${editingId ? 'Updating' : 'Creating'} subscription`,
        'Subs',
        payload,
      );
      if (editingId) {
        await api.put(`/subscriptions/${editingId}`, payload);
      } else {
        await api.post('/subscriptions', payload);
      }
      setOpen(false);
      loadSubs();
      setSnackbar({
        open: true,
        type: 'success',
        message: editingId ? 'Подписка обновлена' : 'Подписка создана',
      });
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Произошла ошибка при сохранении';
      Logger.error(`Save error: ${message}`, 'Subs');
      setSnackbar({ open: true, type: 'error', message });
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      open: true,
      title: 'Удалить подписку и все соединения?',
      confirmText: 'Удалить',
      confirmColor: 'error',
      onConfirm: async () => {
        Logger.debug(`Deleting subscription: ${id}`, 'Subs');
        await api.delete(`/subscriptions/${id}`);
        loadSubs();
        setSnackbar({
          open: true,
          type: 'success',
          message: 'Подписка удалена',
        });
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
          s.id === subscriptionId ? { ...s, isAutoRotationEnabled: enabled } : s,
        ),
      );
      setSnackbar({
        open: true,
        type: 'success',
        message: enabled ? 'Авторотация включена' : 'Авторотация выключена',
      });
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Ошибка обновления';
      Logger.error(`Toggle auto-rotation error: ${message}`, 'Subs');
      setSnackbar({ open: true, type: 'error', message });
      loadSubs();
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
            'Subs',
          );
          const res = await api.post(`/rotation/rotate-one/${sub.id}`);
          setSnackbar({
            open: true,
            type: 'success',
            message: res.data.message || 'Ротация выполнена',
          });
          loadSubs();
        } catch (error: unknown) {
          const message =
            (error as { response?: { data?: { message?: string } } })?.response?.data
              ?.message || 'Ошибка ротации';
          Logger.error(`Manual rotation error: ${message}`, 'Subs');
          setSnackbar({ open: true, type: 'error', message });
        }
      },
    });
  };

  const showLinks = (sub: Subscription) => {
    let links: string[] = [];

    if (selectedServer === 'main') {
      links =
        sub.inbounds
          ?.map((i) => i.link)
          .filter((link): link is string => Boolean(link)) || [];
    } else {
      const tunnel = tunnels.find(
        (item) => item.id.toString() === selectedServer.toString(),
      );
      const host = tunnel?.domain?.length ? tunnel.domain : tunnel?.ip;
      links =
        sub.inbounds
          ?.map((inbound) => {
            const link = inbound.link || '';
            if (!link || !host) {
              return link;
            }
            if (inbound.protocol === 'custom') {
              return link;
            }
            return patchLink(link, host, inbound.relayPort || undefined);
          })
          .filter(Boolean) || [];
    }

    if (links.length === 0) {
      setCurrentLinks(['Нет активных ссылок (ждите ротации)']);
    } else {
      setCurrentLinks(links);
    }
    setLinksOpen(true);
  };

  const handleCopyLink = async (uuid: string, tunnelId: string | number) => {
    await copyToClipboard(getSubscriptionUrl(uuid, tunnelId));
    setSnackbar({
      open: true,
      type: 'success',
      message: 'Ссылка на подписку скопирована',
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant={isMobile ? 'h5' : 'h4'}>Подписки</Typography>
        {tunnels.length > 0 && (
          <FormControl
            variant="standard"
            size="small"
            sx={{ minWidth: 220, justifyContent: 'center' }}
          >
            <Select
              value={selectedServer}
              onChange={(e) => setSelectedServer(e.target.value)}
              startAdornment={
                <InputAdornment position="start">
                  {selectedServer === 'main' ? (
                    <Dns fontSize="small" />
                  ) : (
                    <Router fontSize="small" />
                  )}
                </InputAdornment>
              }
            >
              <MenuItem value="main">
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Основной сервер
                </Typography>
              </MenuItem>
              {tunnels.map((t) => (
                <MenuItem key={t.id} value={t.id.toString()}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {t.name}
                  </Typography>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Box>
          <Button variant="contained" startIcon={<Add />} onClick={handleOpenCreate}>
            Создать
          </Button>
        </Box>
      </Box>

      <Paper sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Имя</TableCell>
              <TableCell>UUID</TableCell>
              <TableCell>Инбаунды</TableCell>
              <TableCell>Авторотация</TableCell>
              <TableCell align="right">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {subs.map((sub) => {
              const summary = getInboundSummary(sub);
              return (
                <TableRow key={sub.id}>
                  <TableCell sx={{ fontWeight: 700 }}>{sub.name}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{sub.uuid}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {summary.total}
                    </Typography>
                    {summary.breakdown && (
                      <Typography variant="caption" color="textSecondary">
                        {summary.breakdown}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={sub.isAutoRotationEnabled ?? true}
                      onChange={(e) =>
                        handleToggleAutoRotation(sub.id, e.target.checked)
                      }
                      color="primary"
                    />
                  </TableCell>
                  <TableCell align="right">
                    {!isMobile && (
                      <>
                        <IconButton
                          color="primary"
                          onClick={() => handleCopyLink(sub.uuid, selectedServer)}
                          title="Копировать ссылку"
                        >
                          <ContentCopy />
                        </IconButton>
                        <IconButton
                          color="primary"
                          onClick={() =>
                            window.open(
                              getSubscriptionUrl(sub.uuid, selectedServer),
                              '_blank',
                            )
                          }
                          title="Открыть подписку"
                        >
                          <OpenInNew />
                        </IconButton>
                      </>
                    )}

                    <IconButton onClick={(e) => handleActionMenuClick(e, sub)}>
                      <MoreVert />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {subs.length === 0 && (
          <Typography sx={{ p: 2 }} color="textSecondary" textAlign="center">
            Нет подписок
          </Typography>
        )}
      </Paper>

      <Menu
        anchorEl={menuAnchorEl}
        open={openActionMenu}
        onClose={handleActionMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {isMobile && activeSub && (
          <MenuItem onClick={() => handleCopyLink(activeSub.uuid, selectedServer)}>
            <ListItemIcon>
              <ContentCopy fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText>Копировать ссылку</ListItemText>
          </MenuItem>
        )}
        {isMobile && activeSub && (
          <MenuItem
            onClick={() =>
              window.open(getSubscriptionUrl(activeSub.uuid, selectedServer), '_blank')
            }
          >
            <ListItemIcon>
              <OpenInNew fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText>Открыть подписку</ListItemText>
          </MenuItem>
        )}

        {activeSub && (
          <MenuItem onClick={() => showLinks(activeSub)}>
            <ListItemIcon>
              <LinkIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Показать конфиги</ListItemText>
          </MenuItem>
        )}
        {activeSub && (
          <MenuItem onClick={() => handleManualRotate(activeSub)}>
            <ListItemIcon>
              <Refresh fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText>Обновить сейчас</ListItemText>
          </MenuItem>
        )}
        {activeSub && (
          <MenuItem onClick={() => handleOpenEdit(activeSub)}>
            <ListItemIcon>
              <Edit fontSize="small" />
            </ListItemIcon>
            <ListItemText>Редактировать</ListItemText>
          </MenuItem>
        )}
        {activeSub && (
          <MenuItem onClick={() => handleDelete(activeSub.id)}>
            <ListItemIcon>
              <Delete fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText sx={{ color: 'error.main' }}>Удалить</ListItemText>
          </MenuItem>
        )}
      </Menu>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
        disableRestoreFocus
      >
        <DialogTitle variant="h5">
          {editingId ? 'Редактировать подписку' : 'Новая подписка'}
        </DialogTitle>
        <DialogContent dividers>
          <TextField
            autoFocus
            margin="dense"
            label="Имя подписки"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mb: 4 }}
          />

          <Typography variant="h6" sx={{ mb: 2 }}>
            Инбаунды ({inbounds.length}/20)
          </Typography>

          {inbounds.map((inb, index) => (
            <Box
              key={inb.id}
              sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2, p: 2 }}
            >
              <Typography sx={{ mt: 1, minWidth: 30, fontWeight: 'bold' }}>
                #{index + 1}
              </Typography>

              <FormControl size="small" sx={{ minWidth: 185 }}>
                <InputLabel>Тип</InputLabel>
                <Select
                  value={inb.type}
                  label="Тип"
                  sx={{ minWidth: '185px' }}
                  onChange={(e) => handleInboundChange(inb.id, 'type', e.target.value)}
                >
                  {CONNECTION_OPTIONS.map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {opt}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {inb.type === 'custom' ? (
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
                      helperText={portErrors[inb.id] || ''}
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
                      {domains.map((opt) => (
                        <MenuItem key={opt.id} value={opt.name}>
                          {opt.name}
                        </MenuItem>
                      ))}
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
            size="small"
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
          <Button onClick={handleSave} variant="contained" color="primary">
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={linksOpen} onClose={() => setLinksOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Активные ссылки</DialogTitle>
        <DialogContent>
          <TextField
            multiline
            fullWidth
            rows={10}
            value={currentLinks.join('\n\n')}
            slotProps={{
              input: {
                readOnly: true,
                sx: { fontFamily: 'monospace', fontSize: 12 },
              },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => copyToClipboard(currentLinks.join('\n'))}>
            Копировать все
          </Button>
          <Button onClick={() => setLinksOpen(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
      >
        <DialogTitle>Подтверждение</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.title}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
            Отмена
          </Button>
          <Button
            onClick={() => {
              confirmDialog.onConfirm();
              setConfirmDialog({ ...confirmDialog, open: false });
            }}
            variant="contained"
            color={confirmDialog.confirmColor}
          >
            {confirmDialog.confirmText}
          </Button>
        </DialogActions>
      </Dialog>

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
