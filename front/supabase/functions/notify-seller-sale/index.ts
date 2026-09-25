import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Content-Type": "application/json",
};

function money(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const auth = req.headers.get("Authorization") ?? "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceRole || auth !== `Bearer ${serviceRole}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!resendKey || !supabaseUrl) throw new Error("RESEND_API_KEY/SUPABASE_URL não configurados.");

    const { orderId } = await req.json();
    if (!orderId) return new Response(JSON.stringify({ error: "orderId obrigatório" }), { status: 400, headers: corsHeaders });

    const db = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: order, error: orderError } = await db
      .from("marketplace_orders")
      .select("id,seller_id,buyer_id,status,total_cents,currency,paid_at")
      .eq("id", orderId)
      .single();
    if (orderError || !order) throw new Error(orderError?.message ?? "Pedido não encontrado.");
    if (order.status !== "paid") return new Response(JSON.stringify({ skipped: "order_not_paid" }), { headers: corsHeaders });

    const { data: items, error: itemsError } = await db
      .from("marketplace_order_items")
      .select("title,price_cents")
      .eq("order_id", order.id);
    if (itemsError) throw new Error(itemsError.message);

    const { data: sellerUser, error: sellerError } = await db.auth.admin.getUserById(order.seller_id);
    if (sellerError || !sellerUser.user?.email) throw new Error("E-mail do vendedor não encontrado.");

    const { data: sellerProfile } = await db
      .from("profiles")
      .select("display_name")
      .eq("id", order.seller_id)
      .maybeSingle();

    const sellerName = sellerProfile?.display_name || "vendedor";
    const itemRows = (items ?? [])
      .map((item) => `<tr><td style="padding:8px 0;color:#292524">${String(item.title).replace(/[<>&]/g, "")}</td><td style="padding:8px 0;text-align:right;color:#292524">${money(Number(item.price_cents), order.currency)}</td></tr>`)
      .join("");

    const html = `<!doctype html><html><body style="margin:0;background:#f5efe7;font-family:Arial,sans-serif;color:#292524"><div style="max-width:560px;margin:0 auto;padding:32px 18px"><div style="background:#fffaf4;border:1px solid #e5d6c6;border-radius:20px;padding:28px"><div style="font-size:13px;font-weight:700;letter-spacing:.12em;color:#9a5b3d">BOOKSYDE</div><h1 style="font-size:26px;margin:14px 0 8px">Você fez uma venda 🎉</h1><p style="margin:0 0 22px;color:#6b625b;line-height:1.6">Olá, ${sellerName}. O pagamento de um pedido do Marketplace foi confirmado.</p><table style="width:100%;border-collapse:collapse">${itemRows}</table><div style="border-top:1px solid #eadfd5;margin-top:12px;padding-top:18px;display:flex;justify-content:space-between"><strong>Total da venda</strong><strong>${money(Number(order.total_cents), order.currency)}</strong></div><p style="font-size:12px;color:#8a817a;margin:24px 0 0">Pedido ${order.id}</p></div><p style="text-align:center;color:#9b928a;font-size:12px">BookSyde · Sua estante, do seu jeito.</p></div></body></html>`;

    const resend = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "BookSyde <noreply@booksyde.com.br>",
        to: [sellerUser.user.email],
        subject: `Nova venda no BookSyde · ${money(Number(order.total_cents), order.currency)}`,
        html,
      }),
    });

    const result = await resend.json();
    if (!resend.ok) throw new Error(`Resend: ${JSON.stringify(result)}`);
    return new Response(JSON.stringify({ success: true, id: result.id }), { headers: corsHeaders });
  } catch (error) {
    console.error("notify-seller-sale:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }), { status: 500, headers: corsHeaders });
  }
});
