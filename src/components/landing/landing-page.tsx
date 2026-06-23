"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

import { CtaSection } from "./cta-section";
import { Features } from "./features";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { LandingNav } from "./landing-nav";
import { PainSection } from "./pain-section";
import { SiteFooter } from "./site-footer";
import { TrustSection } from "./trust-section";

export function LandingPage() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;

      gsap.registerPlugin(ScrollTrigger, SplitText);

      const q = (sel: string) => el.querySelector<HTMLElement>(sel);
      const qa = (sel: string) =>
        Array.from(el.querySelectorAll<HTMLElement>(sel));

      // Người dùng chọn "giảm chuyển động" → chỉ fade nhẹ (không trượt/phóng/ghim),
      // an toàn cho người nhạy cảm nhưng trang vẫn "có sức sống".
      const prefersReduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (prefersReduced) {
        const calm = qa(
          "[data-hero-title], [data-hero-fade], [data-hero-bubble], [data-hero-card], [data-anim='fade-up'], [data-step], [data-stamp]",
        );
        if (calm.length) {
          gsap.set(calm, { autoAlpha: 0 });
          ScrollTrigger.batch(calm, {
            start: "top 95%",
            once: true,
            onEnter: (batch) =>
              gsap.to(batch, {
                autoAlpha: 1,
                duration: 0.5,
                stagger: 0.06,
                ease: "power1.out",
              }),
          });
        }
        return;
      }

      // ---- Thanh tiến trình cuộn ----
      const progress = q("[data-progress]");
      if (progress) {
        gsap.to(progress, {
          scaleX: 1,
          ease: "none",
          transformOrigin: "left center",
          scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
        });
      }

      // ---- Hero: hiện khi tải trang ----
      let split: SplitText | null = null;
      const heroTl = gsap.timeline({
        defaults: { ease: "power3.out", duration: 0.8 },
      });
      const title = q("[data-hero-title]");
      if (title) {
        try {
          split = new SplitText(title, { type: "lines,words", mask: "lines" });
          gsap.set(title, { autoAlpha: 1 });
          heroTl.from(split.words, {
            yPercent: 110,
            autoAlpha: 0,
            duration: 0.7,
            stagger: 0.05,
          });
        } catch {
          heroTl.from(title, { y: 30, autoAlpha: 0 });
        }
      }
      heroTl.from(
        "[data-hero-fade]",
        { y: 24, autoAlpha: 0, stagger: 0.12 },
        "-=0.35",
      );
      heroTl.from(
        "[data-hero-bubble]",
        {
          y: 16,
          autoAlpha: 0,
          scale: 0.96,
          transformOrigin: "bottom right",
          duration: 0.6,
        },
        "-=0.2",
      );
      heroTl.from(
        "[data-hero-card]",
        { y: 28, autoAlpha: 0, scale: 0.96, duration: 0.6 },
        "-=0.05",
      );

      // ---- Hiện dần khi cuộn tới (chung) ----
      const fadeEls = qa("[data-anim='fade-up']");
      if (fadeEls.length) {
        gsap.set(fadeEls, { opacity: 0, y: 28 });
        ScrollTrigger.batch(fadeEls, {
          start: "top 85%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              opacity: 1,
              y: 0,
              duration: 0.7,
              stagger: 0.1,
              ease: "power3.out",
              overwrite: true,
            }),
        });
      }

      // ---- Số đếm nhảy ----
      qa("[data-counter]").forEach((node) => {
        const end = Number(node.getAttribute("data-counter")) || 0;
        const suffix = node.getAttribute("data-suffix") ?? "";
        const obj = { v: 0 };
        node.textContent = `0${suffix}`;
        ScrollTrigger.create({
          trigger: node,
          start: "top 85%",
          once: true,
          onEnter: () =>
            gsap.to(obj, {
              v: end,
              duration: 1.4,
              ease: "power2.out",
              onUpdate: () => {
                node.textContent = `${Math.round(obj.v)}${suffix}`;
              },
            }),
        });
      });

      // ---- Con dấu "ĐÃ DUYỆT" đóng cộp ----
      const stamp = q("[data-stamp]");
      if (stamp) {
        gsap.set(stamp, { autoAlpha: 0, scale: 2.2, rotate: -28 });
        ScrollTrigger.create({
          trigger: stamp,
          start: "top 80%",
          once: true,
          onEnter: () =>
            gsap.to(stamp, {
              autoAlpha: 1,
              scale: 1,
              rotate: -8,
              duration: 0.5,
              ease: "back.out(2)",
            }),
        });
      }

      // ---- Ba bước: desktop ghim màn, mobile hiện dần ----
      const steps = qa("[data-step]");
      const line = q("[data-step-line]");
      const section = q("#cach-hoat-dong");
      const mm = gsap.matchMedia();

      if (section && steps.length) {
        mm.add("(min-width: 1024px)", () => {
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: section,
              start: "top top",
              end: `+=${Math.round(window.innerHeight * 1.1)}`,
              pin: true,
              scrub: 0.8,
              anticipatePin: 1,
            },
          });
          if (line) {
            tl.from(
              line,
              { scaleX: 0, transformOrigin: "left center", ease: "none" },
              0,
            );
          }
          steps.forEach((step, i) => {
            tl.from(
              step,
              { autoAlpha: 0, y: 40, ease: "power2.out" },
              0.3 + i * 0.6,
            );
          });
        });

        mm.add("(max-width: 1023px)", () => {
          gsap.set(steps, { autoAlpha: 0, y: 24 });
          ScrollTrigger.batch(steps, {
            start: "top 85%",
            once: true,
            onEnter: (batch) =>
              gsap.to(batch, {
                autoAlpha: 1,
                y: 0,
                duration: 0.6,
                stagger: 0.12,
                ease: "power3.out",
                overwrite: true,
              }),
          });
        });
      }

      return () => {
        if (split) split.revert();
      };
    },
    { scope: root },
  );

  return (
    <div ref={root} className="landing-fouc-guard min-h-dvh bg-paper text-textMain">
      <style
        dangerouslySetInnerHTML={{
          __html:
            ".landing-fouc-guard [data-hero-title],.landing-fouc-guard [data-hero-fade],.landing-fouc-guard [data-hero-bubble],.landing-fouc-guard [data-hero-card]{visibility:hidden}",
        }}
      />
      <noscript>
        <style
          dangerouslySetInnerHTML={{
            __html:
              ".landing-fouc-guard [data-hero-title],.landing-fouc-guard [data-hero-fade],.landing-fouc-guard [data-hero-bubble],.landing-fouc-guard [data-hero-card]{visibility:visible!important}",
          }}
        />
      </noscript>
      <div
        data-progress
        aria-hidden="true"
        className="fixed left-0 top-0 z-50 h-1 w-full origin-left scale-x-0 bg-ink"
      />
      <a
        href="#noi-dung"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Bỏ qua tới nội dung
      </a>
      <LandingNav />
      <main id="noi-dung">
        <Hero />
        <PainSection />
        <HowItWorks />
        <Features />
        <TrustSection />
        <CtaSection />
      </main>
      <SiteFooter />
    </div>
  );
}
