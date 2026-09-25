import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type ReviewRow = { id:string; rating:number; body:string; created_at:string; user_id:string; profiles:{display_name:string}|null };
export function Stars({value,className}:{value:number;className?:string}) { return <span className={cn("inline-flex items-center gap-0.5",className)}>{[1,2,3,4,5].map(n=><Star key={n} className={cn("size-4",n<=Math.round(value)?"fill-amber-400 text-amber-400":"text-muted-foreground/35")}/>)}</span> }

export function ReviewSection({mangaId}:{mangaId:string}) {
 const {user}=useAuth(); const qc=useQueryClient(); const [rating,setRating]=useState(5); const [body,setBody]=useState("");
 const {data:reviews=[]}=useQuery({queryKey:["reviews",mangaId],queryFn:async()=>{const {data,error}=await supabase.from("reviews").select("id,rating,body,created_at,user_id,profiles(display_name)").eq("manga_id",mangaId).order("created_at",{ascending:false});if(error)throw error;return (data??[]) as unknown as ReviewRow[]}});
 const mine=reviews.find(r=>r.user_id===user?.id); useEffect(()=>{if(mine){setRating(mine.rating);setBody(mine.body??"")}},[mine?.id,mine?.rating,mine?.body]);
 const average=reviews.length?reviews.reduce((s,r)=>s+r.rating,0)/reviews.length:0;
 const distribution=useMemo(()=>[5,4,3,2,1].map(n=>({n,count:reviews.filter(r=>r.rating===n).length})),[reviews]);
 const save=useMutation({mutationFn:async()=>{const {error}=await supabase.from("reviews").upsert({manga_id:mangaId,user_id:user!.id,rating,body:body.trim()},{onConflict:"user_id,manga_id"});if(error)throw error},onSuccess:()=>{qc.invalidateQueries({queryKey:["reviews",mangaId]});toast.success(mine?"Avaliação atualizada":"Avaliação publicada")},onError:(e:Error)=>toast.error(e.message)});
 const remove=useMutation({mutationFn:async()=>{const {error}=await supabase.from("reviews").delete().eq("manga_id",mangaId).eq("user_id",user!.id);if(error)throw error},onSuccess:()=>{setRating(5);setBody("");qc.invalidateQueries({queryKey:["reviews",mangaId]});toast.success("Avaliação removida")},onError:(e:Error)=>toast.error(e.message)});
 return <section className="rounded-[1.6rem] border border-border/70 bg-card/70 p-5 sm:p-6">
  <div className="grid gap-6 sm:grid-cols-[170px_1fr] sm:items-center">
   <div className="text-center sm:text-left"><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Nota dos leitores</p><div className="mt-2 font-display text-5xl font-semibold">{reviews.length?average.toFixed(1):"—"}</div><Stars value={average} className="mt-2 justify-center sm:justify-start"/><p className="mt-1 text-xs text-muted-foreground">{reviews.length} {reviews.length===1?"avaliação":"avaliações"}</p></div>
   <div className="space-y-1.5">{distribution.map(({n,count})=><div key={n} className="grid grid-cols-[24px_1fr_28px] items-center gap-2 text-xs"><span>{n}★</span><div className="h-2 overflow-hidden rounded-full bg-background/80"><div className="h-full rounded-full bg-amber-400" style={{width:`${reviews.length?(count/reviews.length)*100:0}%`}}/></div><span className="text-right text-muted-foreground">{count}</span></div>)}</div>
  </div>
  <div className="my-5 h-px bg-border/70"/>
  {user?<div className="space-y-3"><div className="flex items-center justify-between"><p className="font-medium">{mine?"Sua avaliação":"Avalie esta obra"}</p>{mine?<Button variant="ghost" size="sm" onClick={()=>remove.mutate()} disabled={remove.isPending}><Trash2 className="size-4"/> Remover</Button>:null}</div><div className="flex gap-1">{[1,2,3,4,5].map(n=><button key={n} onClick={()=>setRating(n)} aria-label={`Nota ${n}`}><Star className={cn("size-7 transition hover:scale-110",n<=rating?"fill-amber-400 text-amber-400":"text-muted-foreground/35")}/></button>)}</div><Textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Conte o que você achou (opcional)..." rows={3}/><Button size="sm" disabled={save.isPending} onClick={()=>save.mutate()}>{mine?"Atualizar avaliação":"Publicar avaliação"}</Button></div>:<p className="text-sm text-muted-foreground"><Link to="/auth" className="font-medium text-primary underline">Entre na sua conta</Link> para avaliar.</p>}
  {reviews.length?<ul className="mt-6 space-y-3">{reviews.slice(0,6).map(r=><li key={r.id} className="rounded-xl border border-border/60 bg-background/35 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">{r.profiles?.display_name??"Leitor"}</p><time className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</time></div><Stars value={r.rating}/></div>{r.body?<p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{r.body}</p>:null}</li>)}</ul>:<p className="mt-5 rounded-xl border border-dashed border-border/70 p-5 text-center text-sm text-muted-foreground">Ainda não há avaliações. Seja o primeiro a dar uma nota.</p>}
 </section>
}
