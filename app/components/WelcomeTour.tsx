"use client";
import "client-only";
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Compass, FileCheck2, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { useResource } from "./Workspace";
import type { ProfileDto } from "@/lib/shared/profile";

const steps = [
  { title: "Tu próximo proyecto empieza aquí.", label: "Encuentra tu oportunidad", description: "PACT conecta a quienes tienen una idea con quienes pueden hacerla realidad. Puedes contratar, ofrecer tus servicios o hacer ambas cosas.", icon: Compass,
    cards: [
      ["Quiero contratar", "Publica una solicitud, revisa postulaciones y elige a tu proveedor."],
      ["Quiero ofrecer mi trabajo", "Completa tus habilidades y portafolio, explora solicitudes y postúlate."],
    ] },
  { title: "Una idea clara. Un acuerdo mejor.", label: "Crea con ayuda de IA", description: "Describe el trabajo o adjunta un brief. La IA te ayuda a estructurar las condiciones; tú revisas y corriges la propuesta antes de confirmar.", icon: Sparkles,
    cards: [
      ["Define lo que se entrega", "Revisa el título, los entregables, el monto en MON y el plazo."],
      ["Elige a la persona correcta", "La wallet del proveedor la introduces tú. La IA no la inventa."],
    ] },
  { title: "Tu cuenta y tu wallet, cada una a lo suyo.", label: "Conoce cómo funciona el pago", description: "Google o GitHub te dan acceso a PACT. MetaMask se conecta cuando necesitas firmar o gestionar transacciones en Monad Testnet.", icon: Wallet,
    cards: [
      ["Primero revisa, después firma", "Crear y financiar un acuerdo requiere confirmar una transacción en tu wallet."],
      ["Estamos en una red de prueba", "Usa MON de prueba. El saldo bloqueado permanece en el contrato hasta que se libere según las condiciones del acuerdo."],
    ] },
  { title: "El trabajo avanza. Tú sigues el acuerdo.", label: "Revisa y da el siguiente paso", description: "En Mis acuerdos puedes seguir el estado del trabajo. El proveedor entrega la evidencia y el cliente revisa el resultado antes de aprobar el pago.", icon: FileCheck2,
    cards: [
      ["La IA también puede revisar", "La liberación automática está desactivada por defecto: depende de tu autorización y de un límite que configuras en Ajustes."],
      ["Mantén tu perfil al día", "Desde Mi cuenta puedes cambiar tu foto, habilidades, ubicación y formas de acceso. La campana reúne tus avisos."],
    ] },
] as const;

export function WelcomeTour() {
  const [index, setIndex] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const { data } = useResource<{ profile: ProfileDto }>("/api/profile");
  const current = steps[index];
  const Icon = current.icon;
  const last = index === steps.length - 1;
  const roles = data?.profile.roles;
  function move(next: number) {
    setIndex(next);
    heading.current?.focus();
  }
  return <section className="welcome-tour" aria-label="Bienvenida a PACT">
    <div className="welcome-topline">
      <span>CONOCE PACT · {index + 1} DE {steps.length}</span>
      <Link href="/dashboard">Omitir recorrido <ArrowRight size={16} /></Link>
    </div>
    <ol className="welcome-progress" aria-label="Pasos del recorrido">
      {steps.map((step, position) => <li key={step.label} aria-current={position === index ? "step" : undefined}>
        <button type="button" onClick={() => move(position)} aria-label={`Paso ${position + 1}: ${step.label}`}>
          <span>{position < index ? <Check size={16} /> : position + 1}</span><strong>{step.label}</strong>
        </button>
      </li>)}
    </ol>
    <div className="welcome-content">
      <div className="welcome-story">
        <span className="welcome-icon"><Icon size={42} strokeWidth={1.7} /></span>
        <p className="welcome-eyebrow">{current.label}</p>
        <h1 ref={heading} tabIndex={-1}>{current.title}</h1>
        <p className="welcome-description">{current.description}</p>
        <div className="welcome-trust"><ShieldCheck size={20} /><span>Acuerdos claros para trabajar con confianza.</span></div>
      </div>
      <div className="welcome-details" aria-live="polite">
        <span className="welcome-details-label">ASÍ FUNCIONA</span>
        {current.cards.map(([title, text]) => <article key={title}>
          <span className="welcome-check"><Check size={20} /></span>
          <div><h2>{title}</h2><p>{text}</p></div>
        </article>)}
        {last && <div className="welcome-destinations">
          <h2>¿Por dónde quieres empezar?</h2>
          {(!roles || roles.includes("client")) && <Link className="btn-primary" href="/solicitudes/nueva">Publicar una solicitud <ArrowRight size={18} /></Link>}
          {(!roles || roles.includes("provider")) && <Link className="btn-secondary" href="/explorar">Explorar oportunidades <Compass size={18} /></Link>}
          <Link className="workspace-link" href="/dashboard">Ir a mis acuerdos <ArrowRight size={16} /></Link>
        </div>}
      </div>
    </div>
    <div className="welcome-footer">
      <button className="btn-secondary" type="button" disabled={index === 0} onClick={() => move(index - 1)}><ArrowLeft size={18} /> Anterior</button>
      <span>Puedes volver a este recorrido desde Mi cuenta.</span>
      {last ? <Link className="btn-primary" href="/dashboard">Entrar a PACT <ArrowRight size={18} /></Link> : <button className="btn-primary" type="button" onClick={() => move(index + 1)}>Siguiente <ArrowRight size={18} /></button>}
    </div>
  </section>;
}
