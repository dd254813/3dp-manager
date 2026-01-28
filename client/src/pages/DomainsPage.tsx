import React, { useEffect, useRef, useState } from 'react';
import { Box, TextField, Button, Typography, List, ListItem, ListItemText, IconButton, Paper, TablePagination } from '@mui/material';
import { Delete, Add, DeleteSweep, UploadFile, Remove } from '@mui/icons-material';
import api from '../api';

interface Domain { id: number; name: string; }

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [totalCount, setTotalCount] = useState(0); // Общее кол-во записей в БД

  // Состояние пагинации
  const [page, setPage] = useState(0); // MUI использует индекс с 0
  const [rowsPerPage, setRowsPerPage] = useState(10); // По умолчанию 10

  useEffect(() => {
    loadDomains();
  }, [page, rowsPerPage]);

  const loadDomains = async () => {
    try {
      // Backend ждет page начиная с 1, а MUI дает с 0. Поэтому page + 1
      const { data } = await api.get(`/domains?page=${page + 1}&limit=${rowsPerPage}`);

      // Сервер теперь возвращает { data: [], total: 123 }
      setDomains(data.data);
      setTotalCount(data.total);
    } catch (e) {
      console.error(e);
    }
  };

  // Обработчик смены страницы
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  // Обработчик смены кол-ва строк на странице
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0); // Сбрасываем на первую страницу
  };

  const handleAdd = async () => {
    if (!newDomain) return;
    await api.post('/domains', { name: newDomain });
    setNewDomain('');
    loadDomains();
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/domains/${id}`);
    loadDomains();
  };

  const handleDeleteAll = async () => {
    if (confirm('ВНИМАНИЕ! Вы действительно хотите удалить ВСЕ домены из белого списка?')) {
      if (confirm('Это действие необратимо. Точно удалить?')) {
        try {
          await api.delete('/domains/all');
          loadDomains();
        } catch (e) { alert('Ошибка удаления'); }
      }
    }
  };

  // --- ЛОГИКА ЗАГРУЗКИ ФАЙЛА ---
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      // Разбиваем текст на строки по переносу
      const lines = text.split(/\r?\n/);

      // Отправляем на сервер
      try {
        const { data } = await api.post('/domains/upload', { domains: lines });
        alert(`Успешно добавлено доменов: ${data.count}`);
        loadDomains();
      } catch (err) {
        alert('Ошибка при загрузке списка');
      } finally {
        // Сбрасываем инпут, чтобы можно было загрузить тот же файл повторно
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Белый список доменов (SNI)</Typography>

      <Paper sx={{ p: 2, display: 'flex', gap: 2 }}>
        <TextField
          label="Добавить домен" size="small" fullWidth
          value={newDomain} onChange={(e) => setNewDomain(e.target.value)}
        />
        <Button
          variant="outlined"
          startIcon={<UploadFile />}
          sx={{ width: '170px' }}
          onClick={() => fileInputRef.current?.click()}
        >
          Из файла
        </Button>
        {/* Скрытый инпут */}
        <input
          type="file"
          accept=".txt"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
        <Button variant="contained" sx={{ width: '160px' }} startIcon={<Add />} onClick={handleAdd}>Добавить</Button>
      </Paper>

      {domains.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'end', width: '100%' }}>
          <Button
            variant="text"
            color="error"
            size='small'
            startIcon={<Remove />}
            onClick={handleDeleteAll}
          >
            Удалить все
          </Button>
        </Box>

      )}

      <Paper>
        <List>
          {domains.map((d) => (
            <ListItem key={d.id} secondaryAction={
              <IconButton edge="end" onClick={() => handleDelete(d.id)}><Delete /></IconButton>
            }>
              <ListItemText primary={d.name} />
            </ListItem>
          ))}
          {domains.length === 0 && <Typography sx={{ p: 2 }} color='textSecondary' textAlign='center'>Список пуст</Typography>}
        </List>
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage="Доменов на странице:"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} из ${count !== -1 ? count : `более ${to}`}`}
        />
      </Paper>
    </Box>
  );
}