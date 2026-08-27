import Image from "next/image";

import { getAllSensorSnapshots } from "@/features/water-quality/data-access";
import { WaterQualityMap } from "@/features/water-quality/water-quality-map";

export const dynamic = "force-dynamic";

export default async function Home() {
  const sensors = await getAllSensorSnapshots();

  return (
    <div className="flex h-dvh min-h-[32rem] flex-col overflow-hidden bg-white">
      <header
        id="sobre-nosotros"
        className="relative z-20 flex h-[86px] shrink-0 items-center justify-between border-t border-slate-800 bg-white px-5 shadow-[0_2px_6px_rgba(15,23,42,0.16)] sm:px-8 lg:px-12"
      >
        <Image
          src="/aquasense.png"
          alt="AquaSense"
          width={2172}
          height={724}
          className="h-auto w-[180px] sm:w-[215px]"
          priority
        />
        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-8 text-[15px] font-medium text-slate-600 md:flex lg:gap-10"
        >
          <a
            href="#sobre-nosotros"
            className="transition-colors hover:text-[#008eaa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009dbd]"
          >
            Sobre nosotros
          </a>
          <a
            href="#mapa-calidad"
            className="transition-colors hover:text-[#008eaa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009dbd]"
          >
            Calidad del agua
          </a>
          <a
            href="#mapa-calidad"
            className="transition-colors hover:text-[#008eaa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009dbd]"
          >
            Estaciones
          </a>
        </nav>
      </header>
      <main id="mapa-calidad" className="min-h-0 flex-1">
        <h1 className="sr-only">Monitoreo de calidad del agua AquaSense</h1>
        <WaterQualityMap initialSensors={sensors} />
      </main>
    </div>
  );
}
