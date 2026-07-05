import { useEffect, useRef } from 'react';

import { t } from '@/utils/i18n';

const SVG_NS = 'http://www.w3.org/2000/svg';

const SIZE_CLASS = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-9',
} as const;

const SIZE_CONFIG = {
  sm: { particleCount: 42, strokeWidth: 3.4 },
  md: { particleCount: 56, strokeWidth: 4.2 },
  lg: { particleCount: 70, strokeWidth: 4.8 },
} as const;

const ANIMATION_CONFIG = {
  trailSpan: 0.4,
  durationMs: 5600,
  rotationDurationMs: 34000,
  pulseDurationMs: 5000,
  lemniscateA: 20,
  lemniscateBoost: 7,
  rotate: false,
} as const;

type SpinnerSize = keyof typeof SIZE_CLASS;

function normalizeProgress(progress: number) {
  return ((progress % 1) + 1) % 1;
}

function getDetailScale(time: number) {
  const pulseProgress =
    (time % ANIMATION_CONFIG.pulseDurationMs) / ANIMATION_CONFIG.pulseDurationMs;
  const pulseAngle = pulseProgress * Math.PI * 2;
  return 0.52 + ((Math.sin(pulseAngle + 0.55) + 1) / 2) * 0.48;
}

function getRotation(time: number) {
  if (!ANIMATION_CONFIG.rotate) return 0;
  return (
    -((time % ANIMATION_CONFIG.rotationDurationMs) / ANIMATION_CONFIG.rotationDurationMs) * 360
  );
}

function curvePoint(progress: number, detailScale: number) {
  const angle = progress * Math.PI * 2;
  const scale = ANIMATION_CONFIG.lemniscateA + detailScale * ANIMATION_CONFIG.lemniscateBoost;
  const denom = 1 + Math.sin(angle) ** 2;
  return {
    x: 50 + (scale * Math.cos(angle)) / denom,
    y: 50 + (scale * Math.sin(angle) * Math.cos(angle)) / denom,
  };
}

function buildPath(detailScale: number, steps = 480) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const point = curvePoint(index / steps, detailScale);
    return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join(' ');
}

function getParticle(index: number, particleCount: number, progress: number, detailScale: number) {
  const tailOffset = particleCount <= 1 ? 0 : index / (particleCount - 1);
  const point = curvePoint(
    normalizeProgress(progress - tailOffset * ANIMATION_CONFIG.trailSpan),
    detailScale
  );
  const fade = (1 - tailOffset) ** 0.56;
  return {
    x: point.x,
    y: point.y,
    radius: 0.9 + fade * 2.7,
    opacity: 0.04 + fade * 0.96,
  };
}

function paintFrame(
  group: SVGGElement,
  path: SVGPathElement,
  particles: SVGCircleElement[],
  particleCount: number,
  time: number
) {
  const progress = (time % ANIMATION_CONFIG.durationMs) / ANIMATION_CONFIG.durationMs;
  const detailScale = getDetailScale(time);

  group.setAttribute('transform', `rotate(${getRotation(time)} 50 50)`);
  path.setAttribute('d', buildPath(detailScale));

  particles.forEach((node, index) => {
    const particle = getParticle(index, particleCount, progress, detailScale);
    node.setAttribute('cx', particle.x.toFixed(2));
    node.setAttribute('cy', particle.y.toFixed(2));
    node.setAttribute('r', particle.radius.toFixed(2));
    node.setAttribute('opacity', particle.opacity.toFixed(3));
  });
}

function paintStaticFrame(
  group: SVGGElement,
  path: SVGPathElement,
  particles: SVGCircleElement[],
  particleCount: number
) {
  group.removeAttribute('transform');
  path.setAttribute('d', buildPath(0.75));
  path.setAttribute('opacity', '0.22');

  particles.forEach((node, index) => {
    const particle = getParticle(index, particleCount, 0.18, 0.75);
    node.setAttribute('cx', particle.x.toFixed(2));
    node.setAttribute('cy', particle.y.toFixed(2));
    node.setAttribute('r', particle.radius.toFixed(2));
    node.setAttribute('opacity', (particle.opacity * 0.65).toFixed(3));
  });
}

const LemniscateBloomLoader = ({
  size = 'md',
  className = '',
  ariaLabel,
}: {
  size?: SpinnerSize;
  className?: string;
  ariaLabel: string;
}) => {
  const groupRef = useRef<SVGGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const { particleCount, strokeWidth } = SIZE_CONFIG[size];
  const initialPath = buildPath(0.75);

  useEffect(() => {
    const group = groupRef.current;
    const path = pathRef.current;
    if (!group || !path) return;

    path.setAttribute('stroke-width', String(strokeWidth));

    const particles = Array.from({ length: particleCount }, () => {
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('fill', 'currentColor');
      group.appendChild(circle);
      return circle;
    });

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      paintStaticFrame(group, path, particles, particleCount);
      return () => {
        for (const node of particles) {
          node.remove();
        }
      };
    }

    const startedAt = performance.now();
    let frameId = 0;

    const render = (now: number) => {
      paintFrame(group, path, particles, particleCount, now - startedAt);
      frameId = requestAnimationFrame(render);
    };

    paintFrame(group, path, particles, particleCount, 0);
    frameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameId);
      for (const node of particles) {
        node.remove();
      }
    };
  }, [particleCount, strokeWidth]);

  return (
    <span
      className={['inline-flex shrink-0 text-muted', SIZE_CLASS[size], className]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-label={ariaLabel}
    >
      <svg viewBox="0 0 100 100" fill="none" className="size-full overflow-visible" aria-hidden>
        <g ref={groupRef}>
          <path
            ref={pathRef}
            d={initialPath}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.1}
          />
        </g>
      </svg>
    </span>
  );
};

export const Spinner = ({
  size = 'md',
  className = '',
  'aria-label': ariaLabel,
}: {
  size?: SpinnerSize;
  className?: string;
  'aria-label'?: string;
}) => (
  <LemniscateBloomLoader
    size={size}
    className={className}
    ariaLabel={ariaLabel ?? t('initializing')}
  />
);
