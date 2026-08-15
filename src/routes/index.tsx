import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  BookOpenText,
  GraduationCap,
  LineChart,
  Sparkles,
  ShieldCheck,
  Clock,
  ArrowRight,
  CheckCircle2,
  Quote,
  Star,
} from "lucide-react";
import { lazy, Suspense } from "react";
import { motion } from "framer-motion";

const heroReading = "/assets/hero-reading.webp";
const featureBook = "/assets/feature-book.webp";
const featureTeacher = "/assets/feature-teacher.webp";
const featureBooks = "/assets/feature-books.webp";

export const Route = createFileRoute("/")({
  head: () => ({
    links: [{ rel: "preload", as: "image", href: heroReading }],
    meta: [
      { title: "Lecto — Compreensão leitora inspirada no ePIRLS" },
      {
        name: "description",
        content:
          "Plataforma SaaS multi-tenant de simulados de compreensão leitora alinhados à matriz PIRLS, com IA, analytics e ambiente digital estilo ePIRLS.",
      },
      { property: "og:title", content: "Lecto — Compreensão leitora inspirada no ePIRLS" },
      {
        property: "og:description",
        content: "Simulados PIRLS para escolas, professores e alunos, com IA e analytics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-md bg-gradient-to-br from-primary to-[oklch(0.65_0.18_220)] text-primary-foreground shadow-soft">
              <BookOpenText className="size-4" />
            </div>
            <span className="font-display text-xl">Lecto</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link to="/auth/student">Sou aluno</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Entrar</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden gradient-hero">
          <div className="absolute inset-0 grid-paper opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]" />
          <div
            className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-blob"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute top-40 -right-24 h-96 w-96 rounded-full bg-[oklch(0.75_0.15_200)]/25 blur-3xl animate-blob"
            style={{ animationDelay: "3s" }}
            aria-hidden
          />

          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-24 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-28">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft backdrop-blur">
                <Sparkles className="size-3 text-primary" /> Alinhado à matriz PIRLS 2021
              </span>
              <h1 className="mt-6 text-[clamp(2.25rem,8vw,3.75rem)] leading-[1.08] tracking-tight">
                Compreensão leitora <em className="not-italic text-gradient">avaliada</em>
                <br />
                como uma prova internacional.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-muted-foreground">
                Simulados digitais no padrão ePIRLS, com processos cognitivos balanceados
                automaticamente, correção assistida por IA e analytics por competência — para
                escolas que levam leitura a sério.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild size="lg" className="group w-full sm:w-auto">
                  <Link to="/auth">
                    Criar conta institucional
                    <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                  <Link to="/auth/student">Entrar com código da turma</Link>
                </Button>
              </div>

              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {["LGPD desde o dia zero", "Multi-tenant por escola", "IA integrada"].map((t) => (
                  <li key={t} className="inline-flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-primary" />
                    {t}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Hero visual */}
            <div className="relative animate-fade-up" style={{ animationDelay: "150ms" }}>
              <div className="relative overflow-hidden rounded-2xl border border-border/70 shadow-elevated">
                <img
                  src={heroReading}
                  alt="Estudantes lendo livros em uma sala de aula iluminada"
                  width={1600}
                  height={1200}
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
              </div>

              {/* Floating card 1 */}
              <div className="absolute -left-4 -bottom-6 hidden w-56 rounded-xl border border-border bg-card/90 p-4 shadow-elevated backdrop-blur animate-float sm:block">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <LineChart className="size-3.5 text-primary" /> Competência: Inferir
                </div>
                <div className="mt-2 font-display text-2xl">78%</div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-primary to-[oklch(0.65_0.18_220)]" />
                </div>
              </div>

              {/* Floating card 2 */}
              <div
                className="absolute -right-3 -top-6 hidden rounded-xl border border-border bg-card/90 p-3 shadow-elevated backdrop-blur animate-float sm:flex sm:items-center sm:gap-3"
                style={{ animationDelay: "1.2s" }}
              >
                <div className="grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <Sparkles className="size-4" />
                </div>
                <div className="text-xs">
                  <div className="font-semibold">Correção por IA</div>
                  <div className="text-muted-foreground">Feedback em 4s</div>
                </div>
              </div>
            </div>
          </div>

          {/* Logos / trust */}
          <div className="relative mx-auto max-w-6xl px-4 pb-14 sm:px-6">
            <p className="text-center text-xs uppercase tracking-widest text-muted-foreground">
              Inspirado nas avaliações mais respeitadas do mundo
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 font-display text-lg text-muted-foreground/70">
              <span>PIRLS</span>
              <span>·</span>
              <span>ePIRLS 2021</span>
              <span>·</span>
              <span>SAEB</span>
              <span>·</span>
              <span>PISA Reading</span>
              <span>·</span>
              <span>INEP</span>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-y border-border bg-surface content-auto">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:gap-8 sm:px-6 md:grid-cols-4">
            {[
              { k: "20/30/30/20", v: "Proporção PIRLS respeitada" },
              { k: "4", v: "Processos cognitivos avaliados" },
              { k: "IA", v: "Geração e correção assistidas" },
              { k: "LGPD", v: "Conformidade desde o dia zero" },
            ].map((s) => (
              <div key={s.v} className="text-center">
                <div className="font-display text-3xl text-gradient">{s.k}</div>
                <div className="mt-1 text-xs text-muted-foreground">{s.v}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features grid */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 content-auto">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              Recursos
            </span>
            <h2 className="mt-3 text-[clamp(1.75rem,5vw,2.25rem)] tracking-tight">
              Tudo para avaliar compreensão leitora
            </h2>
            <p className="mt-3 text-muted-foreground">
              Do banco de textos calibrado ao ambiente digital do aluno, com dashboards por
              competência.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: GraduationCap,
                title: "Matriz PIRLS aplicada",
                desc: "Localizar, inferir, interpretar e avaliar — proporção 20/30/30/20 automática.",
              },
              {
                icon: LineChart,
                title: "Dashboards por competência",
                desc: "Escola, turma e aluno com evolução, mapa de calor e radar por processo cognitivo.",
              },
              {
                icon: ShieldCheck,
                title: "Multi-tenant seguro",
                desc: "Isolamento por escola via RLS, auditoria de ações e conformidade LGPD.",
              },
              {
                icon: Sparkles,
                title: "IA integrada",
                desc: "Geração de textos e questões por ano, correção de dissertativas e feedback individual.",
              },
              {
                icon: Clock,
                title: "Ambiente ePIRLS",
                desc: "Navegador simulado com abas, links internos e questões contextuais.",
              },
              {
                icon: BookOpenText,
                title: "Banco calibrado",
                desc: "Textos e itens classificados por tema, ano, tipo, propósito e dificuldade.",
              },
            ].map((f, i) => (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-elevated"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/5 transition-transform group-hover:scale-150" />
                <div className="relative grid size-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-[oklch(0.65_0.18_220)] text-primary-foreground shadow-soft">
                  <f.icon className="size-5" />
                </div>
                <h3 className="relative mt-5 text-lg font-semibold">{f.title}</h3>
                <p className="relative mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Split showcase 1 */}
        <section className="bg-surface">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 md:grid-cols-2">
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-primary/10 blur-2xl" />
              <img
                src={featureBook}
                alt="Estudante folheando livro ilustrado"
                width={1200}
                height={900}
                loading="lazy"
                decoding="async"
                className="relative rounded-2xl border border-border shadow-elevated"
              />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                Para o aluno
              </span>
              <h2 className="mt-3 text-[clamp(1.75rem,5vw,2.25rem)] tracking-tight">
                Um ambiente que parece uma biblioteca digital
              </h2>
              <p className="mt-4 text-muted-foreground">
                Abas, links internos, favoritos e cronômetro. O aluno navega por textos e questões
                exatamente como no ePIRLS — com foco, sem distrações.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Retomar simulado exatamente de onde parou",
                  "Salvamento automático de respostas",
                  "Navegador simulado com histórico e abas",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 text-primary" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Split showcase 2 */}
        <section>
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 md:grid-cols-2">
            <div className="order-2 md:order-1">
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                Para o professor
              </span>
              <h2 className="mt-3 text-[clamp(1.75rem,5vw,2.25rem)] tracking-tight">
                Dashboards que revelam o que o aluno entendeu
              </h2>
              <p className="mt-4 text-muted-foreground">
                Percentuais por competência PIRLS, radar por processo cognitivo, evolução em linha e
                relatórios prontos para reuniões pedagógicas.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Radar por processo cognitivo",
                  "Comparativos entre turmas e séries",
                  "Feedback individual gerado por IA",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 text-primary" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative order-1 md:order-2">
              <div className="absolute -inset-4 rounded-3xl bg-[oklch(0.75_0.15_200)]/15 blur-2xl" />
              <img
                src={featureTeacher}
                alt="Professora e aluna analisando dashboard em laptop"
                width={1200}
                height={900}
                loading="lazy"
                decoding="async"
                className="relative rounded-2xl border border-border shadow-elevated"
              />
            </div>
          </div>
        </section>

        {/* Testimonial */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary to-[oklch(0.35_0.15_260)] text-primary-foreground">
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(600px 300px at 20% 20%, oklch(1 0 0 / 0.15), transparent 60%), radial-gradient(600px 300px at 80% 80%, oklch(1 0 0 / 0.1), transparent 60%)",
            }}
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 md:grid-cols-[auto_minmax(0,1fr)]">
            <div className="relative">
              <img
                src={featureBooks}
                alt="Livros e óculos sobre mesa"
                width={1200}
                height={900}
                loading="lazy"
                decoding="async"
                className="h-52 w-52 rounded-full object-cover ring-8 ring-white/15 shadow-elevated"
              />
            </div>
            <div>
              <Quote className="size-8 opacity-60" />
              <p className="mt-3 font-display text-2xl leading-snug md:text-3xl">
                “Pela primeira vez conseguimos ver, por aluno e por competência, exatamente onde a
                compreensão leitora está falhando — e o que fazer a respeito.”
              </p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex text-warning">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="size-4 fill-current" />
                  ))}
                </div>
                <span className="text-sm opacity-90">
                  Coordenadora Pedagógica · Escola parceira Lecto
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 text-center shadow-elevated sm:p-10 md:p-16">
            <div className="absolute inset-0 grid-paper opacity-50 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
            <div className="relative">
              <h2 className="text-[clamp(1.875rem,6vw,3rem)] tracking-tight">
                Leve sua escola ao <span className="text-gradient">padrão internacional</span> de
                leitura
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Comece hoje mesmo com uma conta institucional. Sem cartão, sem compromisso.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button asChild size="lg">
                  <Link to="/auth">Criar conta institucional</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                  <Link to="/auth/student">Sou aluno</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-center text-sm sm:px-6 sm:text-left text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <div className="grid size-6 place-items-center rounded-md bg-gradient-to-br from-primary to-[oklch(0.65_0.18_220)] text-primary-foreground">
              <BookOpenText className="size-3" />
            </div>
            <span>© {new Date().getFullYear()} Lecto</span>
          </div>
          <span>Compreensão leitora com padrão internacional</span>
        </div>
      </footer>
    </div>
  );
}
