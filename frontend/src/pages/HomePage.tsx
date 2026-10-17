import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const HomePage: React.FC = () => {
  const { t } = useLanguage();

  const areas = [
    {
      title: "Recetario",
      desc: "Biblioteca compartida, versiones, fotografías y cocina guiada.",
      path: "/recipes",
      image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
      accent: "from-amber-500/20 to-orange-500/20"
    },
    {
      title: "Planificador",
      desc: "Menús personales, familiares, saludables y generados con IA.",
      path: "/planner",
      image: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=600&q=80",
      accent: "from-blue-500/20 to-indigo-500/20"
    },
    {
      title: "Compra y despensa",
      desc: "Listas, existencias, tickets, precios y presupuestos.",
      path: "/shopping",
      image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80",
      accent: "from-emerald-500/20 to-teal-500/20"
    },
    {
      title: "Mi alimentación",
      desc: "Objetivos, hábitos, orientación nutricional y propuestas saludables.",
      path: "/nutrition",
      image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80",
      accent: "from-rose-500/20 to-pink-500/20"
    },
    {
      title: "Importador inteligente",
      desc: "Drive, PDF, Instagram, vídeos, fotografías y extracción con IA.",
      path: "/imports",
      image: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=600&q=80",
      accent: "from-purple-500/20 to-violet-500/20"
    },
    {
      title: "Administración",
      desc: "Usuarios, permisos, IA, integraciones, almacenamiento y backups.",
      path: "/admin",
      image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80",
      accent: "from-amber-600/20 to-yellow-500/20"
    }
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-6">
      {/* Header Intro */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>PWA Inteligente Instalable</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          Recetario Familiar Inteligente
        </h1>
        <p className="text-zinc-400 text-sm md:text-base leading-relaxed">
          Aplicación moderna, visual, responsive y de uso familiar, articulada en seis grandes áreas funcionales integradas.
        </p>
      </div>

      {/* 6 Cards Grid (2 cols on mobile, 3 cols on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 md:gap-5">
        {areas.map((area, idx) => (
          <Link
            key={idx}
            to={area.path}
            className="group relative flex flex-col bg-zinc-900/80 rounded-2xl overflow-hidden border border-zinc-800/80 hover:border-zinc-700 transition-all duration-300 hover:shadow-xl hover:shadow-black/50"
          >
            {/* Card Image */}
            <div className="aspect-[16/10] w-full overflow-hidden bg-zinc-800 relative">
              <img
                src={area.image}
                alt={area.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent opacity-80" />
            </div>

            {/* Card Content */}
            <div className="p-3.5 md:p-4 flex flex-col flex-1 justify-between">
              <div>
                <h3 className="text-base md:text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                  {area.title}
                </h3>
                <p className="text-zinc-400 text-xs md:text-sm mt-1 line-clamp-2 leading-snug">
                  {area.desc}
                </p>
              </div>

              <div className="mt-3 flex items-center text-xs font-semibold text-amber-400 group-hover:translate-x-1 transition-transform">
                <span>Acceder</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Footer Banner */}
      <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/60 text-center">
        <p className="text-zinc-400 text-xs md:text-sm font-medium">
          Estas seis áreas forman una única aplicación unificada, no servicios separados para el usuario.
        </p>
      </div>
    </div>
  );
};
