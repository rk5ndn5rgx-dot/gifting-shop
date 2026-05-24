// Reusable button and panel components for the Baby Ray Studio interface.

export function createStudioButton(label) {
  const button = document.createElement('button');
  button.textContent = label;
  button.className = 'studio-button';
  return button;
}
