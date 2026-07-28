import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BearingCompass, CallsignLabel, FrequencyScale, MorseDivider, SignalMeter, SpectrumWaterfall, TelegraphKey } from "@/components/visual/radio-instruments";

describe("radio design system", () => {
  it("renders semantic radio instruments without hiding useful labels", () => {
    render(<div><CallsignLabel value="BD-TRAIN / CH-01" /><SignalMeter value={4} label="同步信号" /><FrequencyScale active={3} /><BearingCompass bearing={72} /><MorseDivider text="TRAIN SMART" /><TelegraphKey /><SpectrumWaterfall /></div>);

    expect(screen.getByText("BD-TRAIN / CH-01")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "同步信号" })).toHaveAttribute("aria-valuenow", "4");
    expect(screen.getByRole("img", { name: "无线电测向 72 度" })).toBeInTheDocument();
    expect(screen.getByText("TRAIN SMART")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "电报键示意图" })).toBeInTheDocument();
  });
});
