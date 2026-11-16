import { describe, expect, it } from "vitest";
import { MARKET_INSTRUMENTS, getIndianMarketStatus, resolveInstrument } from "@/server/market-data";

describe("market data symbol resolver", () => {
  it("resolves core NSE and BSE indices cleanly", () => {
    expect(resolveInstrument("NIFTY").providerSymbol).toBe("^NSEI");
    expect(resolveInstrument("BANKNIFTY").providerSymbol).toBe("^NSEBANK");
    const sensex = resolveInstrument("SENSEX");
    expect(sensex.providerSymbol).toBe("^BSESN");
    expect(sensex.exchange).toBe("BSE");
  });

  it("handles .NS and .BO suffixes dynamically", () => {
    const tcsBse = resolveInstrument("TCS.BO");
    expect(tcsBse.exchange).toBe("BSE");
    expect(tcsBse.providerSymbol).toBe("TCS.BO");

    const wipro = resolveInstrument("wipro.ns");
    expect(wipro.symbol).toBe("WIPRO");
    expect(wipro.providerSymbol).toBe("WIPRO.NS");
    expect(wipro.exchange).toBe("NSE");

    const custom = resolveInstrument("ADANIENT");
    expect(custom.providerSymbol).toBe("ADANIENT.NS");
    expect(custom.exchange).toBe("NSE");
  });

  it("includes both NSE and BSE instruments in defaults", () => {
    expect(MARKET_INSTRUMENTS.some((i) => i.exchange === "NSE")).toBe(true);
    expect(MARKET_INSTRUMENTS.some((i) => i.exchange === "BSE")).toBe(true);
  });
});

describe("Indian market session status", () => {
  it("marks weekday IST 10:30 as LIVE", () => {
    // 2026-11-16 is a Monday. 10:30 IST = 05:00 UTC
    const monMorning = new Date("2026-11-16T05:00:00Z");
    expect(getIndianMarketStatus(monMorning)).toBe("LIVE");
  });

  it("marks weekday IST 16:00 and weekends as CLOSED", () => {
    // Monday 16:00 IST = 10:30 UTC
    const monEvening = new Date("2026-11-16T10:30:00Z");
    expect(getIndianMarketStatus(monEvening)).toBe("CLOSED");

    // Saturday 11:00 IST = 05:30 UTC
    const sat = new Date("2026-11-14T05:30:00Z");
    expect(getIndianMarketStatus(sat)).toBe("CLOSED");
  });
});
