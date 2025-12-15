import React, { useEffect, useRef } from 'react';

interface AssistantOrbProps {
  state: 'idle' | 'listening' | 'processing' | 'speaking';
}

const AssistantOrb: React.FC<AssistantOrbProps> = ({ state }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
  }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const orbRadius = 60;

    let time = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.02;

      // Draw outer glow
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, orbRadius * 2);
      gradient.addColorStop(0, getColorByState(state, 0.8));
      gradient.addColorStop(0.7, getColorByState(state, 0.4));
      gradient.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, orbRadius * 2, 0, Math.PI * 2);
      ctx.fill();

      // Draw main orb
      ctx.fillStyle = getColorByState(state, 0.9);
      ctx.beginPath();
      ctx.arc(centerX, centerY, orbRadius, 0, Math.PI * 2);
      ctx.fill();

      // Draw inner highlight
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(centerX - 15, centerY - 15, orbRadius * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Draw particles based on state
      if (state === 'listening' || state === 'processing') {
        updateParticles();
        drawParticles(ctx);
      }

      // Draw pulse effect for speaking
      if (state === 'speaking') {
        const pulseRadius = orbRadius + Math.sin(time * 4) * 10;
        ctx.strokeStyle = getColorByState(state, 0.6);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state]);

  const getColorByState = (state: string, alpha: number = 1): string => {
    switch (state) {
      case 'idle':
        return `rgba(156, 163, 175, ${alpha})`; // gray
      case 'listening':
        return `rgba(59, 130, 246, ${alpha})`; // blue
      case 'processing':
        return `rgba(245, 158, 11, ${alpha})`; // amber
      case 'speaking':
        return `rgba(34, 197, 94, ${alpha})`; // green
      default:
        return `rgba(156, 163, 175, ${alpha})`;
    }
  };

  const updateParticles = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const orbRadius = 60;

    // Add new particles
    if (particlesRef.current.length < 20 && Math.random() < 0.3) {
      const angle = Math.random() * Math.PI * 2;
      const distance = orbRadius + Math.random() * 30;
      particlesRef.current.push({
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        life: 0,
        maxLife: 60 + Math.random() * 60
      });
    }

    // Update existing particles
    particlesRef.current = particlesRef.current.filter(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life++;

      // Fade out particles
      if (particle.life > particle.maxLife * 0.7) {
        particle.vx *= 0.95;
        particle.vy *= 0.95;
      }

      return particle.life < particle.maxLife;
    });
  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
    particlesRef.current.forEach(particle => {
      const alpha = 1 - (particle.life / particle.maxLife);
      ctx.fillStyle = getColorByState(state, alpha * 0.6);
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={300}
      className="w-48 h-48 md:w-56 md:h-56"
      style={{ imageRendering: 'pixelated' }}
    />
  );
};

export default AssistantOrb;
