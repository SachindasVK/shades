function showToast(message, type = 'success') {
  if (!toast) return;

  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = toast.querySelector('i.fas');
  const toastBorder = toast.querySelector('div.border-l-4');

  // Set message
  toastMessage.textContent = message;

  // Set toast appearance based on type
  if (type === 'success') {
    toastIcon.className = 'fas fa-check-circle text-green-500';
    toastBorder.className = toastBorder.className.replace(/border-\w+-500/g, 'border-green-500');
  } else if (type === 'error') {
    toastIcon.className = 'fas fa-exclamation-circle text-red-500';
    toastBorder.className = toastBorder.className.replace(/border-\w+-500/g, 'border-red-500');
  } else if (type === 'warning') {
    toastIcon.className = 'fas fa-exclamation-triangle text-amber-500';
    toastBorder.className = toastBorder.className.replace(/border-\w+-500/g, 'border-amber-500');
  } else if (type === 'info') {
    toastIcon.className = 'fas fa-info-circle text-blue-500';
    toastBorder.className = toastBorder.className.replace(/border-\w+-500/g, 'border-blue-500');
  }

  // Show toast
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

function reloadPageAfterDelay(delay = 1000) {
  setTimeout(() => {
    window.location.reload();
  }, delay);
}
