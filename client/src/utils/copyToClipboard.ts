/**
 * Универсальная функция копирования текста в буфер обмена.
 * Работает и в secure (HTTPS/localhost), и в insecure (HTTP по IP) контекстах.
 * navigator.clipboard недоступен при не-HTTPS/не-localhost соединениях.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    // Fallback для HTTP (не-localhost) — использует execCommand
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
