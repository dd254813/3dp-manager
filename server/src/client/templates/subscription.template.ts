/**
 * Генерирует HTML-страницу для отображения подписки с QR-кодом
 * @param currentUrl URL текущей подписки
 * @param qrDataUrl Data URL QR-кода
 * @param base64Config Base64-кодированная конфигурация подписки
 * @param subscriptionName Название подписки
 * @returns HTML-строка
 */
export function generateSubscriptionHtmlWithQr(
  currentUrl: string,
  qrDataUrl: string,
  base64Config: string,
  subscriptionName: string = 'Ваша подписка',
): string {
  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subscriptionName} | 3DP-MANAGER</title>
      <style>
        :root {
          --bg-default: #f3f4f6;
          --bg-paper: #ffffff;
          --text-primary: #111827;
          --text-secondary: #6b7280;
          --border-color: #e5e7eb;
          --card-shadow: 0 4px 20px rgba(0,0,0,0.1);
          --qr-box-bg: #fff;
          --qr-box-border: #eee;
          --link-box-bg: #f5f5f5;
          --link-box-border: #e0e0e0;
          --button-bg: #1976d2;
          --button-hover: #1565c0;
          --button-success: #2e7d32;
          --error-color: #ef4444;
        }

        [data-theme="dark"] {
          --bg-default: #0B0F19;
          --bg-paper: #111827;
          --text-primary: #f9fafb;
          --text-secondary: #9ca3af;
          --border-color: #374151;
          --card-shadow: 0 4px 20px rgba(0,0,0,0.4);
          --qr-box-bg: #1f2937;
          --qr-box-border: #374151;
          --link-box-bg: #1f2937;
          --link-box-border: #4b5563;
          --button-bg: #1976d2;
          --button-hover: #2563eb;
          --button-success: #2e7d32;
          --error-color: #f87171;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background-color: var(--bg-default);
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          transition: background-color 0.3s ease, color 0.3s ease;
        }

        .card {
          background: var(--bg-paper);
          padding: 2rem;
          border-radius: 16px;
          box-shadow: var(--card-shadow);
          text-align: center;
          max-width: 400px;
          width: 90%;
          border: 1px solid var(--border-color);
          transition: background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }

        h2 { margin-top: 0; color: var(--text-primary); }

        .qr-box {
          background: var(--qr-box-bg);
          padding: 10px;
          border: 1px solid var(--qr-box-border);
          border-radius: 8px;
          display: inline-block;
          margin: 20px 0;
          transition: background-color 0.3s ease, border-color 0.3s ease;
        }

        .link-box {
          background: var(--link-box-bg);
          padding: 10px;
          border-radius: 6px;
          font-family: monospace;
          word-break: break-all;
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 20px;
          border: 1px solid var(--link-box-border);
          transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
        }

        .action-btn {
          background-color: var(--button-bg);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          transition: background-color 0.2s;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .action-btn:hover { background-color: var(--button-hover); }
        .action-btn:active { transform: scale(0.98); }

        .theme-toggle {
          position: fixed;
          top: 20px;
          right: 20px;
          background-color: var(--bg-paper);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          transition: background-color 0.3s, color 0.3s, border-color 0.3s;
          padding: 0;
          z-index: 1000;
        }
        
        .theme-toggle:hover {
          background-color: var(--link-box-bg);
        }

        .theme-toggle svg {
          width: 24px;
          height: 24px;
        }

        .note {
          margin-top: 20px;
          font-size: 12px;
          color: var(--text-secondary);
          transition: color 0.3s ease;
        }

        .header-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 20px;
          color: var(--button-bg);
        }

        #subscription-links { display: none; }
      </style>
    </head>
    <body>
      <!-- Кнопка смены темы -->
      <button class="theme-toggle" onclick="toggleTheme()" aria-label="Переключить тему">
        <svg id="icon-sun" style="display: none;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <svg id="icon-moon" style="display: none;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </button>

      <div class="card">
        <svg class="header-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
        </svg>
        <h2>${subscriptionName}</h2>
        <p style="color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px;">
          Отсканируйте QR-код в приложениях<br>Happ, v2RayTun или Streisand
        </p>

        <div class="qr-box">
          <img src="${qrDataUrl}" alt="QR Code" />
        </div>

        <div class="link-box" id="link-text">${currentUrl}</div>

        <button class="action-btn" onclick="copyLink()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z"/></svg>
          Копировать ссылку
        </button>

        <div class="note">Для автоматического обновления конфигов<br>используйте эту ссылку</div>
      </div>
      <textarea id="subscription-links">${base64Config}</textarea>

      <script>
        // Функция применения темы
        function applyTheme() {
          let themeMode = localStorage.getItem('themeMode');
          
          // ТЁМНАЯ ТЕМА ПО УМОЛЧАНИЮ, если значение не задано
          if (!themeMode) {
            themeMode = 'dark';
            localStorage.setItem('themeMode', 'dark');
          }

          const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          const isDark = themeMode === 'dark' || (themeMode === 'system' && systemDark);
          
          if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('icon-sun').style.display = 'block';
            document.getElementById('icon-moon').style.display = 'none';
          } else {
            document.documentElement.setAttribute('data-theme', 'light');
            document.getElementById('icon-sun').style.display = 'none';
            document.getElementById('icon-moon').style.display = 'block';
          }
        }

        // Глобальная функция переключения темы по кнопке
        function toggleTheme() {
          const currentTheme = document.documentElement.getAttribute('data-theme');
          const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
          localStorage.setItem('themeMode', newTheme);
          applyTheme();
        }

        // Инициализация при загрузке
        (function() {
          applyTheme();

          // Слушаем изменения темы из других вкладок
          window.addEventListener('storage', (e) => {
            if (e.key === 'themeMode') {
              applyTheme();
            }
          });

          // Слушаем системные настройки (если выбрана системная тема)
          window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            const themeMode = localStorage.getItem('themeMode');
            if (themeMode === 'system') {
              applyTheme();
            }
          });
        })();

        function copyLink() {
          const link = document.getElementById('link-text').innerText;
          let copied = false;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(() => { copied = true; });
          }
          if (!copied) {
            const ta = document.createElement('textarea');
            ta.value = link;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          const btn = document.querySelector('.action-btn');
          const originalText = btn.innerHTML;
          btn.innerHTML = 'Скопировано!';
          btn.style.backgroundColor = 'var(--button-success)';
          setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.backgroundColor = 'var(--button-bg)';
          }, 2000);
        }
      </script>
    </body>
    </html>
  `;
}

/**
 * Генерирует HTML-страницу с ошибкой
 * @param title Заголовок ошибки
 * @param message Сообщение об ошибке
 * @returns HTML-строка
 */
export function generateErrorHtml(
  title: string = 'Ошибка',
  message: string = 'Произошла ошибка',
): string {
  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} | 3DP-MANAGER</title>
      <style>
        :root {
          --bg-default: #f3f4f6;
          --bg-paper: #ffffff;
          --text-primary: #111827;
          --text-secondary: #6b7280;
          --border-color: #e5e7eb;
          --card-shadow: 0 4px 20px rgba(0,0,0,0.1);
          --error-color: #ef4444;
          --error-bg: #fee2e2;
        }

        [data-theme="dark"] {
          --bg-default: #0B0F19;
          --bg-paper: #111827;
          --text-primary: #f9fafb;
          --text-secondary: #9ca3af;
          --border-color: #374151;
          --card-shadow: 0 4px 20px rgba(0,0,0,0.4);
          --error-color: #f87171;
          --error-bg: #7f1d1d;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background-color: var(--bg-default);
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          transition: background-color 0.3s ease, color 0.3s ease;
        }

        .card {
          background: var(--bg-paper);
          padding: 2rem;
          border-radius: 16px;
          box-shadow: var(--card-shadow);
          text-align: center;
          max-width: 400px;
          width: 90%;
          border: 1px solid var(--border-color);
          transition: background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }

        h2 {
          margin-top: 0;
          color: var(--text-primary);
        }

        .error-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 20px;
          color: var(--error-color);
        }

        .error-message {
          background: var(--error-bg);
          color: var(--error-color);
          padding: 1rem;
          border-radius: 8px;
          margin: 20px 0;
          font-size: 14px;
        }

        .home-link {
          display: inline-block;
          margin-top: 20px;
          padding: 12px 24px;
          background-color: var(--error-color);
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-size: 16px;
          transition: opacity 0.2s;
        }

        .home-link:hover {
          opacity: 0.9;
        }

        .theme-toggle {
          position: fixed;
          top: 20px;
          right: 20px;
          background-color: var(--bg-paper);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          transition: background-color 0.3s, color 0.3s, border-color 0.3s;
          padding: 0;
          z-index: 1000;
        }
        
        .theme-toggle:hover {
          background-color: var(--error-bg);
        }

        .theme-toggle svg {
          width: 24px;
          height: 24px;
        }

        .note {
          margin-top: 20px;
          font-size: 12px;
          color: var(--text-secondary);
          transition: color 0.3s ease;
        }
      </style>
    </head>
    <body>
      <!-- Кнопка смены темы -->
      <button class="theme-toggle" onclick="toggleTheme()" aria-label="Переключить тему">
        <svg id="icon-sun" style="display: none;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <svg id="icon-moon" style="display: none;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </button>

      <div class="card">
        <svg class="error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v8m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2>${title}</h2>
        <div class="error-message">${message}</div>
        <p class="note">Подписка не найдена или отключена</p>
        <a href="/" class="home-link">На главную</a>
      </div>

      <script>
        // Функция применения темы
        function applyTheme() {
          let themeMode = localStorage.getItem('themeMode');
          
          // ТЁМНАЯ ТЕМА ПО УМОЛЧАНИЮ
          if (!themeMode) {
            themeMode = 'dark';
            localStorage.setItem('themeMode', 'dark');
          }

          const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          const isDark = themeMode === 'dark' || (themeMode === 'system' && systemDark);
          
          if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('icon-sun').style.display = 'block';
            document.getElementById('icon-moon').style.display = 'none';
          } else {
            document.documentElement.setAttribute('data-theme', 'light');
            document.getElementById('icon-sun').style.display = 'none';
            document.getElementById('icon-moon').style.display = 'block';
          }
        }

        // Глобальная функция переключения темы по кнопке
        function toggleTheme() {
          const currentTheme = document.documentElement.getAttribute('data-theme');
          const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
          localStorage.setItem('themeMode', newTheme);
          applyTheme();
        }

        // Инициализация при загрузке
        (function() {
          applyTheme();

          window.addEventListener('storage', (e) => {
            if (e.key === 'themeMode') {
              applyTheme();
            }
          });

          window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            const themeMode = localStorage.getItem('themeMode');
            if (themeMode === 'system') {
              applyTheme();
            }
          });
        })();
      </script>
    </body>
    </html>
  `;
}
