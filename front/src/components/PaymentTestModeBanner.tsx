const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
        Os pagamentos reais ainda não estão liberados nesta versão publicada.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-500">
        Modo de teste: nenhuma cobrança real é feita agora.
      </div>
    );
  }
  return null;
}
