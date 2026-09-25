export function isAppleMobileDevice() {
  if (typeof navigator === "undefined") return false;

  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Só oferece o botão quando o navegador realmente consegue entrar em
 * fullscreen de documento/elemento. No iPhone/iPad a UI do sistema continua
 * visível em muitos cenários, então não exibimos um controle que apenas imita
 * tela cheia sem mudar a experiência de fato.
 */
export function canUseRealFullscreen() {
  if (typeof document === "undefined") return false;
  if (isAppleMobileDevice()) return false;

  const root = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
    msRequestFullscreen?: () => Promise<void> | void;
  };

  return Boolean(
    (document.fullscreenEnabled && root.requestFullscreen) ||
      root.webkitRequestFullscreen ||
      root.msRequestFullscreen,
  );
}
