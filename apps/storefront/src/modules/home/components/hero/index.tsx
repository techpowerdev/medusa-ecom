import { STORE_CONTENT } from "@lib/store-content";
import { buttonVariants } from "@/components/ui/button";
import LocalizedClientLink from "@modules/common/components/localized-client-link";

// CORE-18: เนื้อหาจาก src/lib/store-content.ts (placeholder ไทย, TODO(owner-content))
const Hero = () => {
  const { hero } = STORE_CONTENT;
  return (
    <div className="h-[75vh] w-full border-b border-border relative bg-muted">
      <div className="absolute inset-0 z-10 flex flex-col justify-center items-center text-center small:p-32 gap-6">
        <span>
          <h1
            className="text-3xl leading-10 text-foreground font-semibold"
            data-testid="hero-title"
          >
            {hero.title}
          </h1>
          <h2
            className="text-3xl leading-10 text-muted-foreground font-semibold"
            data-testid="hero-subtitle"
          >
            {hero.subtitle}
          </h2>
        </span>
        <LocalizedClientLink
          href={hero.ctaHref}
          className={buttonVariants({ variant: "outline" })}
          data-testid="hero-cta"
        >
          {hero.ctaLabel}
        </LocalizedClientLink>
      </div>
    </div>
  );
};

export default Hero;
