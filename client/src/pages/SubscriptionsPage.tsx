import { useEffect, useState } from 'react';
import {
  Box, Button, Typography, Paper, Table, TableBody, TableCell,
  TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, TextField, DialogActions,
  FormControl,
  Select,
  InputAdornment,
  MenuItem,
  type SelectChangeEvent
} from '@mui/material';
import { Delete, Add, Link as LinkIcon, Refresh, OpenInNew, ContentCopy, Dns, Router } from '@mui/icons-material';
import api from '../api';

interface Subscription {
  id: string;
  name: string;
  uuid: string;
  inbounds: any[];
}

interface Tunnel {
  id: number;
  name: string;
  ip: string;
  domain: string;
  isInstalled: boolean;
}

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
    } catch (e) {
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
}

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);

  const [selectedServer, setSelectedServer] = useState<string | number>('main');

  const [linksOpen, setLinksOpen] = useState(false);
  const [currentLinks, setCurrentLinks] = useState<string[]>([]);

  useEffect(() => { loadSubs(); }, []);

  const loadSubs = async () => {
    const { data } = await api.get('/subscriptions');
    setSubs(data);
    const tunnelsRes = await api.get('/tunnels');
    setTunnels(tunnelsRes.data.filter((el: Tunnel) => el.isInstalled));
  };

  const handleCreate = async () => {
    await api.post('/subscriptions', { name });
    setOpen(false);
    setName('');
    loadSubs();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Удалить подписку и все соединения?')) {
      await api.delete(`/subscriptions/${id}`);
      loadSubs();
    }
  };

  const showLinks = (sub: Subscription) => {
    let links = [];
    if (selectedServer === 'main') {
      links = sub.inbounds?.map(i => i.link).filter(Boolean) || [];
    } else {
      const host = tunnels[+selectedServer - 1].domain.length > 0 ? tunnels[+selectedServer - 1].domain : tunnels[+selectedServer - 1].ip;
      links = sub.inbounds?.map(i => patchLink(i.link, host)).filter(Boolean) || [];
    }
    if (links.length === 0) {
      setCurrentLinks(['Нет активных ссылок (ждите ротации)']);
    } else {
      setCurrentLinks(links);
    }
    setLinksOpen(true);
  };

  const handleServerChange = (event: SelectChangeEvent<any>) => {
    setSelectedServer(event.target.value as string);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Подписки</Typography>
        {tunnels.length > 0 && (
          <FormControl variant='standard' size="small" sx={{ minWidth: 220, justifyContent: 'center' }}>
            <Select
              labelId="server-select-label"
              value={selectedServer}
              onChange={handleServerChange}
              startAdornment={
                <InputAdornment position="start">
                  {selectedServer === 'main' ? <Dns fontSize="small" /> : <Router fontSize="small" />}
                </InputAdornment>
              }
            >
              <MenuItem value="main">
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Основной сервер</Typography>
                </Box>
              </MenuItem>

              {tunnels.map((t) => (
                <MenuItem key={t.id} value={t.id.toString()}>
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.name}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Box>
          <Button startIcon={<Refresh />} onClick={loadSubs} sx={{ mr: 1 }}>Обновить</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>Создать</Button>
        </Box>
      </Box>


      <Paper>
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
                  <IconButton
                    color="primary"
                    onClick={() => navigator.clipboard.writeText(selectedServer === 'main' ? `${location.protocol}//${location.hostname}:3000/bus/${sub.uuid}` : `${location.protocol}//${location.hostname}:3000/bus/${sub.uuid}/${selectedServer}`)}
                    title="Копировать ссылку"
                  >
                    <ContentCopy />
                  </IconButton>
                  <IconButton
                    color="primary"
                    onClick={() => window.open(selectedServer === 'main' ? `${location.protocol}//${location.hostname}:3000/bus/${sub.uuid}` : `${location.protocol}//${location.hostname}:3000/bus/${sub.uuid}/${selectedServer}`, '_blank')}
                    title="Открыть подписку"
                  >
                    <OpenInNew />
                  </IconButton>
                  <IconButton color="primary" onClick={() => showLinks(sub)} title="Показать конфиги">
                    <LinkIcon />
                  </IconButton>
                  <IconButton color="primary" onClick={() => handleDelete(sub.id)} title="Удалить">
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} disableRestoreFocus>
        <DialogTitle>Новая подписка</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus margin="dense" label="Имя пользователя" fullWidth
            value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreate();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Отмена</Button>
          <Button onClick={handleCreate}>Создать</Button>
        </DialogActions>
      </Dialog>

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
    </Box>
  );
}