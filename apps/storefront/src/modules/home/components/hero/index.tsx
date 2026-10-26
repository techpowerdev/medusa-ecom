import { STORE_CONTENT } from "@lib/store-content";
import { Button, Heading } from "@modules/common/components/ui";
import LocalizedClientLink from "@modules/common/components/localized-client-link";

// CORE-18: เนื้อหาจาก src/lib/store-content.ts (placeholder ไทย, TODO(owner-content))
const Hero = () => {
  const { hero } = STORE_CONTENT;
  return (
    <div className="h-[75vh] w-full border-b border-ui-border-base relative bg-ui-bg-subtle">
      <div className="absolute inset-0 z-10 flex flex-col justify-center items-center text-center small:p-32 gap-6">
        <span>
          <Heading
            level="h1"
            className="text-3xl leading-10 text-ui-fg-base font-normal"
            data-testid="hero-title"
          >
            {hero.title}
          </Heading>
          <Heading
            level="h2"
            className="text-3xl leading-10 text-ui-fg-subtle font-normal"
            data-testid="hero-subtitle"
          >
            {hero.subtitle}
          </Heading>
        </span>
        <LocalizedClientLink href={hero.ctaHref} data-testid="hero-cta">
          <Button variant="secondary">{hero.ctaLabel}</Button>
        </LocalizedClientLink>
      </div>
    </div>
  );
};

export default Hero;
