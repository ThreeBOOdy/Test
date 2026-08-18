import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LogoParticles } from "@/components/visual/logo-particles";

describe("brand logo particles", () => {
  it("renders an accessible particle stage with a static logo fallback", () => {
    render(<LogoParticles src="/brand/haihua-logo.png" label="海华信奥编程 品牌粒子标志" />);

    expect(screen.getByRole("img", { name: "海华信奥编程 品牌粒子标志" })).toBeInTheDocument();
    // 无 WebGL 环境下保留静态 logo 降级图
    const fallback = document.querySelector("img[src='/brand/haihua-logo.png']");
    expect(fallback).not.toBeNull();
  });
});
