const button = document.querySelector('#copy-wechat');
button?.addEventListener('click', async () => {
  const status = document.querySelector('#copy-wechat-status');
  try {
    await navigator.clipboard.writeText('goodmorning2you');
    status.textContent = '已复制微信号';
  } catch {
    const range = document.createRange();
    range.selectNodeContents(document.querySelector('#wechat-contact'));
    const selection = window.getSelection();
    selection?.removeAllRanges(); selection?.addRange(range);
    status.textContent = '请长按或按 Ctrl/Cmd+C 复制微信号';
  }
});
